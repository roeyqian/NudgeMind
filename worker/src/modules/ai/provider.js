export async function completeChat(env, systemPrompt, messages, signal, options = {}) {
  if (!env.DEEPSEEK_API_KEY) throw { status: 503, code: 'AI_NOT_CONFIGURED', message: 'AI 服务尚未配置 API Key' };
  const baseUrl = String(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const body = JSON.stringify({
    model: env.DEEPSEEK_MODEL || 'deepseek-flash',
    temperature: clampTemperature(options.temperature ?? env.AI_TEMPERATURE),
    max_tokens: clampMaxTokens(options.maxTokens, 500),
    ...(options.jsonOutput ? { response_format: { type: 'json_object' } } : {}),
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body,
        signal,
      });
    } catch {
      if (signal?.aborted) throw { status: 499, code: 'REQUEST_CANCELLED', message: '请求已取消' };
      if (attempt < 2) { await waitBeforeRetry(attempt, signal); continue; }
      throw { status: 502, code: 'AI_CONNECTION_FAILED', message: '无法连接 AI 服务，请检查网络或上游服务状态' };
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const upstreamStatus = response.status;
      const upstreamCode = String(payload?.error?.code || payload?.error?.type || '').slice(0, 80);
      const retryable = [429, 500, 502, 503, 504].includes(upstreamStatus);
      if (retryable && attempt < 2) { await waitBeforeRetry(attempt, signal); continue; }
      throw {
        status: 502,
        code: `AI_UPSTREAM_${upstreamStatus}`,
        message: upstreamErrorMessage(upstreamStatus, payload?.error?.message),
        upstreamStatus,
        ...(upstreamCode ? { upstreamCode } : {}),
      };
    }
    const payload = await response.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    if (payload?.choices?.[0]?.finish_reason === 'length') {
      throw { status: 502, code: 'AI_OUTPUT_TRUNCATED', message: 'AI 输出超过长度限制，回答不完整' };
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw { status: 502, code: 'AI_EMPTY_RESPONSE', message: 'AI 服务未返回有效内容' };
    }
    return content.trim();
  }
}

function upstreamErrorMessage(status, detail) {
  const reason = {
    400: '请求格式无效', 401: 'API Key 无效', 402: 'AI 账户余额不足',
    422: '模型或参数无效', 429: '请求频率达到上限',
    500: 'AI 服务内部错误', 503: 'AI 服务繁忙',
  }[status] || 'AI 服务请求失败';
  const safeDetail = typeof detail === 'string' ? detail.replace(/[\r\n\u0000-\u001f]/gu, ' ').trim().slice(0, 300) : '';
  return `AI 服务返回 ${status}：${reason}${safeDetail ? `；${safeDetail}` : ''}`;
}

function waitBeforeRetry(attempt, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject({ status: 499, code: 'REQUEST_CANCELLED', message: '请求已取消' }); return; }
    const onAbort = () => { clearTimeout(timer); reject({ status: 499, code: 'REQUEST_CANCELLED', message: '请求已取消' }); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, (attempt + 1) * 500);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function clampTemperature(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(2, number)) : 0.5;
}

function clampMaxTokens(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(1, Math.min(2_000, number)) : fallback;
}
