// Source-backed categories; stimuli below are fictional research reproductions.
import { productResearch } from '../../../store/product-research.mjs';
export const RESEARCH_VERSION = 'shopping-patterns-v3';
export const SOURCES = {
  endorsement: { title: 'FTC: Fake celebrity endorsements (2024)', url: 'https://consumer.ftc.gov/consumer-alerts/2024/04/did-celebrity-really-endorse-maybe-not', date: '2024-04-26', kind: 'documented-consumer-risk' },
  oecd: { title: 'OECD (2022), Dark commercial patterns', url: 'https://doi.org/10.1787/44f5e846-en', date: '2022-10-26', kind: 'theory-review' },
  temu: { title: 'European Commission / CPC: Temu findings (2024)', url: 'https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_5707/IP_24_5707_EN.pdf', date: '2024-11-08', kind: 'regulatory-findings' },
  sweep: { title: 'FTC / ICPEN subscription services review (2024)', url: 'https://www.ftc.gov/news-events/news/press-releases/2024/07/ftc-icpen-gpen-announce-results-review-use-dark-patterns-affecting-subscription-services-privacy', date: '2024-07-10', kind: 'sector-review' },
  fairness: { title: 'European Commission Digital Fairness fitness check (2024)', url: 'https://www.europarl.europa.eu/meetdocs/2024_2029/plmrep/COMMITTEES/IMCO/SWD/2024/11-18/COM_SWD20240230_EN.pdf', date: '2024-10-03', kind: 'consumer-survey-and-review' },
};

const definitions = {
  endorsement: { zh: ['名人背书', '背书可信度／身份联想（机制假说）', '推荐者是虚构研究角色；不构成真实名人推荐，也不证明适合你。'], en: ['Celebrity endorsement', 'Endorser credibility / identity association (hypothesis)', 'This is a fictional research persona, not an authentic celebrity endorsement.'], sources: ['endorsement'] },
  bundle_pressure: { zh: ['搭配购买压力', '需求框架（机制假说）', '搭配建议不等于必需配件；核对兼容性、已有物品和额外预算。'], en: ['Bundle pressure', 'Need framing (hypothesis)', 'A suggested companion is not necessarily required; check compatibility, ownership and cost.'], sources: ['oecd'] },
  scarcity: { zh: ['稀缺提示', '稀缺启发式', '活动名额不是商品库存；核对名额依据，再判断是否需要。'], en: ['Scarcity', 'Scarcity heuristic', 'Promotional places are not product stock; check the claim and your need.'], sources: ['temu', 'oecd'] },
  urgency: { zh: ['限时压力', '时间压力与损失框架', '没有可核验截止时间；先比较，不必赶在提示前下单。'], en: ['Urgency', 'Time pressure / loss framing', 'Verify the deadline; allow time to compare.'], sources: ['temu', 'oecd'] },
  social_proof: { zh: ['社会认同', '社会认同启发式', '热度不是适合度；此处数字为模拟，不能当作真实买家证据。'], en: ['Social proof', 'Social proof heuristic', 'Simulated popularity does not establish suitability.'], sources: ['temu', 'oecd'] },
  price_anchor: { zh: ['价格锚定', '锚定与参考价格效应', '划线价没有历史价格依据；比较当前总价及替代品。'], en: ['Price anchor', 'Anchoring / reference price effects', 'Compare current prices; the reference price has no price history.'], sources: ['temu', 'oecd'] },
  confirmshaming: { zh: ['羞辱式拒绝', '情绪框架（效果证据不一致）', '拒绝购买无需自责；把按钮理解为中性的“暂不购买”。'], en: ['Confirmshaming', 'Emotional framing (mixed evidence)', 'Declining a purchase requires no justification.'], sources: ['fairness', 'oecd'] },
  visual_hierarchy: { zh: ['误导性视觉层级', '显著性与框架效应', '按钮大小和颜色不是质量证据；继续比较是有效选择。'], en: ['False visual hierarchy', 'Salience / framing', 'Button prominence is not product evidence.'], sources: ['sweep', 'oecd'] },
};

export function patternBasis(type, locale = 'zh') {
  const definition = definitions[type];
  if (!definition) return null;
  const [label, mechanism, advice] = definition[locale === 'en' ? 'en' : 'zh'];
  return { label, mechanism, advice, references: definition.sources.map((id) => ({ id, ...SOURCES[id] })) };
}

export function enrichPattern(pattern, locale) {
  return { ...pattern, ...patternBasis(pattern.type, locale) };
}

export function buildResearchStimuli(product, locale = 'zh') {
  const en = locale === 'en';
  const profile = researchProfile(product);
  const reference = Number(profile.referencePrice).toFixed(2);
  const language = en ? 'en' : 'zh';
  const copy = {
    scarcity: en ? `Only ${profile.remainingPlaces} places left in this allocation` : `本轮预约名额仅剩 ${profile.remainingPlaces} 个`,
    urgency: en ? 'This discount is ending soon' : '本轮折扣即将结束',
    social_proof: en ? `${profile.cartAdds} shoppers added this to their carts today` : `今天已有 ${profile.cartAdds} 人加购`,
    price_anchor: en ? `Was ¥${reference} · now ¥${Number(product.price).toFixed(2)}` : `划线价 ¥${reference} · 当前 ¥${Number(product.price).toFixed(2)}`,
    endorsement: profile.endorsement ? `${profile.endorsement.actor[language]} · ${profile.endorsement[language]}` : '',
    bundle_pressure: profile.companion ? (en ? `Complete the experience with ${profile.companion.en}; get both together` : `搭配 ${profile.companion.zh} 才更完整，建议一起入手`) : '',
    confirmshaming: profile.dialog?.decline[language] || '',
    visual_hierarchy: profile.dialog ? `${profile.dialog.accept[language]} / ${profile.dialog.decline[language]}` : '',
  };
  const placements = { price_anchor: 'product-price', social_proof: 'product-activity', endorsement: 'product-endorsement', bundle_pressure: 'product-companion', scarcity: 'product-offer', urgency: 'product-offer', confirmshaming: 'add-to-cart-offer', visual_hierarchy: 'add-to-cart-offer' };
  return Object.entries(copy).filter(([type]) => profile.types.includes(type)).map(([type, evidenceText]) => ({
    id: `${RESEARCH_VERSION}:${product.id}:${locale}:${type}`,
    type, evidenceText, version: RESEARCH_VERSION,
    stage: placements[type], modality: 'text+visual', profile: profile.mode,
    provenance: 'synthetic-reproduction',
    ...patternBasis(type, locale),
  }));
}

export function researchProfile(product) {
  // Canonical product-specific data; never accept caller-provided source overrides.
  return productResearch[product.id] || { mode: 'none', types: [], dialog: null };
}
