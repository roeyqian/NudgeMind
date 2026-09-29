import { LOCALE_STORAGE_KEY, localizeApiError } from './i18n.js';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
export const AUTH_EXPIRED_EVENT = 'nudge-mind:auth-expired';

export const session = {
  get token() {
    return localStorage.getItem('nudge_mind_token') || '';
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('nudge_mind_user') || 'null');
    } catch {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem('nudge_mind_token', token);
    localStorage.setItem('nudge_mind_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('nudge_mind_token');
    localStorage.removeItem('nudge_mind_user');
  },
};

async function request(path, options = {}) {
  const locale = localStorage.getItem(LOCALE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(locale === 'en'
      ? 'Network connection failed (NETWORK_ERROR). Check your connection and try again'
      : '网络连接失败（NETWORK_ERROR），请检查连接后重试');
  }

  const payload = await response.json().catch(() => ({}));
  const data = payload && typeof payload === 'object' ? payload : {};
  if (!response.ok) {
    if (response.status === 401) {
      session.clear();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    const details = [
      `HTTP ${response.status}`,
      data.code,
      data.upstreamCode ? `${locale === 'en' ? 'Provider' : '上游'} ${data.upstreamCode}` : '',
      data.requestId ? `${locale === 'en' ? 'Request ID' : '请求 ID'} ${data.requestId}` : '',
    ].filter(Boolean).join(' · ');
    const message = localizeApiError(data, response.status, locale);
    throw new Error(details ? (locale === 'en' ? `${message} (${details})` : `${message}（${details}）`) : message);
  }
  return data;
}

export const AuthAPI = {
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const ProductAPI = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products${query ? `?${query}` : ''}`);
  },
  detail: (id, locale) => request(`/products/${encodeURIComponent(id)}${locale ? `?${new URLSearchParams({ locale })}` : ''}`),
  categories: () => request('/categories'),
};

export const CartAPI = {
  get: (locale) => request(`/cart${locale ? `?${new URLSearchParams({ locale })}` : ''}`),
  add: (productId, quantity = 1) => request('/cart', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  }),
  update: (itemId, quantity) => request(`/cart/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  }),
  remove: (itemId) => request(`/cart/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
};

export const OrderAPI = {
  create: (shippingAddress) => request('/orders', {
    method: 'POST',
    body: JSON.stringify({ shippingAddress }),
  }),
  list: (locale) => request(`/orders${locale ? `?${new URLSearchParams({ locale })}` : ''}`),
};

export const AIAPI = {
  chat: (payload) => request('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  advisor: (payload) => request('/ai/advisor', { method: 'POST', body: JSON.stringify(payload) }),
  checkoutGuardian: (locale) => request('/ai/checkout-guardian', { method: 'POST', body: JSON.stringify({ locale }) }),
  allHistory: (locale) => request(`/ai/history/all${locale ? `?${new URLSearchParams({ locale })}` : ''}`),
  history: (productId, aiType) => {
    const query = new URLSearchParams({ productId, aiType }).toString();
    return request(`/ai/history?${query}`);
  },
  deleteHistory: (productId, aiType) => {
    const query = new URLSearchParams({ productId, aiType }).toString();
    return request(`/ai/history?${query}`, { method: 'DELETE' });
  },
};
