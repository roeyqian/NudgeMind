import { createId, json, readJson, requireUser } from '../../app/http.js';

export async function createOrder({ request, env }) {
  const { user } = await requireUser(request, env);
  const { shippingAddress } = await readJson(request);
  validateAddress(shippingAddress);

  const { results: cartItems } = await env.nudge_mind_db.prepare(`
    SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ? ORDER BY ci.added_at
  `).bind(user.userId).all();
  if (!cartItems.length) throw { status: 400, message: '购物车为空' };

  for (const item of cartItems) {
    if (Number(item.quantity) > Number(item.stock)) throw { status: 409, message: `${item.name} 库存不足，请返回购物车调整` };
  }

  const orderId = createId('order');
  const orderNo = `NM${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const totalAmount = cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const statements = [
    env.nudge_mind_db.prepare(`
      INSERT INTO orders (id, order_no, user_id, total_amount, final_amount, status, shipping_address_json, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, datetime('now'), datetime('now'))
    `).bind(orderId, orderNo, user.userId, totalAmount, totalAmount, JSON.stringify(shippingAddress)),
    ...cartItems.flatMap((item) => [
      env.nudge_mind_db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, product_image, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        createId('order_item'), orderId, item.product_id, item.name,
        `/api/products/${encodeURIComponent(item.product_id)}/image`, Number(item.price), Number(item.quantity),
        Number(item.price) * Number(item.quantity),
      ),
      env.nudge_mind_db.prepare('UPDATE products SET stock = stock - ?, updated_at = datetime(\'now\') WHERE id = ? AND stock >= ?')
        .bind(Number(item.quantity), item.product_id, Number(item.quantity)),
    ]),
    env.nudge_mind_db.prepare('DELETE FROM cart_items WHERE user_id = ?').bind(user.userId),
  ];
  await env.nudge_mind_db.batch(statements);
  return json({ orderId, orderNo, totalAmount, status: 'completed' }, 201);
}

export async function getOrders({ request, env }) {
  const { user } = await requireUser(request, env);
  const { results: orders } = await env.nudge_mind_db.prepare(`
    SELECT id, order_no, total_amount, final_amount, status, created_at
    FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).bind(user.userId).all();
  if (!orders.length) return json({ orders: [] });

  const placeholders = orders.map(() => '?').join(',');
  const { results: items } = await env.nudge_mind_db.prepare(`
    SELECT id, order_id, product_id, product_name, product_image, price, quantity, subtotal
    FROM order_items WHERE order_id IN (${placeholders}) ORDER BY rowid
  `).bind(...orders.map((order) => order.id)).all();
  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }
  return json({ orders: orders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) || [] })) });
}

function validateAddress(value) {
  if (!value || typeof value !== 'object') throw { status: 400, message: '请填写购买信息' };
  const name = String(value.name || '').trim();
  const phone = String(value.phone || '').trim();
  const address = String(value.address || '').trim();
  if (!name || !phone || !address) throw { status: 400, message: '姓名、联系电话和地址均不能为空' };
  if (name.length > 50 || phone.length > 30 || address.length > 200) throw { status: 400, message: '购买信息长度超出限制' };
}
