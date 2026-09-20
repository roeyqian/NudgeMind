<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  LoaderCircle,
  ListFilter,
  LogOut,
  MessageCircle,
  Minus,
  Moon,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
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
import { LOCALE_STORAGE_KEY, localizeCatalogItem, messages, translateCatalogText } from './i18n.js';

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
const catalogBusy = ref(false);

const cart = ref([]);
const cartBusy = ref(false);
const checkoutOpen = ref(false);
const checkoutBusy = ref(false);
const checkoutForm = reactive({ name: '', phone: '', address: '' });
const orders = ref([]);
const ordersBusy = ref(false);

const aiOpen = ref(false);
const aiType = ref('seller');
const aiMessages = ref([]);
const aiInput = ref('');
const aiBusy = ref(false);

const toast = reactive({ show: false, message: '', kind: 'success' });
let toastTimer;

function t(key, params = {}) {
  return (messages[locale.value][key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

function localizeItems(items) {
  return items.map((item) => localizeCatalogItem(item, locale.value));
}

function localizeCategories(items) {
  return items.map((item) => ({ ...item, name: translateCatalogText(item.name, locale.value) }));
}

function applyLocale() {
  products.value = localizeItems(products.value);
  categories.value = localizeCategories(categories.value);
  cart.value = localizeItems(cart.value);
  orders.value = orders.value.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item, product_name: translateCatalogText(item.product_name, locale.value) })),
  }));
  selectedProduct.value = localizeCatalogItem(selectedProduct.value, locale.value);
}

function toggleLocale() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem(LOCALE_STORAGE_KEY, locale.value);
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN';
  document.title = 'Nudge Mind';
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  applyLocale();
}

const filteredProducts = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  const matchingProducts = products.value.filter((product) => {
    const categoryMatches = selectedCategory.value === 'all' || product.category_id === selectedCategory.value;
    const textMatches = !keyword || [product.name, product.subtitle, product.description, ...(product.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
    return categoryMatches && textMatches;
  });

  if (productSort.value === 'default') return matchingProducts;

  return [...matchingProducts].sort((left, right) => {
    if (productSort.value === 'name') return compareProductsByName(left, right);

    const priceDifference = Number(left.price) - Number(right.price);
    const direction = productSort.value === 'price-desc' ? -1 : 1;
    return priceDifference === 0 ? compareProductsByName(left, right) : priceDifference * direction;
  });
});

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + Number(item.quantity), 0));
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));

function money(value) {
  return Number(value || 0).toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compareProductsByName(left, right) {
  return left.name.localeCompare(right.name, locale.value === 'en' ? 'en' : 'zh-Hans-CN-u-co-pinyin', { numeric: true, sensitivity: 'base' }) || String(left.id).localeCompare(String(right.id));
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
  toastTimer = setTimeout(() => { toast.show = false; }, 2600);
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
  categories.value = [];
  cart.value = [];
  orders.value = [];
  selectedProduct.value = null;
  aiOpen.value = false;
  page.value = 'browse';
}

async function loadInitialData() {
  catalogBusy.value = true;
  try {
    const [productData, categoryData, cartData] = await Promise.all([
      ProductAPI.list({ limit: 100 }),
      ProductAPI.categories(),
      CartAPI.get(),
    ]);
    products.value = localizeItems(productData.products);
    categories.value = localizeCategories(categoryData.categories);
    cart.value = localizeItems(cartData.items);
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    catalogBusy.value = false;
  }
}

async function openProduct(product) {
  catalogBusy.value = true;
  try {
    selectedProduct.value = localizeCatalogItem((await ProductAPI.detail(product.id)).product, locale.value);
    page.value = 'detail';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    catalogBusy.value = false;
  }
}

async function addToCart(productId, quantity = 1) {
  try {
    await CartAPI.add(productId, quantity);
    cart.value = localizeItems((await CartAPI.get()).items);
    notify(t('added'));
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function showCart() {
  page.value = 'cart';
  cartBusy.value = true;
  try {
    cart.value = localizeItems((await CartAPI.get()).items);
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
    cart.value = localizeItems((await CartAPI.get()).items);
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function removeCartItem(item) {
  try {
    await CartAPI.remove(item.id);
    cart.value = localizeItems((await CartAPI.get()).items);
    notify(t('removed'));
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function submitOrder() {
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
  page.value = 'orders';
  ordersBusy.value = true;
  try {
    orders.value = (await OrderAPI.list()).orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({ ...item, product_name: translateCatalogText(item.product_name, locale.value) })),
    }));
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    ordersBusy.value = false;
  }
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
    });
    aiMessages.value.push({ role: 'assistant', content: result.response });
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
  selectedProduct.value = null;
  aiOpen.value = false;
}

function handleExpired() {
  resetSession();
  authError.value = t('sessionExpired');
}

onMounted(() => {
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN';
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  if (user.value) {
    checkoutForm.name = user.value.username;
    loadInitialData();
  }
});

onUnmounted(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  clearTimeout(toastTimer);
});
</script>

<template>
  <main v-if="!user" class="auth-shell">
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
        <Sun v-if="theme === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>
      <form class="auth-card" @submit.prevent="submitAuth">
        <div>
          <p class="eyebrow dark">{{ t('welcome') }}</p>
          <h2>{{ authMode === 'login' ? t('loginTitle') : t('registerTitle') }}</h2>
          <p class="muted">{{ authMode === 'login' ? t('loginIntro') : t('registerIntro') }}</p>
        </div>

        <label>
          <span>{{ t('username') }}</span>
          <input v-model.trim="authForm.username" autocomplete="username" required minlength="2" maxlength="40" :placeholder="t('usernamePlaceholder')" />
        </label>
        <label v-if="authMode === 'register'">
          <span>{{ t('email') }}</span>
          <input v-model.trim="authForm.email" type="email" autocomplete="email" required placeholder="name@example.com" />
        </label>
        <label>
          <span>{{ t('password') }}</span>
          <input v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" required minlength="8" :placeholder="t('passwordPlaceholder')" />
        </label>
        <p v-if="authError" class="form-error">{{ authError }}</p>
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

  <div v-else class="app-shell">
    <header class="topbar">
      <button class="brand brand-button" @click="goBrowse">
        <img class="brand-logo" src="/favicon.svg" alt="" />
        <span>Nudge Mind</span>
      </button>
      <nav class="main-nav" :aria-label="t('discover')">
        <button :class="{ active: page === 'browse' || page === 'detail' }" @click="goBrowse">{{ t('discover') }}</button>
        <button :class="{ active: page === 'orders' }" @click="showOrders"><History :size="17" />{{ t('purchaseHistory') }}</button>
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
          <Sun v-if="theme === 'dark'" :size="19" />
          <Moon v-else :size="19" />
        </button>
        <button class="cart-button" :aria-label="t('cart')" @click="showCart">
          <ShoppingCart :size="20" />
          <span v-if="cartCount" class="cart-count">{{ cartCount }}</span>
        </button>
        <div class="user-chip"><User :size="17" />{{ user.username }}</div>
        <button class="icon-button" :aria-label="t('logout')" :title="t('logout')" @click="logout"><LogOut :size="19" /></button>
      </div>
    </header>

    <template v-if="page === 'browse'">
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
        <div v-else-if="!filteredProducts.length" class="state-card"><Package />{{ t('noProducts') }}</div>
        <div v-else class="product-grid">
          <article v-for="product in filteredProducts" :key="product.id" class="product-card" @click="openProduct(product)">
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
        </div>
      </section>
    </template>

    <main v-else-if="page === 'detail' && selectedProduct" class="page-container detail-page">
      <button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('backToProducts') }}</button>
      <div class="detail-layout">
        <section class="detail-visual">
          <img :src="selectedProduct.image_url" :alt="selectedProduct.name" />
          <span>{{ t('researchSample') }} · {{ selectedProduct.category_name }}</span>
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
              <template v-for="(value, key) in selectedProduct.specs" :key="key">
                <dt>{{ key }}</dt><dd>{{ value }}</dd>
              </template>
              <dt>{{ t('stock') }}</dt><dd>{{ selectedProduct.stock }} {{ t('pieces') }}</dd>
            </dl>
          </section>

          <div class="detail-actions">
            <button class="primary-button" :disabled="selectedProduct.stock < 1" @click="addToCart(selectedProduct.id)"><ShoppingCart :size="19" />{{ t('addToCart') }}</button>
          </div>

          <section class="ai-choice">
            <div><p class="eyebrow dark">{{ t('basicAi') }}</p><h2>{{ t('askWho') }}</h2></div>
            <div class="ai-buttons">
              <button class="seller-button" @click="openAi('seller')"><Store :size="20" />{{ t('askSeller') }}</button>
              <button class="guardian-button" @click="openAi('guardian')"><ShieldCheck :size="20" />{{ t('askGuardian') }}</button>
            </div>
            <p>{{ t('aiDescription') }}</p>
          </section>
        </section>
      </div>
    </main>

    <main v-else-if="page === 'cart'" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">{{ t('yourChoices') }}</p><h1>{{ t('cart') }}</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('continueBrowsing') }}</button></div>
      <div v-if="cartBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingCart') }}</div>
      <div v-else-if="!cart.length" class="empty-state"><ShoppingBag :size="48" /><h2>{{ t('emptyCart') }}</h2><p>{{ t('emptyCartText') }}</p><button class="primary-button" @click="goBrowse">{{ t('browseProducts') }}</button></div>
      <div v-else class="cart-layout">
        <section class="cart-list">
          <article v-for="item in cart" :key="item.id" class="cart-item">
            <img :src="item.image_url" :alt="item.name" />
            <div class="cart-item-main"><h3>{{ item.name }}</h3><p>{{ t('unitPrice') }} {{ t('currency') }}{{ money(item.price) }} · {{ t('stock') }} {{ item.stock }}</p><button class="remove-button" @click="removeCartItem(item)"><Trash2 :size="16" />{{ t('remove') }}</button></div>
            <div class="quantity-control"><button @click="changeQuantity(item, -1)"><Minus :size="16" /></button><span>{{ item.quantity }}</span><button :disabled="item.quantity >= item.stock" @click="changeQuantity(item, 1)"><Plus :size="16" /></button></div>
            <strong>{{ t('currency') }}{{ money(item.price * item.quantity) }}</strong>
          </article>
        </section>
        <aside class="summary-card">
          <p class="eyebrow dark">{{ t('orderSubtotal') }}</p>
          <div><span>{{ t('itemCount') }}</span><strong>{{ cartCount }} {{ t('pieces') }}</strong></div>
          <div><span>{{ t('shipping') }}</span><strong>{{ t('currency') }}0.00</strong></div>
          <div class="summary-total"><span>{{ t('total') }}</span><strong>{{ t('currency') }}{{ money(cartTotal) }}</strong></div>
          <button class="primary-button full" @click="checkoutOpen = true">{{ t('simulatedPurchase') }}</button>
          <p>{{ t('noRealPayment') }}</p>
        </aside>
      </div>
    </main>

    <main v-else-if="page === 'orders'" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">{{ t('researchRecords') }}</p><h1>{{ t('purchaseHistory') }}</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />{{ t('backToItems') }}</button></div>
      <div v-if="ordersBusy" class="state-card"><LoaderCircle class="spin" />{{ t('loadingOrders') }}</div>
      <div v-else-if="!orders.length" class="empty-state"><History :size="48" /><h2>{{ t('noOrders') }}</h2><p>{{ t('noOrdersText') }}</p></div>
      <section v-else class="order-list">
        <article v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-head"><div><span>{{ order.order_no }}</span><p>{{ order.created_at }}</p></div><span class="status-pill"><CheckCircle2 :size="15" />{{ t('completed') }}</span></div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id"><img :src="item.product_image" :alt="item.product_name" /><span>{{ item.product_name }} × {{ item.quantity }}</span><strong>{{ t('currency') }}{{ money(item.subtotal) }}</strong></div>
          </div>
          <div class="order-total">{{ t('total') }} <strong>{{ t('currency') }}{{ money(order.final_amount) }}</strong></div>
        </article>
      </section>
    </main>

    <div v-if="checkoutOpen" class="modal-backdrop" @click.self="checkoutOpen = false">
      <form class="modal-card" @submit.prevent="submitOrder">
        <button class="modal-close" type="button" :aria-label="t('close')" @click="checkoutOpen = false"><X /></button>
        <p class="eyebrow dark">{{ t('simulatedPurchase') }}</p><h2>{{ t('confirmInfo') }}</h2><p class="muted">{{ t('orderInfoOnly') }}</p>
        <label><span>{{ t('name') }}</span><input v-model.trim="checkoutForm.name" required maxlength="50" /></label>
        <label><span>{{ t('phone') }}</span><input v-model.trim="checkoutForm.phone" required maxlength="30" :placeholder="t('researchInfo')" /></label>
        <label><span>{{ t('address') }}</span><textarea v-model.trim="checkoutForm.address" required maxlength="200" rows="3" :placeholder="t('researchInfo')"></textarea></label>
        <div class="modal-total"><span>{{ t('paymentAmount') }}</span><strong>{{ t('currency') }}{{ money(cartTotal) }}</strong></div>
        <button class="primary-button full" :disabled="checkoutBusy"><LoaderCircle v-if="checkoutBusy" :size="18" class="spin" />{{ t('confirmPurchase') }}</button>
      </form>
    </div>

    <aside v-if="aiOpen" class="ai-drawer">
      <header :class="aiType"><div><span class="ai-avatar"><Store v-if="aiType === 'seller'" /><ShieldCheck v-else /></span><div><p>{{ aiType === 'seller' ? t('sellerView') : t('guardian') }}</p><h2>{{ aiType === 'seller' ? t('sellerAi') : t('guardianAi') }}</h2></div></div><button :aria-label="t('close')" @click="aiOpen = false"><X /></button></header>
      <div class="ai-context"><img :src="selectedProduct.image_url" :alt="selectedProduct.name" /><div><span>{{ t('discussing') }}</span><strong>{{ selectedProduct.name }}</strong></div></div>
      <div class="message-list">
        <div v-if="!aiMessages.length && !aiBusy" class="ai-empty"><MessageCircle :size="35" /><p>{{ aiType === 'seller' ? t('sellerEmpty') : t('guardianEmpty') }}</p></div>
        <div v-for="(message, index) in aiMessages" :key="index" class="message" :class="message.role"><span>{{ message.role === 'user' ? t('you') : (aiType === 'seller' ? t('sellerAi') : t('guardianAi')) }}</span><p>{{ message.content }}</p></div>
        <div v-if="aiBusy" class="message assistant pending"><span>{{ aiType === 'seller' ? t('sellerAi') : t('guardianAi') }}</span><p><i></i><i></i><i></i></p></div>
      </div>
      <form class="ai-input" @submit.prevent="sendAiMessage"><textarea v-model="aiInput" rows="2" maxlength="800" :placeholder="aiType === 'seller' ? t('sellerPlaceholder') : t('guardianPlaceholder')" @keydown.enter.exact.prevent="sendAiMessage"></textarea><button :disabled="!aiInput.trim() || aiBusy">{{ t('send') }}</button></form>
    </aside>

    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.kind"><CheckCircle2 v-if="toast.kind === 'success'" :size="19" /><X v-else :size="19" />{{ toast.message }}</div>
    </Transition>
  </div>
</template>
