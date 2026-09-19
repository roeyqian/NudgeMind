import router from './routes.js';
import { handleApi } from './http.js';

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url, router, { executionCtx });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || url.pathname.includes('.')) return response;
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  },
};
