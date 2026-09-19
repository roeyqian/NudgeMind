import { createId, json, readJson, requireUser } from '../../app/http.js';
import { normalizeProduct } from '../shop/service.js';
import { buildPrompt } from './prompts.js';
import { completeChat } from './provider.js';

const AI_TYPES = new Set(['seller', 'guardian']);

export async function chat({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const message = String(body.message || '').trim();
  const aiType = String(body.aiType || '');
  const productId = String(body.productId || '');
  if (!message || message.length > 800) throw { status: 400, message: '问题长度应为 1–800 字' };
  if (!AI_TYPES.has(aiType)) throw { status: 400, message: 'AI 角色无效' };

  const row = await env.nudge_mind_db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
  if (!row) throw { status: 404, message: '商品不存在' };
  const product = normalizeProduct(row);
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT role, content FROM (
      SELECT role, content, timestamp, rowid FROM ai_conversations
      WHERE user_id = ? AND product_id = ? AND ai_type = ?
      ORDER BY timestamp DESC, rowid DESC LIMIT 12
    ) ORDER BY timestamp, rowid
  `).bind(user.userId, productId, aiType).all();
  const history = results.map((item) => ({ role: item.role, content: item.content }));
  const response = await completeChat(env, buildPrompt(aiType, product), [...history, { role: 'user', content: message }], request.signal);

  await env.nudge_mind_db.batch([
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, product_id, timestamp)
      VALUES (?, ?, ?, 'user', ?, ?, datetime('now'))
    `).bind(createId('message'), user.userId, aiType, message, productId),
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, product_id, timestamp)
      VALUES (?, ?, ?, 'assistant', ?, ?, datetime('now'))
    `).bind(createId('message'), user.userId, aiType, response, productId),
  ]);
  return json({ response, aiType });
}

export async function getHistory({ request, env, url }) {
  const { user } = await requireUser(request, env);
  const productId = String(url.searchParams.get('productId') || '');
  const aiType = String(url.searchParams.get('aiType') || '');
  if (!productId || !AI_TYPES.has(aiType)) throw { status: 400, message: '缺少有效的商品或 AI 角色' };
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT role, content, timestamp FROM ai_conversations
    WHERE user_id = ? AND product_id = ? AND ai_type = ?
    ORDER BY timestamp, rowid LIMIT 100
  `).bind(user.userId, productId, aiType).all();
  return json({ messages: results });
}
