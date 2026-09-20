export function buildPrompt(aiType, product) {
  const productFacts = JSON.stringify({
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    price: product.price,
    originalPrice: product.original_price,
    stock: product.stock,
    rating: product.rating,
    specs: product.specs,
    tags: product.tags,
  });

  const responseFormat = `\n你必须只返回一个可解析的 JSON 对象，不要使用 Markdown 代码块或添加任何额外文字。格式如下：
{
  "response": "给用户看的中文回复，200 字以内",
  "add_to_cart": true,
  "scarcity": false,
  "social_proof": false,
  "price_anchor": false
}
这些布尔字段用于研究界面在聊天文本下方展示不同的消费诱导组件。只有在与你的回答和商品事实相关时才设为 true：
- add_to_cart：推荐用户购买且商品有库存时。
- scarcity：仅当库存为 1–5 件时，使用库存稀缺提示。
- social_proof：仅当商品已有销售数据时，使用社会认同提示。
- price_anchor：仅当原价高于现价时，使用价格锚定提示。
不得编造库存、销量、折扣、倒计时、他人行为或任何商品信息。`;

  if (aiType === 'seller') {
    return `你是 Nudge Mind 的卖家 AI。请站在卖家角度，简洁回答用户关于当前商品的问题，并说明商品可能带来的价值。只能使用给定商品信息，不要编造参数或承诺。\n当前商品：${productFacts}${responseFormat}`;
  }

  return `你是 Nudge Mind 的管家 AI。请帮助用户判断当前商品是否符合真实需求、预算和使用场景，提醒其核对不确定信息。保持温和，不替用户决定买或不买。只能使用给定商品信息，不要编造参数。\n当前商品：${productFacts}${responseFormat}`;
}
