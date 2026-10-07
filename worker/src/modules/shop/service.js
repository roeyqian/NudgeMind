import { json } from '../../app/http.js';
import { researchProfile } from '../ai/research-patterns.mjs';

export async function getProducts({ env, url }) {
  const locale = requestedLocale(url);
  const category = String(url.searchParams.get('category') || '').trim();
  const search = String(url.searchParams.get('search') || '').trim();
  const sort = String(url.searchParams.get('sort') || 'default').trim();
  const limit = clampInteger(url.searchParams.get('limit'), 24, 1, 100);
  const offset = clampInteger(url.searchParams.get('offset'), 0, 0, 10_000);
  const clauses = ['1 = 1'];
  const bindings = [];
  if (category) {
    clauses.push('p.category_id = ?');
    bindings.push(category);
  }
  if (search) {
    clauses.push('(p.name LIKE ? OR p.subtitle LIKE ? OR p.description LIKE ? OR p.tags_json LIKE ? OR pt.name LIKE ? OR pt.subtitle LIKE ? OR pt.description LIKE ? OR pt.tags_json LIKE ?)');
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const where = clauses.join(' AND ');
  const orderBy = productOrder(sort);
  const count = await env.nudge_mind_db.prepare(`
    SELECT COUNT(*) AS total FROM products p
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    WHERE ${where}
  `).bind(locale, ...bindings).first();
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
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).bind(locale, ...bindings, limit, offset).all();

  return json({
    products: results.map(normalizeProduct),
    total: Number(count?.total || 0),
    pageInfo: { limit, offset, hasMore: offset + results.length < Number(count?.total || 0) },
  });
}

function productOrder(sort) {
  return {
    name: 'p.name COLLATE NOCASE ASC, p.id ASC',
    'price-asc': 'p.price ASC, p.name COLLATE NOCASE ASC, p.id ASC',
    'price-desc': 'p.price DESC, p.name COLLATE NOCASE ASC, p.id ASC',
  }[sort] || 'p.is_hot DESC, p.sales_count DESC, p.created_at DESC';
}

export async function getProduct({ env, params, url }) {
  const locale = requestedLocale(url);
  const product = await env.nudge_mind_db.prepare(`
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
    WHERE p.id = ?
  `).bind(locale, params.id).first();
  if (!product) throw { status: 404, message: '商品不存在' };
  return json({ product: normalizeProduct(product) });
}

function requestedLocale(url) {
  return url.searchParams.get('locale') === 'en' ? 'en' : 'zh';
}

export async function getCategories({ env }) {
  const { results } = await env.nudge_mind_db.prepare('SELECT id, name, icon, sort_order FROM categories ORDER BY sort_order, name').all();
  return json({ categories: results });
}

export async function getProductImage({ env, params, url }) {
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh';
  const product = await env.nudge_mind_db.prepare(`
    SELECT COALESCE(pt.name, p.name) AS name, p.category_id,
      COALESCE(pt.tags_json, p.tags_json) AS tags_json
    FROM products p
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    WHERE p.id = ?
  `).bind(locale, params.id).first();
  if (!product) throw { status: 404, message: '商品不存在' };
  const palette = {
    cat_digital: ['#b7c9c1', '#24483a'],
    cat_fashion: ['#d9c9bc', '#663f31'],
    cat_home: ['#c8d5b9', '#3f5938'],
    cat_beauty: ['#e7c9c5', '#7a4047'],
    cat_food: ['#e7d2a5', '#674c25'],
  }[product.category_id] || ['#d5d8d0', '#34443d'];
  const name = escapeXml(product.name);
  const iconLabel = getProductIconLabel(product);
  const label = escapeXml(iconLabel);
  const labelSize = Math.min(210, Math.floor(340 / Math.max(1, Array.from(iconLabel).length)));
  const nameWidthUnits = Array.from(product.name).reduce((width, character) => width + (/^[\u0000-\u00ff]$/u.test(character) ? 0.7 : 1), 0);
  const nameFontSize = Math.min(28, Math.floor(700 / Math.max(1, nameWidthUnits)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 680" role="img" aria-label="${name}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="#f5f1e7"/></linearGradient></defs>
    <rect width="800" height="680" fill="url(#g)"/>
    <circle cx="640" cy="110" r="190" fill="none" stroke="${palette[1]}" stroke-opacity=".12" stroke-width="2"/>
    <circle cx="640" cy="110" r="135" fill="none" stroke="${palette[1]}" stroke-opacity=".1" stroke-width="2"/>
    <rect x="205" y="115" width="390" height="390" rx="96" fill="${palette[1]}" opacity=".94"/>
    <text x="400" y="350" text-anchor="middle" font-family="Arial,sans-serif" font-size="${labelSize}" font-weight="700" fill="#f8f2e6">${label}</text>
    <text x="400" y="585" text-anchor="middle" font-family="Arial,sans-serif" font-size="${nameFontSize}" font-weight="700" fill="${palette[1]}">${name}</text>
  </svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" } });
}

export function normalizeProduct(product) {
  return {
    ...product,
    research: researchProfile(product),
    image_url: productImageUrl(product.id),
    specs: parseJson(product.specs_json, {}),
    tags: parseJson(product.tags_json, []),
    is_hot: Boolean(product.is_hot),
    is_new: Boolean(product.is_new),
  };
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || '') || fallback; } catch { return fallback; }
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function getProductIconLabel(product) {
  const tags = parseJson(product.tags_json, []);
  const firstTag = Array.isArray(tags) && tags.find((tag) => typeof tag === 'string' && tag.trim());
  if (firstTag) return firstTag.trim();

  const name = String(product.name || '').trim();
  const withoutSpecification = name.replace(/\s+\d+(?:[.\d]*\s*)?(?:袋|盒|片|个|支|ml|g|kg|L|英寸)?\s*$/iu, '');
  return Array.from(withoutSpecification || name || '商品').slice(-4).join('');
}

function productImageUrl(productId) {
  return `/api/products/${encodeURIComponent(productId)}/image?v=real-catalog-v1`;
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
}
