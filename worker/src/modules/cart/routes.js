import { addToCart, getCart, removeCartItem, updateCartItem } from './service.js';

export default function registerCartRoutes(router) {
  router.add('GET', '/api/cart', getCart);
  router.add('POST', '/api/cart', addToCart);
  router.add('PUT', '/api/cart/:itemId', updateCartItem);
  router.add('DELETE', '/api/cart/:itemId', removeCartItem);
}
