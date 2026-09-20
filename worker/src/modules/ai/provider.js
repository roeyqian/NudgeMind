export async function completeChat(env, systemPrompt, messages, signal, options = {}) {
  if (!env.DEEPSEEK_API_KEY) throw { status: 503, message: 'AI 服务尚未配置' };
  const baseUrl = String(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: clampTemperature(options.temperature ?? env.AI_TEMPERATURE),
        max_tokens: clampMaxTokens(options.maxTokens, 500),
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
      signal,
    });
  } catch {
    throw { status: 502, message: '无法连接 AI 服务' };
  }
  if (!response.ok) throw { status: 502, message: `AI 服务返回错误（${response.status}）` };
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw { status: 502, message: 'AI 服务未返回有效内容' };
  return content.trim().slice(0, 2_000);
}

function clampTemperature(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(2, number)) : 0.5;
}

function clampMaxTokens(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(1, Math.min(2_000, number)) : fallback;
}
