import { chat, getAdvisorRecommendations, getAllHistory, getCheckoutGuardianIntervention, getHistory } from './service.js';

export default function registerAiRoutes(router) {
  router.add('POST', '/api/ai/chat', chat);
  router.add('POST', '/api/ai/advisor', getAdvisorRecommendations);
  router.add('POST', '/api/ai/checkout-guardian', getCheckoutGuardianIntervention);
  router.add('GET', '/api/ai/history/all', getAllHistory);
  router.add('GET', '/api/ai/history', getHistory);
}
