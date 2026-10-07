<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { buildResearchStimuli, researchProfile } from '../../../worker/src/modules/ai/research-patterns.mjs';

const props = defineProps({ product: { type: Object, required: true }, locale: { type: String, required: true }, placement: { type: String, required: true }, busy: Boolean });
const emit = defineEmits(['exposed', 'buy', 'decline', 'companion']);
const root = ref(null);
const stimuli = computed(() => buildResearchStimuli(props.product, props.locale));
const profile = computed(() => researchProfile(props.product));
const language = computed(() => props.locale === 'en' ? 'en' : 'zh');
const saving = computed(() => (Number(profile.value.referencePrice) - Number(props.product.price)).toFixed(2));
const cue = (type) => stimuli.value.find((item) => item.type === type);
const en = computed(() => props.locale === 'en');
const price = computed(() => Number(props.product.price).toFixed(2));
let observer;
let previousFocus;

onMounted(() => {
  if (props.placement === 'confirmation') {
    previousFocus = document.activeElement;
    root.value?.closest('[role="dialog"]')?.querySelector('button')?.focus();
  }
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const stimulus = stimuli.value.find((item) => item.type === entry.target.dataset.pattern);
      if (stimulus) emit('exposed', { productId: props.product.id, locale: props.locale, stimulus });
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.5 });
  root.value?.querySelectorAll('[data-pattern]').forEach((element) => observer.observe(element));
});
onUnmounted(() => {
  observer?.disconnect();
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>

<template>
  <div ref="root" :class="`shopping-cue-${placement}`">
    <div v-if="placement === 'price'" class="detail-price shopping-price" :data-pattern="cue('price_anchor') ? 'price_anchor' : undefined">
      <template v-if="cue('price_anchor')">
        <s>{{ cue('price_anchor').evidenceText.split(' · ')[0] }}</s> · <strong>{{ cue('price_anchor').evidenceText.split(' · ')[1] }}</strong>
        <span class="offer-price-tag">{{ en ? `Save ¥${saving}` : `直降 ¥${saving}` }}</span>
      </template>
      <template v-else><strong>¥{{ price }}</strong></template>
    </div>
    <p v-else-if="placement === 'activity' && cue('social_proof')" data-pattern="social_proof" class="shopping-activity">
      <span class="buyer-avatar">{{ en ? 'Buy' : '购' }}</span>{{ cue('social_proof').evidenceText }}
    </p>
    <section v-else-if="placement === 'endorsement' && cue('endorsement')" data-pattern="endorsement" class="product-endorsement">
      <span class="endorser-avatar">{{ en ? '★' : '荐' }}</span>
      <div><small>{{ en ? 'Celebrity pick · fictional research persona' : '名人推荐 · 虚构研究角色' }}</small><p>{{ cue('endorsement').evidenceText }}</p></div>
    </section>
    <section v-else-if="placement === 'companion' && cue('bundle_pressure')" data-pattern="bundle_pressure" class="product-companion">
      <strong>{{ en ? 'Complete your setup' : '一起搭配更完整' }}</strong>
      <p>{{ cue('bundle_pressure').evidenceText }}</p>
      <button type="button" class="text-button" @click="emit('companion', profile.companion.productId)">{{ en ? 'View companion' : '查看搭配商品' }} →</button>
    </section>
    <div v-else-if="placement === 'offer'" class="shopping-offer-line">
      <span v-if="cue('scarcity')" data-pattern="scarcity" class="offer-allocation">{{ cue('scarcity').evidenceText }}</span>
      <span v-if="cue('urgency')" data-pattern="urgency" class="offer-deadline">{{ cue('urgency').evidenceText }}</span>
    </div>
    <div v-else-if="placement === 'confirmation' && profile.dialog" class="cart-offer-content">
      <p class="eyebrow dark">{{ en ? 'YOUR DISCOUNT' : '当前折扣' }}</p>
      <h2>{{ profile.dialog.title[language] }}</h2>
      <div class="cart-offer-product"><img :src="product.image_url" :alt="product.name" /><div><strong>{{ product.name }}</strong><span>¥{{ price }}</span></div></div>
      <p class="cart-offer-note">{{ en ? 'The cart uses the price shown above. No extra items or charges.' : '按上方价格加入购物车，不添加其他商品或费用。' }}</p>
      <div data-pattern="visual_hierarchy" class="cart-offer-choices">
        <button type="button" class="primary-button full" :disabled="busy || product.stock < 1" @click="emit('buy')">{{ busy ? (en ? 'Adding…' : '正在加入…') : profile.dialog.accept[language] }}</button>
        <button type="button" data-pattern="confirmshaming" class="offer-decline" :disabled="busy" @click="emit('decline')">{{ cue('confirmshaming').evidenceText }}</button>
      </div>
    </div>
  </div>
</template>
