import { createId, json, readJson, requireUser } from '../../app/http.js';

export async function getCart({ request, env, url }) {
  const { user } = await requireUser(request, env);
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh';
  const { results } = await env.nudge_mind_db.prepare(`
    SELECT ci.id, ci.product_id, ci.quantity, ci.added_at, COALESCE(pt.name, p.name) AS name, p.price, p.stock
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
    WHERE ci.user_id = ? ORDER BY ci.added_at DESC
  `).bind(locale, user.userId).all();
  const items = results.map((item) => ({ ...item, image_url: `/api/products/${encodeURIComponent(item.product_id)}/image?v=icon-label-v2` }));
  return json({ items, total: items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0) });
}

export async function addToCart({ request, env }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const productId = String(body.productId || '');
  const quantity = parseQuantity(body.quantity, 1);
  const product = await env.nudge_mind_db.prepare('SELECT id, stock FROM products WHERE id = ?').bind(productId).first();
  if (!product) throw { status: 404, message: '商品不存在' };

  const existing = await env.nudge_mind_db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').bind(user.userId, productId).first();
  const finalQuantity = Number(existing?.quantity || 0) + quantity;
  if (finalQuantity > Number(product.stock)) throw { status: 400, message: '商品库存不足' };

  if (existing) {
    await env.nudge_mind_db.prepare("UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").bind(finalQuantity, existing.id).run();
  } else {
    await env.nudge_mind_db.prepare(`
      INSERT INTO cart_items (id, user_id, product_id, quantity, added_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(createId('cart'), user.userId, productId, quantity).run();
  }
  return json({ message: '已加入购物车' }, 201);
}

export async function updateCartItem({ request, env, params }) {
  const { user } = await requireUser(request, env);
  const body = await readJson(request);
  const quantity = parseQuantity(body.quantity);
  const item = await env.nudge_mind_db.prepare(`
    SELECT ci.id, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.id = ? AND ci.user_id = ?
  `).bind(params.itemId, user.userId).first();
  if (!item) throw { status: 404, message: '购物车商品不存在' };
  if (quantity > Number(item.stock)) throw { status: 400, message: '商品库存不足' };
  await env.nudge_mind_db.prepare("UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").bind(quantity, item.id).run();
  return json({ message: '购物车已更新' });
}

export async function removeCartItem({ request, env, params }) {
  const { user } = await requireUser(request, env);
  const item = await env.nudge_mind_db.prepare('SELECT id FROM cart_items WHERE id = ? AND user_id = ?').bind(params.itemId, user.userId).first();
  if (!item) throw { status: 404, message: '购物车商品不存在' };
  await env.nudge_mind_db.prepare('DELETE FROM cart_items WHERE id = ?').bind(item.id).run();
  return json({ message: '已移除商品' });
}

function parseQuantity(value, fallback) {
  const quantity = value == null && fallback ? fallback : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw { status: 400, message: '商品数量必须是 1–99 的整数' };
  return quantity;
}
