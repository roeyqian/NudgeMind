import { createId, createSession, json, readJson, requireUser, revokeSession } from '../../app/http.js';

const PASSWORD_ITERATIONS = 100_000;

export async function register({ request, env }) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (username.length < 2 || username.length > 40) throw { status: 400, message: '用户名长度应为 2–40 位' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw { status: 400, message: '请输入有效邮箱' };
  if (password.length < 8 || password.length > 128) throw { status: 400, message: '密码长度应为 8–128 位' };

  const existing = await env.nudge_mind_db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').bind(username, email).first();
  if (existing) throw { status: 409, message: '用户名或邮箱已存在' };

  const id = createId('user');
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);
  await env.nudge_mind_db.prepare(`
    INSERT INTO users (id, username, email, password_hash, salt, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(id, username, email, passwordHash, salt).run();

  const user = { id, username, email };
  const { token } = await createSession(user, env);
  return json({ token, user });
}

export async function login({ request, env }) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) throw { status: 400, message: '请输入用户名和密码' };

  const user = await env.nudge_mind_db.prepare('SELECT id, username, email, password_hash, salt FROM users WHERE username = ?').bind(username).first();
  if (!user || !constantTimeEqual(await hashPassword(password, user.salt), user.password_hash)) {
    throw { status: 401, message: '用户名或密码错误' };
  }

  await env.nudge_mind_db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
  const publicUser = { id: user.id, username: user.username, email: user.email };
  const { token } = await createSession(publicUser, env);
  return json({ token, user: publicUser });
}

export async function logout({ request, env }) {
  const { token } = await requireUser(request, env);
  await revokeSession(token, env);
  return json({ message: '已退出登录' });
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(saltHex),
    iterations: PASSWORD_ITERATIONS,
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  return Uint8Array.from(String(hex).match(/.{1,2}/g) || [], (pair) => Number.parseInt(pair, 16));
}
