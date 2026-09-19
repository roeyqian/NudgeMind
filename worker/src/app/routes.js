import { createRouter } from './http.js';
import registerAuthRoutes from '../modules/auth/routes.js';
import registerShopRoutes from '../modules/shop/routes.js';
import registerCartRoutes from '../modules/cart/routes.js';
import registerOrderRoutes from '../modules/order/routes.js';
import registerAiRoutes from '../modules/ai/routes.js';

const router = createRouter();

registerAuthRoutes(router);
registerShopRoutes(router);
registerCartRoutes(router);
registerOrderRoutes(router);
registerAiRoutes(router);

export default router;
