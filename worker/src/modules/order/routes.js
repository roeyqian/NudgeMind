import { createOrder, getOrders } from './service.js';

export default function registerOrderRoutes(router) {
  router.add('POST', '/api/orders', createOrder);
  router.add('GET', '/api/orders', getOrders);
}
