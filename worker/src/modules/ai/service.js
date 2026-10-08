import { createId, json, readJson, requireUser } from '../../app/http.js';
import { normalizeProduct } from '../shop/service.js';
import { buildAdvisorPrompt, buildCheckoutGuardianPrompt, buildPrompt } from './prompts.js';
import { buildSummaryPrompt } from './summary-prompt.js';
import { completeChat } from './provider.js';
import { buildResearchStimuli, enrichPattern } from './research-patterns.mjs';

const AI_TYPES = new Set(['seller', 'guardian']);
const DEFAULT_SUMMARY_THRESHOLD_CHARS = 10_000;
const DEFAULT_RECENT_CONTEXT_CHARS = 4_000;

export async function recordResearchExposure({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const locale = body.locale === 'en' ? 'en' : 'zh';
  const product = await env.nudge_mind_db.prepare('SELECT id, price FROM products WHERE id = ?')
    .bind(String(body.productId || '')).first();
  if (!product) throw { status: 404, message: '商品不存在' };
  const stimulus = buildResearchStimuli(product, locale).find((item) => item.id === body.stimulusId);
  if (!stimulus || stimulus.evidenceText !== body.evidenceText) {
    throw { status: 400, message: '研究情境证据无效，请重新打开商品详情' };
  }
  await env.nudge_mind_db.prepare(`
    INSERT INTO research_exposures
      (id, user_id, product_id, stimulus_id, version, pattern_type, evidence_text, stage, locale)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, stimulus_id) DO NOTHING
  `).bind(createId('exposure'), user.userId, product.id, stimulus.id, stimulus.version,
    stimulus.type, stimulus.evidenceText, stimulus.stage, locale).run();
  return json({ recorded: true });
}

export async function getAdvisorRecommendations({ request, env }) {
  await requireUser(request, env);
  const body = await readJson(request);
  const requirement = String(body.requirement || '').trim();
  const locale = body.locale === 'en' ? 'en' : 'zh';
  if (!requirement) throw { status: 400, message: '请填写需求' };

  const { results } = await env.nudge_mind_db.prepare(`
    SELECT p.*, c.name AS category_name,
      ps.brand, ps.model, ps.source_url, ps.source_checked_at, ps.content_basis, ps.price_basis,
      COALESCE(pt.name, p.name) AS name,
      COALESCE(pt.subtitle, p.subtitle) AS subtitle,
      COALESCE(pt.description, p.description) AS description,
      COALESCE(pt.specs_json, p.specs_json) AS specs_json,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_sources ps ON ps.product_id = p.id
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    ORDER BY p.is_hot DESC, p.sales_count DESC, p.created_at DESC
    LIMIT 100
  `).bind(locale).all();
  const products = results.map(normalizeProduct);
  const catalog = products.map((product) => ({
    id: product.id,
    brand: product.brand,
    model: product.model,
    sourceUrl: product.source_url,
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
  ], request.signal, { temperature: 0.3, jsonOutput: true });
  const parsed = parseJsonObject(rawResponse);
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.flatMap((item) => {
      const product = byId.get(String(item?.product_id || ''));
      if (!product || seen.has(product.id)) return [];
      seen.add(product.id);
      return [{ product, reason: String(item?.reason || '').trim() }];
    }).slice(0, 3)
    : [];
  if (!recommendations.length) throw { status: 502, message: 'AI 未返回可用的商品匹配结果' };

  return json({
    intro: String(parsed?.intro || '').trim(),
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
      p.sales_count,
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

  const [sellerMessages, storedPatterns, exposures, userNeeds] = await Promise.all([
    env.nudge_mind_db.prepare(`
      SELECT ac.id, ac.product_id, ac.content
      FROM ai_conversations ac
      JOIN cart_items ci ON ci.product_id = ac.product_id AND ci.user_id = ac.user_id
      WHERE ac.user_id = ? AND ac.ai_type = 'seller' AND ac.role = 'assistant'
      ORDER BY ac.timestamp DESC, ac.rowid DESC
    `).bind(user.userId).all(),
    env.nudge_mind_db.prepare(`
      SELECT pe.product_id, pe.message_id, pe.pattern_type, pe.evidence_text
      FROM pattern_events pe
      JOIN ai_conversations ac ON ac.id = pe.message_id
      JOIN cart_items ci ON ci.product_id = pe.product_id AND ci.user_id = pe.user_id
      WHERE pe.user_id = ? AND ac.ai_type = 'seller' AND ac.role = 'assistant'
      ORDER BY pe.created_at DESC, pe.rowid DESC
    `).bind(user.userId).all(),
    env.nudge_mind_db.prepare(`
      SELECT re.* FROM research_exposures re
      JOIN cart_items ci ON ci.product_id = re.product_id AND ci.user_id = re.user_id
      WHERE re.user_id = ? ORDER BY re.created_at, re.rowid
    `).bind(user.userId).all(),
    env.nudge_mind_db.prepare(`
      SELECT ac.id, ac.product_id, ac.content FROM ai_conversations ac
      JOIN cart_items ci ON ci.product_id = ac.product_id AND ci.user_id = ac.user_id
      WHERE ac.user_id = ? AND ac.role = 'user'
      ORDER BY ac.timestamp DESC, ac.rowid DESC
    `).bind(user.userId).all(),
  ]);
  const messagesByProduct = new Map();
  for (const message of sellerMessages.results) {
    const list = messagesByProduct.get(message.product_id) || [];
    list.push(message);
    messagesByProduct.set(message.product_id, list);
  }
  const patternsByProduct = new Map();
  for (const event of storedPatterns.results) {
    const list = patternsByProduct.get(event.product_id) || [];
    list.push({ type: event.pattern_type, evidenceText: event.evidence_text, messageId: event.message_id });
    patternsByProduct.set(event.product_id, list);
  }
  // Older seller replies predate pattern_events; still surface their exact wording at checkout.
  for (const message of sellerMessages.results) {
    const list = patternsByProduct.get(message.product_id) || [];
    for (const pattern of detectPatternSentences(message.content)) {
      if (!list.some((entry) => entry.messageId === message.id && entry.type === pattern.type && entry.evidenceText === pattern.evidenceText)) {
        list.push({ ...pattern, messageId: message.id });
      }
    }
    patternsByProduct.set(message.product_id, list);
  }

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
      dataBasis: 'Cart prices, inventory, ratings and engagement are research simulation data, not live retailer data. Stock controls availability in this simulation only.',
      subtitle: product.subtitle,
      description: product.description,
      specs: product.specs,
      tags: product.tags,
      researchConfiguration: product.research,
      hasSellerChat: (messagesByProduct.get(product.id) || []).length > 0,
      sellerPatterns: (patternsByProduct.get(product.id) || []).slice(0, 12)
        .map((pattern) => enrichPattern({ ...pattern, evidenceStatus: 'seller-message-cue-not-proof-of-deception' }, locale)),
      productPatterns: exposures.results.filter((entry) => entry.product_id === product.id)
        .map((entry) => enrichPattern({ type: entry.pattern_type, evidenceText: entry.evidence_text,
          exposureId: entry.id, stimulusId: entry.stimulus_id, version: entry.version,
          stage: entry.stage, observedAt: entry.created_at, evidenceLocale: entry.locale,
          evidenceStatus: 'client-reported-visible-synthetic-stimulus', modality: 'text+visual' }, locale)),
      possibleProductCues: getProductPatterns(product, locale),
      userStatements: userNeeds.results.filter((entry) => entry.product_id === product.id)
        .slice(0, 6).map((entry) => ({ messageId: entry.id, text: String(entry.content).slice(0, 1500) })),
    };
  });
  // Review small groups without imposing an output token limit.
  const reviews = [];
  for (let offset = 0; offset < items.length; offset += 3) {
    reviews.push(await reviewCheckoutBatch(env, items.slice(offset, offset + 3), locale, request.signal));
  }
  const recommendations = new Map(
    reviews.flatMap((review) => review.items.map((item) => [item.product_id, item])),
  );

  return json({
    message: [...new Set(reviews.map((review) => review.message.trim()))].join('\n\n'),
    items: items.map((item) => {
      const recommendation = recommendations.get(item.productId);
      return {
        cartItemId: item.cartItemId,
        productId: item.productId,
        shouldRemove: recommendation.should_remove === true,
        reason: String(recommendation?.reason || '').trim(),
        hasSellerChat: item.hasSellerChat,
        sellerPatterns: item.sellerPatterns,
        productPatterns: item.productPatterns,
      };
    }),
  });
}

async function reviewCheckoutBatch(env, items, locale, signal) {
  const messages = [
    { role: 'user', content: locale === 'en' ? 'Review this cart before checkout.' : '请在确认购买前审阅这个购物车。' },
  ];
  const productIds = new Set(items.map((item) => item.productId));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rawResponse = await completeChat(env, buildCheckoutGuardianPrompt(items, locale), messages, signal, {
        temperature: 0.25,
        jsonOutput: true,
      });
      const parsed = parseJsonObject(rawResponse);
      if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim() || !Array.isArray(parsed.items)
        || parsed.items.length !== items.length
        || new Set(parsed.items.map((item) => item?.product_id)).size !== items.length
        || parsed.items.some((entry) => !productIds.has(entry?.product_id)
          || typeof entry.should_remove !== 'boolean' || typeof entry.reason !== 'string' || !entry.reason.trim())) {
        throw { status: 502, code: 'AI_CHECKOUT_INVALID_RESPONSE', message: 'AI 未返回完整的购买分析，请重试' };
      }
      return parsed;
    } catch (error) {
      const retryable = ['AI_OUTPUT_TRUNCATED', 'AI_CHECKOUT_INVALID_RESPONSE'].includes(error?.code);
      if (attempt > 0 || !retryable || signal?.aborted) throw error;
      messages.push({ role: 'user', content: locale === 'en'
        ? 'The previous response was incomplete. Return valid JSON with every supplied product ID exactly once. Keep each reason concise while covering evidence, mechanism, uncertainty and a verification action.'
        : '上次回复不完整。请返回有效 JSON，每个提供的商品 ID 恰好出现一次。每项理由简洁覆盖证据、机制、不确定性和核验建议。' });
    }
  }
}

export async function chat({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const message = String(body.message || '').trim();
  const aiType = String(body.aiType || '');
  const productId = String(body.productId || '');
  const locale = body.locale === 'en' ? 'en' : 'zh';
  if (!message) throw { status: 400, message: '请输入问题' };
  if (!AI_TYPES.has(aiType)) throw { status: 400, message: 'AI 角色无效' };

  const row = await env.nudge_mind_db.prepare(`
    SELECT p.*, ps.brand, ps.model, ps.source_url, ps.source_checked_at, ps.content_basis, ps.price_basis,
      COALESCE(pt.name, p.name) AS name,
      COALESCE(pt.subtitle, p.subtitle) AS subtitle,
      COALESCE(pt.description, p.description) AS description,
      COALESCE(pt.specs_json, p.specs_json) AS specs_json,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM products p
    LEFT JOIN product_sources ps ON ps.product_id = p.id
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
  if (aiType === 'guardian') {
    aiResult.ui.scarcity = false;
    aiResult.ui.social_proof = false;
    aiResult.ui.price_anchor = false;
  }
  const assistantMessageId = createId('message');
  const patterns = aiType === 'seller' ? detectSellerPatterns(aiResult, product, locale) : [];

  await env.nudge_mind_db.batch([
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, product_id, timestamp)
      VALUES (?, ?, ?, 'user', ?, ?, datetime('now'))
    `).bind(createId('message'), user.userId, aiType, message, productId),
    env.nudge_mind_db.prepare(`
      INSERT INTO ai_conversations (id, user_id, ai_type, role, content, metadata_json, product_id, timestamp)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?, datetime('now'))
    `).bind(assistantMessageId, user.userId, aiType, aiResult.response, JSON.stringify(aiResult.ui), productId),
    ...patterns.map((pattern) => env.nudge_mind_db.prepare(`
      INSERT INTO pattern_events (id, user_id, product_id, message_id, pattern_type, evidence_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(createId('pattern'), user.userId, productId, assistantMessageId, pattern.type, pattern.evidenceText)),
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
  ], signal, { temperature: 0.2 });
  const normalizedSummary = nextSummary.trim();
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
  const response = String(parsed?.response || rawResponse || '').trim();
  if (!response) throw { status: 502, code: 'AI_EMPTY_RESPONSE', message: 'AI 服务未返回有效内容' };

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

const PATTERN_MATCHERS = {
  scarcity: /仅剩|只剩|库存紧张|库存不多|快(?:要)?售罄|所剩无几|limited stock|only\s+\d+\s+(?:items?\s+)?left|almost sold out/iu,
  social_proof: /(?:已有|很多|许多|不少|大量).{0,18}(?:人|位|用户|顾客).{0,18}(?:购买|买了|下单|选择)|热销|畅销|best.?sell|popular choice|people (?:have )?bought/iu,
  price_anchor: /原价|划线价|参考价|现价|折扣|立省|省下|original price|regular price|was\s*[¥$£]?\s*\d|now\s*[¥$£]?\s*\d|save\s*[¥$£]?\s*\d/iu,
};

function detectPatternSentences(content) {
  const sentences = String(content || '').split(/(?<=[。！？!?\n])|(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.flatMap((evidenceText) => Object.entries(PATTERN_MATCHERS)
    .filter(([, matcher]) => matcher.test(evidenceText))
    .map(([type]) => ({ type, evidenceText })));
}

function detectSellerPatterns(aiResult, product, locale) {
  const patterns = detectPatternSentences(aiResult.response);
  const ui = aiResult.ui;
  const english = locale === 'en';
  const displayedPrompts = [
    ui.scarcity && { type: 'scarcity', evidenceText: english
      ? `Low stock: only ${product.stock} left` : `库存紧张：仅剩 ${product.stock} 件` },
    ui.social_proof && { type: 'social_proof', evidenceText: english
      ? `${product.sales_count} people have bought this item` : `已有 ${product.sales_count} 人购买这件商品` },
    ui.price_anchor && { type: 'price_anchor', evidenceText: english
      ? `Was ¥${formatPrice(product.original_price)}; now ¥${formatPrice(product.price)}`
      : `参考原价 ¥${formatPrice(product.original_price)}，当前 ¥${formatPrice(product.price)}` },
  ].filter(Boolean);
  return [...patterns, ...displayedPrompts].filter((pattern, index, all) =>
    all.findIndex((candidate) => candidate.type === pattern.type && candidate.evidenceText === pattern.evidenceText) === index);
}

function getProductPatterns(product, locale) {
  const english = locale === 'en';
  const patterns = [product.subtitle, product.description, ...(Array.isArray(product.tags) ? product.tags : [])]
    .flatMap(detectPatternSentences);
  if (Number(product.stock) >= 1 && Number(product.stock) <= 5) {
    patterns.push({ type: 'scarcity', evidenceText: english
      ? `In stock: ${product.stock}` : `库存 ${product.stock} 件` });
  }
  if (Number(product.sales_count) > 0) {
    patterns.push({ type: 'social_proof', evidenceText: english
      ? `${product.sales_count} followers` : `${product.sales_count} 人关注` });
  }
  if (Number(product.original_price) > Number(product.price)) {
    patterns.push({ type: 'price_anchor', evidenceText: english
      ? `¥${formatPrice(product.price)} (was ¥${formatPrice(product.original_price)})`
      : `¥${formatPrice(product.price)}（原价 ¥${formatPrice(product.original_price)}）` });
  }
  return patterns.filter((pattern, index, all) =>
    all.findIndex((candidate) => candidate.type === pattern.type && candidate.evidenceText === pattern.evidenceText) === index);
}

function formatPrice(value) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
