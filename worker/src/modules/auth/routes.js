import { login, logout, register } from './service.js';

export default function registerAuthRoutes(router) {
  router.add('POST', '/api/auth/register', register);
  router.add('POST', '/api/auth/login', login);
  router.add('POST', '/api/auth/logout', logout);
}
