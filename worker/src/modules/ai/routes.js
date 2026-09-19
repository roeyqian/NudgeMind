import { chat, getHistory } from './service.js';

export default function registerAiRoutes(router) {
  router.add('POST', '/api/ai/chat', chat);
  router.add('GET', '/api/ai/history', getHistory);
}
