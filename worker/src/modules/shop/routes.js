import { getCategories, getProduct, getProductImage, getProducts } from './service.js';

export default function registerShopRoutes(router) {
  router.add('GET', '/api/categories', getCategories);
  router.add('GET', '/api/products', getProducts);
  router.add('GET', '/api/products/:id', getProduct);
  router.add('GET', '/api/products/:id/image', getProductImage);
}
