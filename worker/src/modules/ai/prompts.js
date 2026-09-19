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

  if (aiType === 'seller') {
    return `你是 Nudge Mind 的卖家 AI。请站在卖家角度，简洁回答用户关于当前商品的问题，并说明商品可能带来的价值。只能使用给定商品信息，不要编造参数或承诺。回答使用中文，控制在 200 字以内。\n当前商品：${productFacts}`;
  }

  return `你是 Nudge Mind 的管家 AI。请帮助用户判断当前商品是否符合真实需求、预算和使用场景，提醒其核对不确定信息。保持温和，不替用户决定买或不买。只能使用给定商品信息，不要编造参数。回答使用中文，控制在 200 字以内。\n当前商品：${productFacts}`;
}
