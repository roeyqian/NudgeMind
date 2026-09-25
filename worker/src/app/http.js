const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-max-age': '86400',
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      routes.push({ method: method.toUpperCase(), ...compilePattern(pattern), handler });
    },
    async handle(request, env, url, context = {}) {
      const route = routes.find((candidate) => candidate.method === request.method.toUpperCase() && candidate.expression.test(url.pathname));
      if (!route) return json({ error: '接口不存在' }, 404);
      const match = url.pathname.match(route.expression);
      const params = Object.fromEntries(route.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
      return route.handler({ request, env, url, params, ...context });
    },
  };
}

export async function handleApi(request, env, url, router, context = {}) {
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
  const requestId = createId('req');
  try {
    const response = await router.handle(request, env, url, { ...context, requestId });
    return withCors(response, { 'x-request-id': requestId });
  } catch (error) {
    const status = normalizeStatus(error?.status);
    if (status >= 500) console.error('Nudge Mind API error', { requestId, path: url.pathname, error });
    const knownError = typeof error?.code === 'string';
    return withCors(json({
      error: status >= 500 && !knownError ? '服务器内部错误，请凭请求 ID 联系管理员' : String(error?.message || '请求失败'),
      code: knownError ? error.code : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      requestId,
      ...(Number.isInteger(error?.upstreamStatus) ? { upstreamStatus: error.upstreamStatus } : {}),
      ...(typeof error?.upstreamCode === 'string' ? { upstreamCode: error.upstreamCode } : {}),
    }, status), { 'x-request-id': requestId });
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw { status: 400, message: '请求内容不是有效的 JSON' };
  }
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function createSession(user, env) {
  const token = createId('session');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const data = { userId: user.id, username: user.username, email: user.email };
  await Promise.all([
    env.nudge_mind_sessions.put(`session:${token}`, JSON.stringify(data), { expirationTtl: SESSION_TTL_SECONDS }),
    env.nudge_mind_db.prepare('INSERT INTO sessions (session_id, user_id, expires_at, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
      .bind(token, user.id, expiresAt).run(),
  ]);
  return { token, data };
}

export async function requireUser(request, env) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw { status: 401, message: '请先登录' };
  const token = header.slice(7);
  const cached = await env.nudge_mind_sessions.get(`session:${token}`);
  if (cached) return { token, user: JSON.parse(cached) };

  const row = await env.nudge_mind_db.prepare(`
    SELECT s.session_id, s.expires_at, u.id, u.username, u.email
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.session_id = ?
  `).bind(token).first();
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    if (row) await revokeSession(token, env);
    throw { status: 401, message: '登录已过期' };
  }
  const user = { userId: row.id, username: row.username, email: row.email };
  const ttl = Math.max(60, Math.floor((Date.parse(row.expires_at) - Date.now()) / 1000));
  await env.nudge_mind_sessions.put(`session:${token}`, JSON.stringify(user), { expirationTtl: ttl });
  return { token, user };
}

export async function revokeSession(token, env) {
  await Promise.all([
    env.nudge_mind_sessions.delete(`session:${token}`),
    env.nudge_mind_db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(token).run(),
  ]);
}

function compilePattern(pattern) {
  const names = [];
  const source = pattern.split('/').map((segment) => {
    if (segment.startsWith(':')) {
      names.push(segment.slice(1));
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { expression: new RegExp(`^${source}/?$`), names };
}

function withCors(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  Object.entries({ ...CORS_HEADERS, ...extraHeaders }).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function normalizeStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}
