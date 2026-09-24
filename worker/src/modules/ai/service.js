import { createId, json, readJson, requireUser } from '../../app/http.js';
import { normalizeProduct } from '../shop/service.js';
import { buildAdvisorPrompt, buildCheckoutGuardianPrompt, buildPrompt } from './prompts.js';
import { buildSummaryPrompt } from './summary-prompt.js';
import { completeChat } from './provider.js';

const AI_TYPES = new Set(['seller', 'guardian']);
const DEFAULT_SUMMARY_THRESHOLD_CHARS = 10_000;
const DEFAULT_RECENT_CONTEXT_CHARS = 4_000;
const MAX_SUMMARY_CHARS = 3_000;

export async function getAdvisorRecommendations({ request, env }) {
  await requireUser(request, env);
  const body = await readJson(request);
  const requirement = String(body.requirement || '').trim();
  const locale = body.locale === 'en' ? 'en' : 'zh';
  if (!requirement || requirement.length > 800) throw { status: 400, message: '需求长度应为 1–800 字' };

  const { results } = await env.nudge_mind_db.prepare(`
    SELECT p.*, c.name AS category_name,
      COALESCE(pt.name, p.name) AS name,
      COALESCE(pt.subtitle, p.subtitle) AS subtitle,
      COALESCE(pt.description, p.description) AS description,
      COALESCE(pt.specs_json, p.specs_json) AS specs_json,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    ORDER BY p.is_hot DESC, p.sales_count DESC, p.created_at DESC
    LIMIT 100
  `).bind(locale).all();
  const products = results.map(normalizeProduct);
  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    category: product.category_name,
    price: product.price,
    stock: product.stock,
    tags: product.tags,
    specs: product.specs,
  }));
  const rawResponse = await completeChat(env, buildAdvisorPrompt(catalog), [
    { role: 'user', content: requirement },
  ], request.signal, { temperature: 0.3, maxTokens: 700, jsonOutput: true });
  const parsed = parseJsonObject(rawResponse);
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.flatMap((item) => {
      const product = byId.get(String(item?.product_id || ''));
      if (!product || seen.has(product.id)) return [];
      seen.add(product.id);
      return [{ product, reason: String(item?.reason || '').trim().slice(0, 300) }];
    }).slice(0, 3)
    : [];
  if (!recommendations.length) throw { status: 502, message: 'AI 未返回可用的商品匹配结果' };

  return json({
    intro: String(parsed?.intro || '').trim().slice(0, 600),
    recommendations,
  });
}

export async function getCheckoutGuardianIntervention({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const locale = body.locale === 'en' ? 'en' : 'zh';
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT
      ci.id AS cart_item_id,
      ci.quantity,
      p.id,
      p.price,
      p.original_price,
      p.stock,
      p.rating,
      COALESCE(pt.name, p.name) AS name,
      COALESCE(pt.subtitle, p.subtitle) AS subtitle,
      COALESCE(pt.description, p.description) AS description,
      COALESCE(pt.specs_json, p.specs_json) AS specs_json,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    WHERE ci.user_id = ?
    ORDER BY ci.added_at
  `).bind(locale, user.userId).all();
  if (!results.length) throw { status: 400, message: '购物车为空' };

  const items = results.map((row) => {
    const product = normalizeProduct(row);
    return {
      cartItemId: row.cart_item_id,
      productId: product.id,
      name: product.name,
      quantity: Number(row.quantity),
      price: product.price,
      originalPrice: product.original_price,
      stock: product.stock,
      rating: product.rating,
      subtitle: product.subtitle,
      description: product.description,
      specs: product.specs,
      tags: product.tags,
    };
  });
  const rawResponse = await completeChat(env, buildCheckoutGuardianPrompt(items, locale), [
    { role: 'user', content: locale === 'en' ? 'Review this cart before checkout.' : '请在确认购买前审阅这个购物车。' },
  ], request.signal, { temperature: 0.25, maxTokens: 1_400, jsonOutput: true });
  const parsed = parseJsonObject(rawResponse);
  const recommendations = new Map(
    Array.isArray(parsed?.items)
      ? parsed.items.map((item) => [String(item?.product_id || ''), item])
      : [],
  );

  return json({
    message: String(parsed?.message || rawResponse || '').trim().slice(0, 1_200),
    items: items.map((item) => {
      const recommendation = recommendations.get(item.productId);
      return {
        cartItemId: item.cartItemId,
        productId: item.productId,
        shouldRemove: Boolean(recommendation?.should_remove),
        reason: String(recommendation?.reason || '').trim().slice(0, 500),
      };
    }),
  });
}

export async function chat({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const message = String(body.message || '').trim();
  const aiType = String(body.aiType || '');
  const productId = String(body.productId || '');
  const locale = body.locale === 'en' ? 'en' : 'zh';
  if (!message || message.length > 800) throw { status: 400, message: '问题长度应为 1–800 字' };
  if (!AI_TYPES.has(aiType)) throw { status: 400, message: 'AI 角色无效' };

  const row = await env.nudge_mind_db.prepare(`
    SELECT p.*,
      COALESCE(pt.name, p.name) AS name,
      COALESCE(pt.subtitle, p.subtitle) AS subtitle,
      COALESCE(pt.description, p.description) AS description,
      COALESCE(pt.specs_json, p.specs_json) AS specs_json,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM products p
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    WHERE p.id = ?
  `).bind(locale, productId).first();
  if (!row) throw { status: 404, message: '商品不存在' };
  const product = normalizeProduct(row);
  const context = await loadConversationContext(env, user.userId, productId, aiType, product, message, locale, request.signal);
  const rawResponse = await completeChat(env, buildPrompt(aiType, product, locale), [
    ...summaryAsContextMessage(context.summary, locale),
    ...context.history,
    { role: 'user', content: message },
  ], request.signal, { jsonOutput: true });
  const aiResult = parseAiResponse(rawResponse, product);

  await env.nudge_mind_db.batch([
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, product_id, timestamp)
      VALUES (?, ?, ?, 'user', ?, ?, datetime('now'))
    `).bind(createId('message'), user.userId, aiType, message, productId),
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, metadata_json, product_id, timestamp)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?, datetime('now'))
    `).bind(createId('message'), user.userId, aiType, aiResult.response, JSON.stringify(aiResult.ui), productId),
  ]);
  return json({ response: aiResult.response, aiType, ...aiResult.ui });
}

async function loadConversationContext(env, userId, productId, aiType, product, nextMessage, locale, signal) {
  const summaryRow = await env.nudge_mind_db.prepare(`
    SELECT summary, summarized_until_rowid FROM ai_conversation_summaries
    WHERE user_id = ? AND product_id = ? AND ai_type = ?
  `).bind(userId, productId, aiType).first();
  const summary = String(summaryRow?.summary || '').trim();
  const summarizedUntil = Number(summaryRow?.summarized_until_rowid || 0);
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT rowid, role, content FROM ai_conversations
    WHERE user_id = ? AND product_id = ? AND ai_type = ? AND rowid > ?
    ORDER BY timestamp, rowid
  `).bind(userId, productId, aiType, summarizedUntil).all();
  const history = results.map((item) => ({ ...item, content: String(item.content || '') }));
  const threshold = readContextLimit(env.AI_CONTEXT_SUMMARY_THRESHOLD, DEFAULT_SUMMARY_THRESHOLD_CHARS);
  const recentLimit = Math.min(
    threshold - 1,
    readContextLimit(env.AI_CONTEXT_RECENT_CHARS, DEFAULT_RECENT_CONTEXT_CHARS),
  );

  if (contextLength(summary, history, nextMessage) <= threshold) {
    return { summary, history: stripRowId(history) };
  }

  const { older, recent } = splitHistoryForSummary(history, recentLimit);
  if (!older.length) return { summary, history: stripRowId(history) };

  const nextSummary = await completeChat(env, buildSummaryPrompt(aiType, product, locale), [
    ...summaryAsContextMessage(summary, locale),
    ...stripRowId(older),
  ], signal, { temperature: 0.2, maxTokens: 700 });
  const normalizedSummary = nextSummary.slice(0, MAX_SUMMARY_CHARS).trim();
  if (!normalizedSummary) throw { status: 502, message: 'AI 对话摘要未返回有效内容' };

  await env.nudge_mind_db.prepare(`
    INSERT INTO ai_conversation_summaries
      (user_id, product_id, ai_type, summary, summarized_until_rowid, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, product_id, ai_type) DO UPDATE SET
      summary = excluded.summary,
      summarized_until_rowid = excluded.summarized_until_rowid,
      updated_at = excluded.updated_at
  `).bind(userId, productId, aiType, normalizedSummary, older.at(-1).rowid).run();

  return { summary: normalizedSummary, history: stripRowId(recent) };
}

function summaryAsContextMessage(summary, locale) {
  const value = String(summary || '').trim();
  if (!value) return [];
  const instruction = locale === 'en'
    ? `The following is a summary of the earlier conversation. Use it as context and continue the current conversation:\n${value}`
    : `以下是此前对话的摘要；将其作为背景信息，继续当前对话：\n${value}`;
  return [{ role: 'system', content: instruction }];
}

function splitHistoryForSummary(history, recentLimit) {
  const recent = [];
  let recentChars = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const itemChars = item.content.length;
    if (recent.length && recentChars + itemChars > recentLimit) break;
    recent.unshift(item);
    recentChars += itemChars;
  }
  return { older: history.slice(0, history.length - recent.length), recent };
}

function contextLength(summary, history, nextMessage) {
  return String(summary || '').length
    + String(nextMessage || '').length
    + history.reduce((total, item) => total + item.content.length, 0);
}

function stripRowId(history) {
  return history.map(({ role, content }) => ({ role, content }));
}

function readContextLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(1_000, Math.min(50_000, number)) : fallback;
}

export async function getHistory({ request, env, url }) {
  const { user } = await requireUser(request, env);
  const productId = String(url.searchParams.get('productId') || '');
  const aiType = String(url.searchParams.get('aiType') || '');
  if (!productId || !AI_TYPES.has(aiType)) throw { status: 400, message: '缺少有效的商品或 AI 角色' };
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT role, content, metadata_json, timestamp FROM ai_conversations
    WHERE user_id = ? AND product_id = ? AND ai_type = ?
    ORDER BY timestamp, rowid LIMIT 100
  `).bind(user.userId, productId, aiType).all();
  return json({ messages: results.map((item) => ({
    role: item.role,
    content: item.content,
    ...parseStoredUi(item.metadata_json),
    timestamp: item.timestamp,
  })) });
}

export async function deleteHistory({ request, env, url }) {
  const { user } = await requireUser(request, env);
  const productId = String(url.searchParams.get('productId') || '');
  const aiType = String(url.searchParams.get('aiType') || '');
  if (!productId || !AI_TYPES.has(aiType)) throw { status: 400, message: '缺少有效的商品或 AI 角色' };
  await env.nudge_mind_db.batch([
    env.nudge_mind_db.prepare(`
      DELETE FROM ai_conversations WHERE user_id = ? AND product_id = ? AND ai_type = ?
    `).bind(user.userId, productId, aiType),
    env.nudge_mind_db.prepare(`
      DELETE FROM ai_conversation_summaries WHERE user_id = ? AND product_id = ? AND ai_type = ?
    `).bind(user.userId, productId, aiType),
  ]);
  return json({ success: true });
}

export async function getAllHistory({ request, env, url }) {
  const { user } = await requireUser(request, env);
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh';
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT
      ai_conversations.role,
      ai_conversations.content,
      ai_conversations.ai_type,
      ai_conversations.product_id,
      ai_conversations.timestamp,
      COALESCE(product_translations.name, products.name) AS product_name
    FROM ai_conversations
    JOIN products ON products.id = ai_conversations.product_id
    LEFT JOIN product_translations ON product_translations.product_id = products.id AND product_translations.locale = ?
    WHERE ai_conversations.user_id = ?
    ORDER BY ai_conversations.timestamp DESC, ai_conversations.rowid DESC
    LIMIT 500
  `).bind(locale, user.userId).all();
  return json({ messages: results.map((item) => ({
    role: item.role,
    content: item.content,
    aiType: item.ai_type,
    productId: item.product_id,
    productName: item.product_name,
    timestamp: item.timestamp,
  })) });
}

function parseAiResponse(rawResponse, product) {
  const parsed = parseJsonObject(rawResponse);
  const response = String(parsed?.response || rawResponse || '').trim().slice(0, 2_000);
  if (!response) throw { status: 502, message: 'AI 服务未返回有效内容' };

  const stock = Number(product.stock || 0);
  const salesCount = Number(product.sales_count || 0);
  const price = Number(product.price || 0);
  const originalPrice = Number(product.original_price || 0);
  return {
    response,
    ui: {
      add_to_cart: Boolean(parsed?.add_to_cart) && stock > 0,
      scarcity: Boolean(parsed?.scarcity) && stock >= 1 && stock <= 5,
      social_proof: Boolean(parsed?.social_proof) && salesCount > 0,
      price_anchor: Boolean(parsed?.price_anchor) && originalPrice > price,
    },
  };
}

function parseStoredUi(value) {
  const parsed = parseJsonObject(value);
  return {
    add_to_cart: Boolean(parsed?.add_to_cart),
    scarcity: Boolean(parsed?.scarcity),
    social_proof: Boolean(parsed?.social_proof),
    price_anchor: Boolean(parsed?.price_anchor),
  };
}

function parseJsonObject(value) {
  const source = String(value || '').trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '');
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
