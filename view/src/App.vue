<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  LoaderCircle,
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

const user = ref(session.user);
const THEME_STORAGE_KEY = 'nudge-mind-theme';
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

const filteredProducts = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  return products.value.filter((product) => {
    const categoryMatches = selectedCategory.value === 'all' || product.category_id === selectedCategory.value;
    const textMatches = !keyword || [product.name, product.subtitle, product.description, ...(product.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
    return categoryMatches && textMatches;
  });
});

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + Number(item.quantity), 0));
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));

function money(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    products.value = productData.products;
    categories.value = categoryData.categories;
    cart.value = cartData.items;
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    catalogBusy.value = false;
  }
}

async function openProduct(product) {
  catalogBusy.value = true;
  try {
    selectedProduct.value = (await ProductAPI.detail(product.id)).product;
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
    cart.value = (await CartAPI.get()).items;
    notify('已加入购物车');
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function showCart() {
  page.value = 'cart';
  cartBusy.value = true;
  try {
    cart.value = (await CartAPI.get()).items;
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
    cart.value = (await CartAPI.get()).items;
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function removeCartItem(item) {
  try {
    await CartAPI.remove(item.id);
    cart.value = (await CartAPI.get()).items;
    notify('已从购物车移除');
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
    notify(`模拟购买完成：${result.orderNo}`);
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
    orders.value = (await OrderAPI.list()).orders;
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
  authError.value = '登录已过期，请重新登录。';
}

onMounted(() => {
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
        <span class="eyebrow">消费决策研究原型</span>
        <h1>在下单之前，<br />多一个思考的空间。</h1>
        <p>浏览研究商品、比较信息，并从两种不同立场的 AI 获取基础回应。</p>
      </div>
      <div class="story-note">研究版本 · 所有购买均为模拟行为</div>
    </section>

    <section class="auth-panel">
      <button
        class="theme-toggle auth-theme-toggle"
        type="button"
        :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        @click="toggleTheme"
      >
        <Sun v-if="theme === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>
      <form class="auth-card" @submit.prevent="submitAuth">
        <div>
          <p class="eyebrow dark">欢迎使用</p>
          <h2>{{ authMode === 'login' ? '登录 Nudge Mind' : '创建研究账户' }}</h2>
          <p class="muted">{{ authMode === 'login' ? '继续你的商品浏览与决策。' : '注册后即可进入研究商品目录。' }}</p>
        </div>

        <label>
          <span>用户名</span>
          <input v-model.trim="authForm.username" autocomplete="username" required minlength="2" maxlength="40" placeholder="请输入用户名" />
        </label>
        <label v-if="authMode === 'register'">
          <span>邮箱</span>
          <input v-model.trim="authForm.email" type="email" autocomplete="email" required placeholder="name@example.com" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" required minlength="8" placeholder="至少 8 位字符" />
        </label>
        <p v-if="authError" class="form-error">{{ authError }}</p>
        <button class="primary-button full" :disabled="authBusy">
          <LoaderCircle v-if="authBusy" :size="18" class="spin" />
          {{ authMode === 'login' ? '登录' : '注册并进入' }}
        </button>
        <button class="text-button" type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''">
          {{ authMode === 'login' ? '还没有账户？立即注册' : '已有账户？返回登录' }}
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
      <nav class="main-nav" aria-label="主导航">
        <button :class="{ active: page === 'browse' || page === 'detail' }" @click="goBrowse">发现</button>
        <button :class="{ active: page === 'orders' }" @click="showOrders"><History :size="17" />购买记录</button>
      </nav>
      <div class="top-actions">
        <button
          class="theme-toggle"
          type="button"
          :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="19" />
          <Moon v-else :size="19" />
        </button>
        <button class="cart-button" aria-label="购物车" @click="showCart">
          <ShoppingCart :size="20" />
          <span v-if="cartCount" class="cart-count">{{ cartCount }}</span>
        </button>
        <div class="user-chip"><User :size="17" />{{ user.username }}</div>
        <button class="icon-button" aria-label="退出登录" title="退出登录" @click="logout"><LogOut :size="19" /></button>
      </div>
    </header>

    <template v-if="page === 'browse'">
      <section class="hero">
        <div>
          <p class="eyebrow">Nudge Mind · 第一版</p>
          <h1>看看商品，也听听<br /><em>不同立场</em>的声音。</h1>
          <p>AI 入口只在商品详情中出现。信息与决定，始终由你掌握。</p>
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
            <p class="eyebrow dark">研究商品库</p>
            <h2>探索全部商品</h2>
          </div>
          <label class="search-box">
            <Search :size="19" />
            <input v-model="searchText" type="search" placeholder="搜索名称、介绍或标签" />
          </label>
        </div>

        <div class="category-row">
          <button :class="{ active: selectedCategory === 'all' }" @click="selectedCategory = 'all'">全部</button>
          <button v-for="category in categories" :key="category.id" :class="{ active: selectedCategory === category.id }" @click="selectedCategory = category.id">
            <span>{{ category.icon }}</span>{{ category.name }}
          </button>
        </div>

        <div v-if="catalogBusy" class="state-card"><LoaderCircle class="spin" />正在加载商品…</div>
        <div v-else-if="!filteredProducts.length" class="state-card"><Package />没有找到匹配的商品</div>
        <div v-else class="product-grid">
          <article v-for="product in filteredProducts" :key="product.id" class="product-card" @click="openProduct(product)">
            <div class="product-image-wrap">
              <img :src="product.image_url" :alt="product.name" />
              <span v-if="product.is_new" class="product-badge">NEW</span>
            </div>
            <div class="product-body">
              <div class="rating"><Star :size="15" fill="currentColor" /> {{ product.rating }} <span>· {{ product.sales_count }} 人关注</span></div>
              <h3>{{ product.name }}</h3>
              <p>{{ product.subtitle }}</p>
              <div class="product-foot">
                <div><strong>¥{{ money(product.price) }}</strong><s v-if="product.original_price">¥{{ money(product.original_price) }}</s></div>
                <button class="mini-cart" title="加入购物车" aria-label="加入购物车" @click.stop="addToCart(product.id)"><Plus :size="20" /></button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <main v-else-if="page === 'detail' && selectedProduct" class="page-container detail-page">
      <button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />返回商品列表</button>
      <div class="detail-layout">
        <section class="detail-visual">
          <img :src="selectedProduct.image_url" :alt="selectedProduct.name" />
          <span>研究样本 · {{ selectedProduct.category_name }}</span>
        </section>
        <section class="detail-info">
          <div class="rating"><Star :size="16" fill="currentColor" /> {{ selectedProduct.rating }} <span>· {{ selectedProduct.sales_count }} 人关注</span></div>
          <h1>{{ selectedProduct.name }}</h1>
          <p class="detail-subtitle">{{ selectedProduct.subtitle }}</p>
          <div class="detail-price"><strong>¥{{ money(selectedProduct.price) }}</strong><s v-if="selectedProduct.original_price">¥{{ money(selectedProduct.original_price) }}</s></div>
          <p class="detail-description">{{ selectedProduct.description }}</p>

          <div class="tag-list"><span v-for="tag in selectedProduct.tags" :key="tag">{{ tag }}</span></div>

          <section class="spec-panel">
            <h2>商品参数</h2>
            <dl>
              <template v-for="(value, key) in selectedProduct.specs" :key="key">
                <dt>{{ key }}</dt><dd>{{ value }}</dd>
              </template>
              <dt>库存</dt><dd>{{ selectedProduct.stock }} 件</dd>
            </dl>
          </section>

          <div class="detail-actions">
            <button class="primary-button" :disabled="selectedProduct.stock < 1" @click="addToCart(selectedProduct.id)"><ShoppingCart :size="19" />加入购物车</button>
          </div>

          <section class="ai-choice">
            <div><p class="eyebrow dark">基础 AI 对话</p><h2>你想问谁？</h2></div>
            <div class="ai-buttons">
              <button class="seller-button" @click="openAi('seller')"><Store :size="20" />问 卖家 AI</button>
              <button class="guardian-button" @click="openAi('guardian')"><ShieldCheck :size="20" />问 管家 AI</button>
            </div>
            <p>卖家 AI 从商品价值出发；管家 AI 帮你核对需求与风险。两者都只参考当前页面信息。</p>
          </section>
        </section>
      </div>
    </main>

    <main v-else-if="page === 'cart'" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">你的选择</p><h1>购物车</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />继续浏览</button></div>
      <div v-if="cartBusy" class="state-card"><LoaderCircle class="spin" />正在加载购物车…</div>
      <div v-else-if="!cart.length" class="empty-state"><ShoppingBag :size="48" /><h2>购物车还是空的</h2><p>从商品目录中挑选一些研究商品吧。</p><button class="primary-button" @click="goBrowse">浏览商品</button></div>
      <div v-else class="cart-layout">
        <section class="cart-list">
          <article v-for="item in cart" :key="item.id" class="cart-item">
            <img :src="item.image_url" :alt="item.name" />
            <div class="cart-item-main"><h3>{{ item.name }}</h3><p>单价 ¥{{ money(item.price) }} · 库存 {{ item.stock }}</p><button class="remove-button" @click="removeCartItem(item)"><Trash2 :size="16" />移除</button></div>
            <div class="quantity-control"><button @click="changeQuantity(item, -1)"><Minus :size="16" /></button><span>{{ item.quantity }}</span><button :disabled="item.quantity >= item.stock" @click="changeQuantity(item, 1)"><Plus :size="16" /></button></div>
            <strong>¥{{ money(item.price * item.quantity) }}</strong>
          </article>
        </section>
        <aside class="summary-card">
          <p class="eyebrow dark">订单小计</p>
          <div><span>商品数量</span><strong>{{ cartCount }} 件</strong></div>
          <div><span>配送费用</span><strong>¥0.00</strong></div>
          <div class="summary-total"><span>合计</span><strong>¥{{ money(cartTotal) }}</strong></div>
          <button class="primary-button full" @click="checkoutOpen = true">模拟购买</button>
          <p>本研究项目不会发起真实付款或配送。</p>
        </aside>
      </div>
    </main>

    <main v-else-if="page === 'orders'" class="page-container">
      <div class="page-heading"><div><p class="eyebrow dark">研究记录</p><h1>购买记录</h1></div><button class="back-button" @click="goBrowse"><ArrowLeft :size="18" />返回商品</button></div>
      <div v-if="ordersBusy" class="state-card"><LoaderCircle class="spin" />正在加载记录…</div>
      <div v-else-if="!orders.length" class="empty-state"><History :size="48" /><h2>暂无购买记录</h2><p>完成模拟购买后，订单会显示在这里。</p></div>
      <section v-else class="order-list">
        <article v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-head"><div><span>{{ order.order_no }}</span><p>{{ order.created_at }}</p></div><span class="status-pill"><CheckCircle2 :size="15" />已完成</span></div>
          <div class="order-items">
            <div v-for="item in order.items" :key="item.id"><img :src="item.product_image" :alt="item.product_name" /><span>{{ item.product_name }} × {{ item.quantity }}</span><strong>¥{{ money(item.subtotal) }}</strong></div>
          </div>
          <div class="order-total">合计 <strong>¥{{ money(order.final_amount) }}</strong></div>
        </article>
      </section>
    </main>

    <div v-if="checkoutOpen" class="modal-backdrop" @click.self="checkoutOpen = false">
      <form class="modal-card" @submit.prevent="submitOrder">
        <button class="modal-close" type="button" aria-label="关闭" @click="checkoutOpen = false"><X /></button>
        <p class="eyebrow dark">模拟购买</p><h2>确认研究信息</h2><p class="muted">以下信息只用于保存本次模拟订单。</p>
        <label><span>姓名</span><input v-model.trim="checkoutForm.name" required maxlength="50" /></label>
        <label><span>联系电话</span><input v-model.trim="checkoutForm.phone" required maxlength="30" placeholder="研究用信息" /></label>
        <label><span>地址</span><textarea v-model.trim="checkoutForm.address" required maxlength="200" rows="3" placeholder="研究用信息"></textarea></label>
        <div class="modal-total"><span>模拟支付金额</span><strong>¥{{ money(cartTotal) }}</strong></div>
        <button class="primary-button full" :disabled="checkoutBusy"><LoaderCircle v-if="checkoutBusy" :size="18" class="spin" />确认模拟购买</button>
      </form>
    </div>

    <aside v-if="aiOpen" class="ai-drawer">
      <header :class="aiType"><div><span class="ai-avatar"><Store v-if="aiType === 'seller'" /><ShieldCheck v-else /></span><div><p>{{ aiType === 'seller' ? '卖家视角' : '消费管家' }}</p><h2>{{ aiType === 'seller' ? '卖家 AI' : '管家 AI' }}</h2></div></div><button aria-label="关闭 AI 对话" @click="aiOpen = false"><X /></button></header>
      <div class="ai-context"><img :src="selectedProduct.image_url" :alt="selectedProduct.name" /><div><span>正在讨论</span><strong>{{ selectedProduct.name }}</strong></div></div>
      <div class="message-list">
        <div v-if="!aiMessages.length && !aiBusy" class="ai-empty"><MessageCircle :size="35" /><p>{{ aiType === 'seller' ? '可以询问商品特点、用途或购买价值。' : '可以询问需求匹配、预算或购买风险。' }}</p></div>
        <div v-for="(message, index) in aiMessages" :key="index" class="message" :class="message.role"><span>{{ message.role === 'user' ? '你' : (aiType === 'seller' ? '卖家 AI' : '管家 AI') }}</span><p>{{ message.content }}</p></div>
        <div v-if="aiBusy" class="message assistant pending"><span>{{ aiType === 'seller' ? '卖家 AI' : '管家 AI' }}</span><p><i></i><i></i><i></i></p></div>
      </div>
      <form class="ai-input" @submit.prevent="sendAiMessage"><textarea v-model="aiInput" rows="2" maxlength="800" :placeholder="aiType === 'seller' ? '问问这件商品有什么价值…' : '问问是否适合你的需求…'" @keydown.enter.exact.prevent="sendAiMessage"></textarea><button :disabled="!aiInput.trim() || aiBusy">发送</button></form>
    </aside>

    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.kind"><CheckCircle2 v-if="toast.kind === 'success'" :size="19" /><X v-else :size="19" />{{ toast.message }}</div>
    </Transition>
  </div>
</template>
