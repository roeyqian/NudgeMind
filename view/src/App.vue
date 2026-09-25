<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  ArrowLeft,
  ArrowDownUp,
  CheckCircle2,
  History,
  LoaderCircle,
  ListFilter,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareText,
  Minus,
  Moon,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Sun,
  Trash2,
  User,
  X,
} from '@lucide/vue';
import {
  AIAPI,
  AUTH_EXPIRED_EVENT,
  AuthAPI,
  CartAPI,
  OrderAPI,
  ProductAPI,
  session,
} from './api.js';
import { LOCALE_STORAGE_KEY, localizeCatalogItem, localizeImageUrl, messages, translateCatalogText } from './i18n.js';

const user = ref(session.user);
const THEME_STORAGE_KEY = 'nudge-mind-theme';
const locale = ref(localStorage.getItem(LOCALE_STORAGE_KEY) === 'en' ? 'en' : 'zh');
const theme = ref(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const authMode = ref('login');
const authBusy = ref(false);
const authError = ref('');
const authForm = reactive({ username: '', email: '', password: '' });

const page = ref('browse');
const products = ref([]);
const categories = ref([]);
const selectedCategory = ref('all');
const searchText = ref('');
const productSort = ref('default');
const selectedProduct = ref(null);
const productDrawerOpen = ref(false);
const productBusy = ref(false);
const catalogBusy = ref(false);
const catalogPage = ref(1);
const productTotal = ref(0);
const PRODUCTS_PER_PAGE = 20;

const cart = ref([]);
const cartBusy = ref(false);
const checkoutOpen = ref(false);
const checkoutBusy = ref(false);
const checkoutGuardianBusy = ref(false);
const checkoutGuardian = ref(null);
const checkoutStage = ref('details');
const checkoutRemovalBusy = ref('');
const checkoutClearBusy = ref(false);
const checkoutForm = reactive({ name: '', phone: '', address: '' });
const orders = ref([]);
const ordersBusy = ref(false);
const chatHistory = ref([]);
const chatHistoryBusy = ref(false);
const chatHistorySort = ref('desc');
const chatHistoryDeleteBusy = ref('');
const mobileNavOpen = ref(false);

const aiOpen = ref(false);
const aiType = ref('seller');
const aiMessages = ref([]);
const aiInput = ref('');
const aiBusy = ref(false);
const advisorRequirement = ref('');
const advisorBusy = ref(false);
const advisorResult = ref(null);

const toast = reactive({ show: false, message: '', kind: 'success' });
let toastTimer;
let lockedPageScroll = null;
let lockedPageStyles = null;

function t(key, params = {}) {
  return (messages[locale.value][key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

function localizeItems(items) {
  return items.map((item) => localizeCatalogItem(item, locale.value));
}

function localizeCategories(items) {
  return items.map((item) => ({ ...item, name: translateCatalogText(item.name, locale.value) }));
}

function localizeOrderItems(items) {
  return items.map((item) => ({
    ...item,
    product_name: translateCatalogText(item.product_name, locale.value),
    product_image: localizeImageUrl(item.product_image, locale.value),
  }));
}

async function applyLocale() {
  categories.value = localizeCategories(categories.value);
  if (!user.value) return;
  try {
    const refreshes = [
      loadProducts(),
      CartAPI.get(locale.value).then((data) => { cart.value = localizeItems(data.items); }),
    ];
    if (selectedProduct.value) {
      refreshes.push(ProductAPI.detail(selectedProduct.value.id, locale.value).then((data) => {
        selectedProduct.value = localizeCatalogItem(data.product, locale.value);
      }));
    }
    if (page.value === 'orders') refreshes.push(OrderAPI.list(locale.value).then((data) => {
      orders.value = data.orders.map((order) => ({ ...order, items: localizeOrderItems(order.items) }));
    }));
    if (page.value === 'chat-history') refreshes.push(AIAPI.allHistory(locale.value).then((data) => { chatHistory.value = data.messages; }));
    await Promise.all(refreshes);
  } catch (error) {
    notify(error.message, 'error');
  }
}

function toggleLocale() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem(LOCALE_STORAGE_KEY, locale.value);
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN';
  document.title = 'Nudge Mind';
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  void applyLocale();
}

const totalProductPages = computed(() => Math.max(1, Math.ceil(productTotal.value / PRODUCTS_PER_PAGE)));
const paginationText = computed(() => locale.value === 'en'
  ? { label: 'Product pagination', previous: 'Previous page', next: 'Next page' }
  : { label: '商品分页', previous: '上一页', next: '下一页' });

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + Number(item.quantity), 0));
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));
const chatHistoryGroups = computed(() => {
  const groups = new Map();
  [...chatHistory.value].reverse().forEach((message) => {
    const key = `${message.productId}:${message.aiType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        productId: message.productId,
        productName: translateCatalogText(message.productName, locale.value),
        aiType: message.aiType,
        latestTimestamp: message.timestamp,
        messages: [],
      });
    }
    const group = groups.get(key);
    group.messages.push(message);
    group.latestTimestamp = message.timestamp;
  });
  return [...groups.values()].sort((first, second) => {
    const comparison = String(first.latestTimestamp).localeCompare(String(second.latestTimestamp));
    return chatHistorySort.value === 'desc' ? -comparison : comparison;
  });
});

function money(value) {
  return Number(value || 0).toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  localStorage.setItem(THEME_STORAGE_KEY, theme.value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.value === 'dark' ? '#161719' : '#f7f1ef');
}

function notify(message, kind = 'success') {
  clearTimeout(toastTimer);
  toast.message = message;
  toast.kind = kind;
  toast.show = true;
  toastTimer = setTimeout(() => { toast.show = false; }, kind === 'error' ? 10000 : 2600);
}

async function submitAuth() {
  authBusy.value = true;
  authError.value = '';
  try {
    const payload = authMode.value === 'login'
      ? { username: authForm.username, password: authForm.password }
      : { username: authForm.username, email: authForm.email, password: authForm.password };
    const result = authMode.value === 'login'
      ? await AuthAPI.login(payload)
      : await AuthAPI.register(payload);
    session.save(result.token, result.user);
    user.value = result.user;
    checkoutForm.name = result.user.username;
    await loadInitialData();
  } catch (error) {
    authError.value = error.message;
  } finally {
    authBusy.value = false;
  }
}

async function logout() {
  try {
    await AuthAPI.logout();
  } catch {
    // Local session should still close if the server session already expired.
  }
  resetSession();
}

function resetSession() {
  session.clear();
  user.value = null;
  products.value = [];
  productTotal.value = 0;
  catalogPage.value = 1;
  categories.value = [];
  cart.value = [];
  orders.value = [];
  chatHistory.value = [];
  selectedProduct.value = null;
  productDrawerOpen.value = false;
  productBusy.value = false;
  aiOpen.value = false;
  advisorRequirement.value = '';
  advisorResult.value = null;
  mobileNavOpen.value = false;
  page.value = 'browse';
}

async function loadInitialData() {
  catalogBusy.value = true;
  try {
    const [categoryData, cartData] = await Promise.all([
      ProductAPI.categories(),
      CartAPI.get(locale.value),
    ]);
    categories.value = localizeCategories(categoryData.categories);
    cart.value = localizeItems(cartData.items);
    await loadProducts();
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    catalogBusy.value = false;
  }
}

async function loadProducts() {
  catalogBusy.value = true;
  try {
    const productData = await ProductAPI.list({
      locale: locale.value,
      limit: PRODUCTS_PER_PAGE,
      offset: (catalogPage.value - 1) * PRODUCTS_PER_PAGE,
      ...(selectedCategory.value !== 'all' ? { category: selectedCategory.value } : {}),
      ...(searchText.value.trim() ? { search: searchText.value.trim() } : {}),
      ...(productSort.value !== 'default' ? { sort: productSort.value } : {}),
    });
    products.value = localizeItems(productData.products);
    productTotal.value = Number(productData.total || 0);
  } catch (error) {
    products.value = [];
    productTotal.value = 0;
    notify(error.message, 'error');
  } finally {
    catalogBusy.value = false;
  }
}

function changeCatalogPage(nextPage) {
  if (nextPage < 1 || nextPage > totalProductPages.value || nextPage === catalogPage.value) return;
  catalogPage.value = nextPage;
  loadProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch([selectedCategory, searchText, productSort], () => {
  catalogPage.value = 1;
  if (user.value) loadProducts();
});

watch(productDrawerOpen, (isOpen) => {
  if (isOpen) {
    lockedPageScroll = window.scrollY;
    lockedPageStyles = {
      rootOverflow: document.documentElement.style.overflow,
      rootOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
    };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`;
    }
    return;
  }

  if (lockedPageScroll === null) return;
  document.documentElement.style.overflow = lockedPageStyles.rootOverflow;
  document.documentElement.style.overscrollBehavior = lockedPageStyles.rootOverscrollBehavior;
  document.body.style.overflow = lockedPageStyles.bodyOverflow;
  document.body.style.paddingRight = lockedPageStyles.bodyPaddingRight;
  window.scrollTo(0, lockedPageScroll);
  lockedPageScroll = null;
  lockedPageStyles = null;
});

async function openProduct(product) {
  selectedProduct.value = null;
  productDrawerOpen.value = true;
  productBusy.value = true;
  try {
    selectedProduct.value = localizeCatalogItem((await ProductAPI.detail(product.id, locale.value)).product, locale.value);
  } catch (error) {
    productDrawerOpen.value = false;
    notify(error.message, 'error');
  } finally {
    productBusy.value = false;
  }
}

function closeProductDrawer() {
  productDrawerOpen.value = false;
  selectedProduct.value = null;
  aiOpen.value = false;
}

async function addToCart(productId, quantity = 1) {
  try {
    await CartAPI.add(productId, quantity);
    cart.value = localizeItems((await CartAPI.get(locale.value)).items);
    notify(t('added'));
  } catch (error) {
    notify(error.message, 'error');
  }
}

function addSuggestedProductToCart() {
  if (!selectedProduct.value) return;
  addToCart(selectedProduct.value.id);
}

async function showCart() {
  closeProductDrawer();
  page.value = 'cart';
  cartBusy.value = true;
  try {
    cart.value = localizeItems((await CartAPI.get(locale.value)).items);
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    cartBusy.value = false;
  }
}

async function changeQuantity(item, delta) {
  const quantity = Number(item.quantity) + delta;
  if (quantity < 1) return;
  try {
    await CartAPI.update(item.id, quantity);
    cart.value = localizeItems((await CartAPI.get(locale.value)).items);
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function removeCartItem(item) {
  try {
    await CartAPI.remove(item.id);
    cart.value = localizeItems((await CartAPI.get(locale.value)).items);
    notify(t('removed'));
  } catch (error) {
    notify(error.message, 'error');
  }
}

function openCheckout() {
  checkoutGuardian.value = null;
  checkoutStage.value = 'details';
  checkoutOpen.value = true;
}

function closeCheckout() {
  if (checkoutBusy.value || checkoutGuardianBusy.value || checkoutRemovalBusy.value || checkoutClearBusy.value) return;
  checkoutOpen.value = false;
}

async function requestCheckoutGuardian() {
  if (checkoutGuardianBusy.value) return;
  checkoutGuardianBusy.value = true;
  try {
    checkoutGuardian.value = await AIAPI.checkoutGuardian(locale.value);
    checkoutStage.value = 'guardian';
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    checkoutGuardianBusy.value = false;
  }
}

async function removeGuardianSuggestedItem(intervention) {
  const item = cart.value.find((cartItem) => cartItem.id === intervention.cartItemId);
  if (!item || checkoutRemovalBusy.value || checkoutClearBusy.value) return;
  checkoutRemovalBusy.value = item.id;
  try {
    await CartAPI.remove(item.id);
    cart.value = localizeItems((await CartAPI.get(locale.value)).items);
    checkoutGuardian.value = {
      ...checkoutGuardian.value,
      items: checkoutGuardian.value.items.filter((entry) => entry.cartItemId !== item.id),
    };
    notify(t('removed'));
    if (!cart.value.length) checkoutOpen.value = false;
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    checkoutRemovalBusy.value = '';
  }
}

async function clearCheckoutCart() {
  if (checkoutClearBusy.value || checkoutBusy.value || checkoutRemovalBusy.value) return;
  checkoutClearBusy.value = true;
  try {
    for (const item of [...cart.value]) {
      await CartAPI.remove(item.id);
      cart.value = cart.value.filter((cartItem) => cartItem.id !== item.id);
      checkoutGuardian.value = {
        ...checkoutGuardian.value,
        items: checkoutGuardian.value.items.filter((entry) => entry.cartItemId !== item.id),
      };
    }
    checkoutOpen.value = false;
    notify(t('removed'));
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    checkoutClearBusy.value = false;
  }
}

async function submitOrder() {
  if (checkoutClearBusy.value || checkoutRemovalBusy.value) return;
  checkoutBusy.value = true;
  try {
    const result = await OrderAPI.create({ ...checkoutForm });
    checkoutOpen.value = false;
    cart.value = [];
    notify(t('orderComplete', { orderNo: result.orderNo }));
    await showOrders();
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    checkoutBusy.value = false;
  }
}

async function showOrders() {
  closeProductDrawer();
  page.value = 'orders';
  ordersBusy.value = true;
  try {
    orders.value = (await OrderAPI.list(locale.value)).orders.map((order) => ({
      ...order,
      items: localizeOrderItems(order.items),
    }));
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    ordersBusy.value = false;
  }
}

async function showChatHistory() {
  closeProductDrawer();
  page.value = 'chat-history';
  chatHistoryBusy.value = true;
  try {
    chatHistory.value = (await AIAPI.allHistory(locale.value)).messages;
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    chatHistoryBusy.value = false;
  }
}

function showAdvisor() {
  closeProductDrawer();
  page.value = 'advisor';
}

async function submitAdvisor() {
  const requirement = advisorRequirement.value.trim();
  if (!requirement || advisorBusy.value) return;
  advisorBusy.value = true;
  advisorResult.value = null;
  try {
    const result = await AIAPI.advisor({ requirement, locale: locale.value });
    advisorResult.value = {
      ...result,
      recommendations: result.recommendations.map((item) => ({
        ...item,
        product: localizeCatalogItem(item.product, locale.value),
      })),
    };
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    advisorBusy.value = false;
  }
}

function toggleChatHistorySort() {
  chatHistorySort.value = chatHistorySort.value === 'desc' ? 'asc' : 'desc';
}

async function deleteChatHistory(conversation) {
  if (chatHistoryDeleteBusy.value || !window.confirm(t('deleteChatConfirm', { product: conversation.productName, ai: conversation.aiType === 'seller' ? t('sellerAi') : t('guardianAi') }))) return;
  chatHistoryDeleteBusy.value = conversation.key;
  try {
    await AIAPI.deleteHistory(conversation.productId, conversation.aiType);
    chatHistory.value = chatHistory.value.filter((message) => message.productId !== conversation.productId || message.aiType !== conversation.aiType);
    notify(t('chatDeleted'));
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    chatHistoryDeleteBusy.value = '';
  }
}

function formatHistoryTime(value) {
  const normalized = String(value || '').includes('T') ? value : `${value || ''}`.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function openAi(type) {
  aiType.value = type;
  aiOpen.value = true;
  aiMessages.value = [];
  aiInput.value = '';
  aiBusy.value = true;
  try {
    aiMessages.value = (await AIAPI.history(selectedProduct.value.id, type)).messages;
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    aiBusy.value = false;
  }
}

async function sendAiMessage() {
  const message = aiInput.value.trim();
  if (!message || aiBusy.value) return;
  aiMessages.value.push({ role: 'user', content: message });
  aiInput.value = '';
  aiBusy.value = true;
  try {
    const result = await AIAPI.chat({
      message,
      aiType: aiType.value,
      productId: selectedProduct.value.id,
      locale: locale.value,
    });
    aiMessages.value.push({
      role: 'assistant',
      content: result.response,
      add_to_cart: result.add_to_cart,
      scarcity: result.scarcity,
      social_proof: result.social_proof,
      price_anchor: result.price_anchor,
    });
  } catch (error) {
    aiMessages.value.pop();
    aiInput.value = message;
    notify(error.message, 'error');
  } finally {
    aiBusy.value = false;
  }
}

function goBrowse() {
  page.value = 'browse';
  closeProductDrawer();
}

function closeMobileNavOnDesktop() {
  if (window.innerWidth > 760) mobileNavOpen.value = false;
}

function handleExpired() {
  resetSession();
  authError.value = t('sessionExpired');
}

onMounted(() => {
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN';
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  window.addEventListener('resize', closeMobileNavOnDesktop);
  if (user.value) {
    checkoutForm.name = user.value.username;
    loadInitialData();
  }
});

onUnmounted(() => {
  if (lockedPageScroll !== null) {
    document.documentElement.style.overflow = lockedPageStyles.rootOverflow;
    document.documentElement.style.overscrollBehavior = lockedPageStyles.rootOverscrollBehavior;
    document.body.style.overflow = lockedPageStyles.bodyOverflow;
    document.body.style.paddingRight = lockedPageStyles.bodyPaddingRight;
    window.scrollTo(0, lockedPageScroll);
    lockedPageScroll = null;
    lockedPageStyles = null;
  }
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  window.removeEventListener('resize', closeMobileNavOnDesktop);
  clearTimeout(toastTimer);
});
</script>

<template>
  <Transition name="app" mode="out-in">
  <main v-if="!user" key="auth" class="auth-shell">
    <section class="auth-story">
      <a class="brand brand-light" href="#" @click.prevent>
        <span class="brand-mark">N</span>
        <span>Nudge Mind</span>
      </a>
      <div class="story-copy">
        <span class="eyebrow">{{ t('prototype') }}</span>
        <h1>{{ t('prePurchase') }}<br />{{ t('thinkingSpace') }}</h1>
        <p>{{ t('authIntro') }}</p>
      </div>
      <div class="story-note">{{ t('researchOnly') }}</div>
    </section>

    <section class="auth-panel">
      <button class="language-toggle auth-language-toggle" type="button" :aria-label="t('language')" :title="t('language')" @click="toggleLocale">{{ t('language') }}</button>
      <button
        class="theme-toggle auth-theme-toggle"
        type="button"
        :aria-label="theme === 'dark' ? t('switchToLight') : t('switchToDark')"
        :title="theme === 'dark' ? t('switchToLight') : t('switchToDark')"
        @click="toggleTheme"
      >
        <Transition name="icon-swap" mode="out-in">
          <Sun v-if="theme === 'dark'" key="sun" :size="18" />
          <Moon v-else key="moon" :size="18" />
        </Transition>
      </button>
      <form class="auth-card" @submit.prevent="submitAuth">
        <Transition name="auth-copy" mode="out-in">
          <div :key="authMode">
            <p class="eyebrow dark">{{ t('welcome') }}</p>
            <h2>{{ authMode === 'login' ? t('loginTitle') : t('registerTitle') }}</h2>
            <p class="muted">{{ authMode === 'login' ? t('loginIntro') : t('registerIntro') }}</p>
          </div>
        </Transition>

        <label>
          <span>{{ t('username') }}</span>
          <input v-model.trim="authForm.username" autocomplete="username" required minlength="2" maxlength="40" :placeholder="t('usernamePlaceholder')" />
        </label>
        <Transition name="auth-field">
          <label v-if="authMode === 'register'">
            <span>{{ t('email') }}</span>
            <input v-model.trim="authForm.email" type="email" autocomplete="email" required placeholder="name@example.com" />
          </label>
        </Transition>
        <label>
          <span>{{ t('password') }}</span>
          <input v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" required minlength="8" :placeholder="t('passwordPlaceholder')" />
        </label>
        <Transition name="feedback"><p v-if="authError" class="form-error">{{ authError }}</p></Transition>
        <button class="primary-button full" :disabled="authBusy">
          <LoaderCircle v-if="authBusy" :size="18" class="spin" />
          {{ authMode === 'login' ? t('login') : t('register') }}
        </button>
        <button class="text-button" type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''">
          {{ authMode === 'login' ? t('noAccount') : t('hasAccount') }}
        </button>
      </form>
    </section>
  </main>

  <div v-else key="app" class="app-shell">
    <header class="topbar">
      <button class="brand brand-button" @click="goBrowse">
        <img class="brand-logo" src="/favicon.svg" alt="" />
        <span>Nudge Mind</span>
      </button>
      <nav class="main-nav" :aria-label="t('discover')">
        <button class="mobile-nav-toggle" type="button" :aria-label="t(mobileNavOpen ? 'closeMenu' : 'openMenu')" aria-controls="main-nav-menu" :aria-expanded="mobileNavOpen" @click="mobileNavOpen = !mobileNavOpen">
          <Transition name="icon-swap" mode="out-in">
            <X v-if="mobileNavOpen" key="close" :size="20" />
            <Menu v-else key="menu" :size="20" />
          </Transition>
        </button>
        <div id="main-nav-menu" class="main-nav-menu" :class="{ open: mobileNavOpen }">
          <button :class="{ active: page === 'browse' }" @click="goBrowse(); mobileNavOpen = false">{{ t('discover') }}</button>
          <button :class="{ active: page === 'advisor' }" @click="showAdvisor(); mobileNavOpen = false"><Sparkles :size="17" />{{ t('advisor') }}</button>
          <button :class="{ active: page === 'orders' }" @click="showOrders(); mobileNavOpen = false"><History :size="17" />{{ t('purchaseHistory') }}</button>
          <button :class="{ active: page === 'chat-history' }" @click="showChatHistory(); mobileNavOpen = false"><MessageSquareText :size="17" />{{ t('chatHistory') }}</button>
        </div>
      </nav>
      <div class="top-actions">
        <button class="language-toggle" type="button" :aria-label="t('language')" :title="t('language')" @click="toggleLocale">{{ t('language') }}</button>
        <button
          class="theme-toggle"
          type="button"
          :aria-label="theme === 'dark' ? t('switchToLight') : t('switchToDark')"
          :title="theme === 'dark' ? t('switchToLight') : t('switchToDark')"
          @click="toggleTheme"
        >
          <Transition name="icon-swap" mode="out-in">
            <Sun v-if="theme === 'dark'" key="sun" :size="19" />
            <Moon v-else key="moon" :size="19" />
          </Transition>
        </button>
        <button class="cart-button" :aria-label="t('cart')" @click="showCart">
          <ShoppingCart :size="20" />
          <span v-if="cartCount" :key="cartCount" class="cart-count">{{ cartCount }}</span>
        </button>
        <div class="user-chip"><User :size="17" />{{ user.username }}</div>
        <button class="icon-button" :aria-label="t('logout')" :title="t('logout')" @click="logout"><LogOut :size="19" /></button>
      </div>
    </header>

    <Transition name="page" mode="out-in">
    <div v-if="page === 'browse'" key="browse" class="browse-page">
      <section class="hero">
        <div>
          <p class="eyebrow">Nudge Mind</p>
          <h1><em>{{ t('designedChoices') }}</em><br />{{ t('heroTitle') }}</h1>
          <p>{{ t('heroText') }}</p>
        </div>
        <div class="hero-orbit" aria-hidden="true">
          <div class="orbit-ring"></div>
          <div class="orbit-center">N</div>
          <span class="orbit-dot one"></span>
          <span class="orbit-dot two"></span>
        </div>
      </section>

      <section class="catalog-section">
        <div class="catalog-heading">
          <div>
            <p class="eyebrow dark">{{ t('researchCatalog') }}</p>
            <h2>{{ t('exploreAll') }}</h2>
          </div>
          <div class="catalog-tools">
            <label class="search-box">
              <Search :size="19" />
              <input v-model="searchText" type="search" :placeholder="t('searchPlaceholder')" />
            </label>
            <label class="sort-box">
              <ListFilter :size="18" aria-hidden="true" />
              <span class="sr-only">{{ t('productSort') }}</span>
              <select v-model="productSort" :aria-label="t('productSort')">
                <option value="default">{{ t('defaultSort') }}</option>
                <option value="name">{{ t('nameSort') }}</option>
                <option value="price-asc">{{ t('priceAsc') }}</option>
                <option value="price-desc">{{ t('priceDesc') }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="category-row">
          <button :class="{ active: selectedCategory === 'all' }" @click="selectedCategory = 'all'">{{ t('all') }}</button>
          <button v-for="category in categories" :key="category.id" :class="{ active: selectedCategory === category.id }" @click="selectedCategory = category.id">
            <span>{{ category.icon }}</span>{{ category.name }}
          </button>
        </div>

        <div v-if="catalogBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingProducts') }}</div>
        <div v-else-if="!products.length" class="state-card"><Package />{{ t('noProducts') }}</div>
        <TransitionGroup v-else :key="`${selectedCategory}-${searchText}-${productSort}-${catalogPage}`" name="catalog-list" tag="div" class="product-grid">
          <article v-for="(product, index) in products" :key="product.id" class="product-card" :style="{ '--enter-delay': `${Math.min(index, 7) * 45}ms` }" @click="openProduct(product)">
            <div class="product-image-wrap">
              <img :src="product.image_url" :alt="product.name" />
              <span v-if="product.is_new" class="product-badge">{{ t('new') }}</span>
            </div>
            <div class="product-body">
              <div class="rating"><Star :size="15" fill="currentColor" /> {{ product.rating }} <span>· {{ product.sales_count }} {{ t('followers') }}</span></div>
              <h3>{{ product.name }}</h3>
              <p>{{ product.subtitle }}</p>
              <div class="product-foot">
                <div><strong>{{ t('currency') }}{{ money(product.price) }}</strong><s v-if="product.original_price">{{ t('currency') }}{{ money(product.original_price) }}</s></div>
                <button class="mini-cart" :title="t('addToCart')" :aria-label="t('addToCart')" @click.stop="addToCart(product.id)"><Plus :size="20" /></button>
              </div>
            </div>
          </article>
        </TransitionGroup>
        <nav v-if="!catalogBusy && productTotal > PRODUCTS_PER_PAGE" class="pagination" :aria-label="paginationText.label">
          <button :disabled="catalogPage === 1" :aria-label="paginationText.previous" @click="changeCatalogPage(catalogPage - 1)">{{ paginationText.previous }}</button>
          <span>{{ catalogPage }} / {{ totalProductPages }}</span>
          <button :disabled="catalogPage === totalProductPages" :aria-label="paginationText.next" @click="changeCatalogPage(catalogPage + 1)">{{ paginationText.next }}</button>
        </nav>
      </section>
    </div>

    <main v-else-if="page === 'advisor'" key="advisor" class="page-container advisor-page">
      <div class="page-heading">
        <div><p class="eyebrow dark">{{ t('advisorEyebrow') }}</p><h1>{{ t('advisor') }}</h1></div>
        <button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('backToItems') }}</button>
      </div>
      <section class="advisor-intro">
        <span class="advisor-icon"><Sparkles :size="25" /></span>
        <div><h2>{{ t('advisorTitle') }}</h2><p>{{ t('advisorText') }}</p></div>
      </section>
      <form class="advisor-form" @submit.prevent="submitAdvisor">
        <label>
          <span>{{ t('advisorPrompt') }}</span>
          <textarea v-model="advisorRequirement" rows="4" maxlength="800" :placeholder="t('advisorPlaceholder')" required></textarea>
        </label>
        <p class="advisor-disclosure"><ShieldCheck :size="16" />{{ t('advisorDisclosure') }}</p>
        <button class="primary-button" :disabled="advisorBusy || !advisorRequirement.trim()"><LoaderCircle v-if="advisorBusy" :size="18" class="spin" /><Sparkles v-else :size="18" />{{ advisorBusy ? t('advisorMatching') : t('advisorSubmit') }}</button>
      </form>
      <section v-if="advisorResult" class="advisor-results" aria-live="polite">
        <header><p class="eyebrow dark">{{ t('advisorResults') }}</p><p>{{ advisorResult.intro || t('advisorFallbackIntro') }}</p></header>
        <div class="advisor-product-grid">
          <article v-for="(item, index) in advisorResult.recommendations" :key="item.product.id" class="advisor-product-card" :style="{ '--enter-delay': `${index * 70}ms` }">
            <img :src="item.product.image_url" :alt="item.product.name" />
            <div class="advisor-product-copy">
              <span class="advisor-rank">{{ t('advisorMatch', { number: index + 1 }) }}</span>
              <h2>{{ item.product.name }}</h2>
              <p>{{ item.reason || item.product.subtitle }}</p>
              <div class="advisor-product-foot"><strong>{{ t('currency') }}{{ money(item.product.price) }}</strong><span>{{ t('stock') }} {{ item.product.stock }} {{ t('pieces') }}</span></div>
              <div class="advisor-actions"><button class="text-button" type="button" @click="openProduct(item.product)">{{ t('advisorDetails') }}</button><button class="mini-cart" type="button" :disabled="item.product.stock < 1" :aria-label="t('addToCart')" @click="addToCart(item.product.id)"><Plus :size="20" /></button></div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <main v-else-if="page === 'cart'" key="cart" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">{{ t('yourChoices') }}</p><h1>{{ t('cart') }}</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('continueBrowsing') }}</button></div>
      <div v-if="cartBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingCart') }}</div>
      <div v-else-if="!cart.length" class="empty-state"><ShoppingBag :size="48" /><h2>{{ t('emptyCart') }}</h2><p>{{ t('emptyCartText') }}</p><button class="primary-button" @click="goBrowse">{{ t('browseProducts') }}</button></div>
      <div v-else class="cart-layout">
        <TransitionGroup name="cart-list" tag="section" class="cart-list">
          <article v-for="(item, index) in cart" :key="item.id" class="cart-item" :style="{ '--enter-delay': `${Math.min(index, 7) * 45}ms` }">
            <img :src="item.image_url" :alt="item.name" />
            <div class="cart-item-main"><h3>{{ item.name }}</h3><p>{{ t('unitPrice') }} {{ t('currency') }}{{ money(item.price) }} · {{ t('stock') }} {{ item.stock }}</p><button class="remove-button" @click="removeCartItem(item)"><Trash2 :size="16" />{{ t('remove') }}</button></div>
            <div class="quantity-control"><button @click="changeQuantity(item, -1)"><Minus :size="16" /></button><Transition name="quantity" mode="out-in"><span :key="item.quantity">{{ item.quantity }}</span></Transition><button :disabled="item.quantity >= item.stock" @click="changeQuantity(item, 1)"><Plus :size="16" /></button></div>
            <strong>{{ t('currency') }}{{ money(item.price * item.quantity) }}</strong>
          </article>
        </TransitionGroup>
        <aside class="summary-card">
          <p class="eyebrow dark">{{ t('orderSubtotal') }}</p>
          <div><span>{{ t('itemCount') }}</span><strong>{{ cartCount }} {{ t('pieces') }}</strong></div>
          <div><span>{{ t('shipping') }}</span><strong>{{ t('currency') }}0.00</strong></div>
          <div class="summary-total"><span>{{ t('total') }}</span><strong>{{ t('currency') }}{{ money(cartTotal) }}</strong></div>
          <button class="primary-button full" @click="openCheckout">{{ t('simulatedPurchase') }}</button>
          <p>{{ t('noRealPayment') }}</p>
        </aside>
      </div>
    </main>

    <main v-else-if="page === 'orders'" key="orders" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">{{ t('researchRecords') }}</p><h1>{{ t('purchaseHistory') }}</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('backToItems') }}</button></div>
      <div v-if="ordersBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingOrders') }}</div>
      <div v-else-if="!orders.length" class="empty-state"><History :size="48" /><h2>{{ t('noOrders') }}</h2><p>{{ t('noOrdersText') }}</p></div>
      <section v-else class="order-list">
        <article v-for="(order, index) in orders" :key="order.id" class="order-card" :style="{ '--enter-delay': `${Math.min(index, 7) * 45}ms` }">
          <div class="order-head"><div><span>{{ order.order_no }}</span><p>{{ order.created_at }}</p></div><span class="status-pill"><CheckCircle2 :size="15" />{{ t('completed') }}</span></div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id"><img :src="item.product_image" :alt="item.product_name" /><span>{{ item.product_name }} × {{ item.quantity }}</span><strong>{{ t('currency') }}{{ money(item.subtotal) }}</strong></div>
          </div>
          <div class="order-total">{{ t('total') }} <strong>{{ t('currency') }}{{ money(order.final_amount) }}</strong></div>
        </article>
      </section>
    </main>

    <main v-else-if="page === 'chat-history'" key="chat-history" class="page-container">
      <div class="page-heading">
        <div><p class="eyebrow dark">{{ t('yourChoices') }}</p><h1>{{ t('chatHistory') }}</h1></div>
        <button class="history-sort-button" type="button" @click="toggleChatHistorySort">
          <ArrowDownUp :size="17" />
          {{ chatHistorySort === 'desc' ? t('chatHistorySortNewest') : t('chatHistorySortOldest') }}
        </button>
      </div>
      <div v-if="chatHistoryBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingChatHistory') }}</div>
      <div v-else-if="!chatHistoryGroups.length" class="empty-state"><MessageSquareText :size="48" /><h2>{{ t('noChatHistory') }}</h2><p>{{ t('noChatHistoryText') }}</p></div>
      <TransitionGroup v-else name="history-list" tag="section" class="chat-history-list">
        <article v-for="(conversation, index) in chatHistoryGroups" :key="conversation.key" class="chat-history-card" :style="{ '--enter-delay': `${Math.min(index, 7) * 45}ms` }">
          <header class="chat-history-head">
            <div>
              <p>{{ conversation.productName }}</p>
              <span class="history-ai-type" :class="conversation.aiType">
                <Store v-if="conversation.aiType === 'seller'" :size="14" />
                <ShieldCheck v-else :size="14" />
                {{ conversation.aiType === 'seller' ? t('sellerAi') : t('guardianAi') }}
              </span>
            </div>
            <button class="chat-history-delete" type="button" :disabled="Boolean(chatHistoryDeleteBusy)" @click="deleteChatHistory(conversation)">
              <LoaderCircle v-if="chatHistoryDeleteBusy === conversation.key" class="spin" :size="16" />
              <Trash2 v-else :size="16" />
              {{ t('deleteChat') }}
            </button>
          </header>
          <div class="chat-history-messages">
            <div v-for="(message, index) in conversation.messages" :key="`${conversation.key}-${index}`" class="history-message" :class="message.role">
              <span>{{ message.role === 'user' ? t('you') : (conversation.aiType === 'seller' ? t('sellerAi') : t('guardianAi')) }} · {{ formatHistoryTime(message.timestamp) }}</span>
              <p>{{ message.content }}</p>
            </div>
          </div>
        </article>
      </TransitionGroup>
    </main>

    </Transition>

    <Transition name="modal">
    <div v-if="checkoutOpen" class="modal-backdrop" @click.self="closeCheckout">
      <form v-if="checkoutStage === 'details'" class="modal-card" @submit.prevent="requestCheckoutGuardian">
        <button class="modal-close" type="button" :aria-label="t('close')" @click="closeCheckout"><X /></button>
        <p class="eyebrow dark">{{ t('simulatedPurchase') }}</p><h2>{{ t('confirmInfo') }}</h2><p class="muted">{{ t('orderInfoOnly') }}</p>
        <label><span>{{ t('name') }}</span><input v-model.trim="checkoutForm.name" required maxlength="50" /></label>
        <label><span>{{ t('phone') }}</span><input v-model.trim="checkoutForm.phone" required maxlength="30" :placeholder="t('researchInfo')" /></label>
        <label><span>{{ t('address') }}</span><textarea v-model.trim="checkoutForm.address" required maxlength="200" rows="3" :placeholder="t('researchInfo')"></textarea></label>
        <div class="modal-total"><span>{{ t('paymentAmount') }}</span><strong>{{ t('currency') }}{{ money(cartTotal) }}</strong></div>
        <button class="primary-button full" :disabled="checkoutGuardianBusy"><LoaderCircle v-if="checkoutGuardianBusy" :size="18" class="spin" />{{ checkoutGuardianBusy ? t('guardianReviewing') : t('confirmPurchase') }}</button>
      </form>
      <section v-else class="modal-card guardian-intervention" aria-live="polite">
        <button class="modal-close" type="button" :aria-label="t('close')" @click="closeCheckout"><X /></button>
        <p class="eyebrow dark">{{ t('guardianAi') }}</p>
        <h2>{{ t('guardianInterventionTitle') }}</h2>
        <p class="muted">{{ t('guardianInterventionIntro') }}</p>
        <p class="guardian-overview">{{ checkoutGuardian?.message }}</p>
        <div class="guardian-cart-items">
          <article v-for="item in checkoutGuardian?.items" :key="item.cartItemId" class="guardian-cart-item">
            <div class="guardian-item-content">
              <strong>{{ cart.find((cartItem) => cartItem.id === item.cartItemId)?.name }}</strong>
              <p>{{ item.reason || t('guardianNeedsReview') }}</p>
              <div class="guardian-patterns">
                <strong>{{ t('guardianFoundPrompts') }}</strong>
                <p>{{ item.hasSellerChat ? t('guardianSellerChatFound') : t('guardianNoSellerChat') }}</p>
                <p v-if="!item.sellerPatterns.length && !item.productPatterns.length">{{ t('guardianNoPatterns') }}</p>
                <div v-for="(pattern, index) in item.sellerPatterns" :key="`seller-${pattern.messageId}-${index}`" class="guardian-pattern">
                  <span>{{ t('guardianSellerPrompt') }} · {{ t(`guardianPattern_${pattern.type}`) }}</span>
                  <p>{{ t(`guardianPatternAdvice_${pattern.type}`) }}</p>
                  <details><summary>{{ t('guardianSeeQuote') }}</summary><q>{{ pattern.evidenceText }}</q></details>
                </div>
                <div v-for="(pattern, index) in item.productPatterns" :key="`product-${pattern.type}-${index}`" class="guardian-pattern">
                  <span>{{ t('guardianProductPrompt') }} · {{ t(`guardianPattern_${pattern.type}`) }}</span>
                  <p>{{ t(`guardianPatternAdvice_${pattern.type}`) }}</p>
                  <details><summary>{{ t('guardianSeeBasis') }}</summary><q>{{ pattern.evidenceText }}</q></details>
                </div>
              </div>
            </div>
            <button v-if="item.shouldRemove" type="button" class="guardian-remove" :disabled="!!checkoutRemovalBusy || checkoutClearBusy" @click="removeGuardianSuggestedItem(item)"><LoaderCircle v-if="checkoutRemovalBusy === item.cartItemId" :size="16" class="spin" /><Trash2 v-else :size="16" />{{ t('guardianRemove') }}</button>
            <span v-else class="guardian-keep">{{ t('guardianKeep') }}</span>
          </article>
        </div>
        <div class="guardian-actions">
          <button type="button" class="primary-button" :disabled="checkoutBusy || checkoutClearBusy || !!checkoutRemovalBusy || !cart.length" @click="clearCheckoutCart"><LoaderCircle v-if="checkoutClearBusy" :size="18" class="spin" />{{ t('guardianClearCart') }}</button>
          <button type="button" class="back-button" :disabled="checkoutBusy || checkoutClearBusy || !!checkoutRemovalBusy || !cart.length" @click="submitOrder"><LoaderCircle v-if="checkoutBusy" :size="18" class="spin" />{{ t('guardianContinue') }}</button>
        </div>
      </section>
    </div>
    </Transition>

    <Transition name="drawer">
      <div v-if="productDrawerOpen" class="drawer-backdrop" @click.self="closeProductDrawer">
        <aside class="product-drawer" role="dialog" aria-modal="true" :aria-label="selectedProduct?.name || t('loadingProducts')">
          <header class="product-drawer-header">
            <p class="eyebrow dark">{{ t('researchSample') }}</p>
            <button class="icon-button" type="button" :aria-label="t('close')" :title="t('close')" @click="closeProductDrawer"><X :size="20" /></button>
          </header>
          <Transition name="drawer-content" mode="out-in">
          <div v-if="productBusy" key="loading" class="drawer-loading"><LoaderCircle class="spin" />{{ t('loadingProducts') }}</div>
          <div v-else-if="selectedProduct" key="product" class="product-drawer-content">
            <div class="detail-layout">
              <section class="detail-visual">
                <div class="detail-image">
                  <img :src="selectedProduct.image_url" :alt="selectedProduct.name" />
                  <span>{{ t('researchSample') }} · {{ selectedProduct.category_name }}</span>
                </div>
                <section class="ai-choice detail-ai-choice">
                  <div><p class="eyebrow dark">{{ t('basicAi') }}</p><h2>{{ t('askWho') }}</h2></div>
                  <div class="ai-buttons">
                    <button class="seller-button" @click="openAi('seller')"><Store :size="20" />{{ t('askSeller') }}</button>
                    <button class="guardian-button" @click="openAi('guardian')"><ShieldCheck :size="20" />{{ t('askGuardian') }}</button>
                  </div>
                  <p>{{ t('aiDescription') }}</p>
                </section>
              </section>
              <section class="detail-info">
                <div class="rating"><Star :size="16" fill="currentColor" /> {{ selectedProduct.rating }} <span>· {{ selectedProduct.sales_count }} {{ t('followers') }}</span></div>
                <h1>{{ selectedProduct.name }}</h1>
                <p class="detail-subtitle">{{ selectedProduct.subtitle }}</p>
                <div class="detail-price"><strong>{{ t('currency') }}{{ money(selectedProduct.price) }}</strong><s v-if="selectedProduct.original_price">{{ t('currency') }}{{ money(selectedProduct.original_price) }}</s></div>
                <p class="detail-description">{{ selectedProduct.description }}</p>
                <div class="tag-list"><span v-for="tag in selectedProduct.tags" :key="tag">{{ tag }}</span></div>
                <section class="spec-panel">
                  <h2>{{ t('productSpecs') }}</h2>
                  <dl>
                    <template v-for="(value, key) in selectedProduct.specs" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template>
                    <dt>{{ t('stock') }}</dt><dd>{{ selectedProduct.stock }} {{ t('pieces') }}</dd>
                  </dl>
                </section>
                <div class="detail-actions"><button class="primary-button" :disabled="selectedProduct.stock < 1" @click="addToCart(selectedProduct.id)"><ShoppingCart :size="19" />{{ t('addToCart') }}</button></div>
                <section class="ai-choice mobile-ai-choice">
                  <div><p class="eyebrow dark">{{ t('basicAi') }}</p><h2>{{ t('askWho') }}</h2></div>
                  <div class="ai-buttons">
                    <button class="seller-button" @click="openAi('seller')"><Store :size="20" />{{ t('askSeller') }}</button>
                    <button class="guardian-button" @click="openAi('guardian')"><ShieldCheck :size="20" />{{ t('askGuardian') }}</button>
                  </div>
                  <p>{{ t('aiDescription') }}</p>
                </section>
              </section>
            </div>
          </div>
          </Transition>
        </aside>
      </div>
    </Transition>

    <Transition name="ai-drawer">
    <aside v-if="aiOpen" class="ai-drawer">
      <header :class="aiType"><div><span class="ai-avatar"><Store v-if="aiType === 'seller'" /><ShieldCheck v-else /></span><div><p>{{ aiType === 'seller' ? t('sellerView') : t('guardian') }}</p><h2>{{ aiType === 'seller' ? t('sellerAi') : t('guardianAi') }}</h2></div></div><button :aria-label="t('close')" @click="aiOpen = false"><X /></button></header>
      <div class="ai-context"><img :src="selectedProduct.image_url" :alt="selectedProduct.name" /><div><span>{{ t('discussing') }}</span><strong>{{ selectedProduct.name }}</strong></div></div>
      <div class="message-list">
        <div v-if="!aiMessages.length && !aiBusy" class="ai-empty"><MessageCircle :size="35" /><p>{{ aiType === 'seller' ? t('sellerEmpty') : t('guardianEmpty') }}</p></div>
        <div v-for="(message, index) in aiMessages" :key="index" class="message" :class="message.role" :style="{ '--enter-delay': `${Math.min(index, 6) * 35}ms` }">
          <span>{{ message.role === 'user' ? t('you') : (aiType === 'seller' ? t('sellerAi') : t('guardianAi')) }}</span>
          <p>{{ message.content }}</p>
          <div v-if="message.role === 'assistant' && selectedProduct" class="ai-nudge-components">
            <button v-if="message.add_to_cart" class="ai-add-to-cart" :disabled="selectedProduct.stock < 1" @click="addSuggestedProductToCart"><ShoppingCart :size="16" />{{ t('aiAddToCart') }}</button>
            <p v-if="message.scarcity" class="ai-nudge scarcity">{{ t('aiScarcity', { stock: selectedProduct.stock }) }}</p>
            <p v-if="message.social_proof" class="ai-nudge social-proof">{{ t('aiSocialProof', { count: selectedProduct.sales_count }) }}</p>
            <p v-if="message.price_anchor" class="ai-nudge price-anchor">{{ t('aiPriceAnchor', { originalPrice: money(selectedProduct.original_price), price: money(selectedProduct.price) }) }}</p>
          </div>
        </div>
        <div v-if="aiBusy" class="message assistant pending"><span>{{ aiType === 'seller' ? t('sellerAi') : t('guardianAi') }}</span><p><i></i><i></i><i></i></p></div>
      </div>
      <form class="ai-input" @submit.prevent="sendAiMessage"><textarea v-model="aiInput" rows="2" maxlength="800" :placeholder="aiType === 'seller' ? t('sellerPlaceholder') : t('guardianPlaceholder')" @keydown.enter.exact.prevent="sendAiMessage"></textarea><button :disabled="!aiInput.trim() || aiBusy">{{ t('send') }}</button></form>
    </aside>
    </Transition>

    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.kind"><CheckCircle2 v-if="toast.kind === 'success'" :size="19" /><X v-else :size="19" />{{ toast.message }}</div>
    </Transition>
  </div>
  </Transition>
</template>
