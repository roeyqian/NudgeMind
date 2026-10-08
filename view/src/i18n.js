export const LOCALE_STORAGE_KEY = 'nudge-mind-locale';

export const messages = {
  zh: {
    openMenu: '打开导航菜单',
    closeMenu: '关闭导航菜单',
    prototype: '消费决策研究原型', prePurchase: '在下单之前，', thinkingSpace: '多一个思考的空间。', authIntro: '浏览研究商品、比较信息，并从两种不同立场的 AI 获取基础回应。', researchOnly: '研究版本 · 价格、热度及优惠提示均为模拟，不会实际付款', welcome: '欢迎使用', loginTitle: '登录 Nudge Mind', registerTitle: '创建研究账户', loginIntro: '继续你的商品浏览与决策。', registerIntro: '注册后即可进入研究商品目录。', username: '用户名', usernamePlaceholder: '请输入用户名', email: '邮箱', password: '密码', passwordPlaceholder: '至少 8 位字符', login: '登录', register: '注册并进入', noAccount: '还没有账户？立即注册', hasAccount: '已有账户？返回登录', discover: '发现', advisor: '需求顾问', advisorEyebrow: '个性化商品匹配', advisorTitle: '告诉我你真正需要什么', advisorText: '描述使用场景、预算或偏好，顾问会从目录中挑选匹配商品，并说明每项推荐的依据。', advisorPrompt: '你的需求', advisorPlaceholder: '例如：想给每天通勤用的耳机，重视降噪和长时间佩戴，预算适中。', advisorDisclosure: '推荐仅基于你提供的需求和目录中的商品信息；不会使用虚假的紧迫提示或隐藏推荐依据。', advisorSubmit: '获取透明推荐', advisorMatching: '正在匹配…', advisorResults: '匹配结果', advisorFallbackIntro: '以下商品与您描述的需求较为接近，建议结合预算和参数自行判断。', advisorMatch: '匹配 {number}', advisorDetails: '查看详情', purchaseHistory: '购买记录', chatHistory: '聊天记录', chatHistorySortNewest: '时间：最新优先', chatHistorySortOldest: '时间：最早优先', cart: '购物车', logout: '退出登录', switchToLight: '切换到浅色模式', switchToDark: '切换到深色模式', designedChoices: '被设计的选择', heroTitle: '当 AI 学会利用它诱导你的消费决策', heroText: '当传统的界面诱导遇上能够理解用户的人工智能，每一个按钮、提示、推荐与默认选项，都可能成为推动你下单或让你放弃购买的一部分。', researchCatalog: '研究商品库', exploreAll: '探索全部商品', searchPlaceholder: '搜索名称、介绍或标签', productSort: '商品排序', defaultSort: '综合排序', nameSort: '首字母 A–Z', priceAsc: '价格从低到高', priceDesc: '价格从高到低', all: '全部', loadingProducts: '正在加载商品…', noProducts: '没有找到匹配的商品', followers: '人关注', addToCart: '加入购物车', backToProducts: '返回商品列表', researchSample: '研究样本', productSpecs: '商品参数', stock: '库存', pieces: '件', basicAi: '基础 AI 对话', askWho: '你想问谁？', askSeller: '问 卖家 AI', askGuardian: '问 管家 AI', aiDescription: '卖家 AI 从商品价值出发；管家 AI 帮你核对需求与风险。两者都只参考当前页面信息。', yourChoices: '你的选择', continueBrowsing: '继续浏览', loadingCart: '正在加载购物车…', emptyCart: '购物车还是空的', emptyCartText: '从商品目录中挑选一些研究商品吧。', browseProducts: '浏览商品', unitPrice: '单价', remove: '移除', orderSubtotal: '订单小计', itemCount: '商品数量', shipping: '配送费用', total: '合计', simulatedPurchase: '模拟购买', noRealPayment: '本研究项目不会发起真实付款或配送。', researchRecords: '研究记录', backToItems: '返回商品', loadingOrders: '正在加载记录…', noOrders: '暂无购买记录', noOrdersText: '完成模拟购买后，订单会显示在这里。', loadingChatHistory: '正在加载聊天记录…', noChatHistory: '暂无聊天记录', noChatHistoryText: '与卖家 AI 或管家 AI 开始对话后，记录会显示在这里。', completed: '已完成', close: '关闭', confirmInfo: '确认研究信息', orderInfoOnly: '以下信息只用于保存本次模拟订单。', name: '姓名', phone: '联系电话', address: '地址', researchInfo: '研究用信息', paymentAmount: '模拟支付金额', confirmPurchase: '确认模拟购买', sellerView: '卖家视角', guardian: '消费管家', sellerAi: '卖家 AI', guardianAi: '管家 AI', discussing: '正在讨论', sellerEmpty: '可以询问商品特点、用途或购买价值。', guardianEmpty: '可以询问需求匹配、预算或购买风险。', you: '你', sellerPlaceholder: '问问这件商品有什么价值…', guardianPlaceholder: '问问是否适合你的需求…', send: '发送', added: '已加入购物车', removed: '已从购物车移除', aiAddToCart: '加入购物车', aiScarcity: '库存紧张：仅剩 {stock} 件', aiSocialProof: '已有 {count} 人购买这件商品', aiPriceAnchor: '参考原价 ¥{originalPrice}，当前 ¥{price}', orderComplete: '模拟购买完成：{orderNo}', sessionExpired: '登录已过期，请重新登录。', language: 'English', pageDescription: 'Nudge Mind 消费决策研究原型', currency: '¥', new: 'NEW',
  },
  en: {
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    prototype: 'CONSUMER DECISION RESEARCH PROTOTYPE', prePurchase: 'Before you buy,', thinkingSpace: 'make room to think.', authIntro: 'Browse research products, compare information, and get baseline responses from AI with two different perspectives.', researchOnly: 'Research version · prices, popularity and offers are simulated; no real payment', welcome: 'WELCOME', loginTitle: 'Sign in to Nudge Mind', registerTitle: 'Create a research account', loginIntro: 'Continue browsing products and considering your choices.', registerIntro: 'Register to enter the research product catalog.', username: 'Username', usernamePlaceholder: 'Enter your username', email: 'Email', password: 'Password', passwordPlaceholder: 'At least 8 characters', login: 'Sign in', register: 'Register and enter', noAccount: 'No account yet? Register now', hasAccount: 'Already have an account? Sign in', discover: 'Discover', advisor: 'Needs advisor', advisorEyebrow: 'PERSONALISED PRODUCT MATCHING', advisorTitle: 'Tell us what you genuinely need', advisorText: 'Describe your use case, budget, or preferences. The advisor will select catalog items and explain the basis for each recommendation.', advisorPrompt: 'What are you looking for?', advisorPlaceholder: 'For example: headphones for a daily commute, with noise cancellation and long-wear comfort, at a moderate budget.', advisorDisclosure: 'Recommendations use only your stated need and catalog facts. They do not use false urgency or conceal why items were selected.', advisorSubmit: 'Get transparent matches', advisorMatching: 'Matching…', advisorResults: 'YOUR MATCHES', advisorFallbackIntro: 'These items appear closest to your stated needs; compare their price and specifications before deciding.', advisorMatch: 'Match {number}', advisorDetails: 'View details', purchaseHistory: 'Purchase history', chatHistory: 'Chat history', chatHistorySortNewest: 'Time: newest first', chatHistorySortOldest: 'Time: oldest first', cart: 'Cart', logout: 'Sign out', switchToLight: 'Switch to light mode', switchToDark: 'Switch to dark mode', designedChoices: 'Designed choices', heroTitle: 'When AI learns to steer your buying decisions', heroText: 'When conventional interface nudges meet AI that understands its users, every button, prompt, recommendation, and default can become part of what moves you to buy—or stop.', researchCatalog: 'RESEARCH PRODUCT LIBRARY', exploreAll: 'Explore all products', searchPlaceholder: 'Search names, descriptions, or tags', productSort: 'Product sort', defaultSort: 'Recommended', nameSort: 'Name A–Z', priceAsc: 'Price: low to high', priceDesc: 'Price: high to low', all: 'All', loadingProducts: 'Loading products…', noProducts: 'No matching products found', followers: 'followers', addToCart: 'Add to cart', backToProducts: 'Back to products', researchSample: 'Research sample', productSpecs: 'Product specifications', stock: 'In stock', pieces: '', basicAi: 'BASELINE AI CHAT', askWho: 'Who would you like to ask?', askSeller: 'Ask Seller AI', askGuardian: 'Ask Guardian AI', aiDescription: 'Seller AI focuses on product value; Guardian AI helps check needs and risks. Both use only the information on this page.', yourChoices: 'YOUR CHOICES', continueBrowsing: 'Continue browsing', loadingCart: 'Loading cart…', emptyCart: 'Your cart is empty', emptyCartText: 'Choose some research products from the catalog.', browseProducts: 'Browse products', unitPrice: 'Unit price', remove: 'Remove', orderSubtotal: 'ORDER SUMMARY', itemCount: 'Items', shipping: 'Shipping', total: 'Total', simulatedPurchase: 'Simulated purchase', noRealPayment: 'This research project will not initiate real payment or delivery.', researchRecords: 'RESEARCH RECORDS', backToItems: 'Back to products', loadingOrders: 'Loading records…', noOrders: 'No purchase history yet', noOrdersText: 'Orders will appear here after you complete a simulated purchase.', loadingChatHistory: 'Loading chat history…', noChatHistory: 'No chat history yet', noChatHistoryText: 'Conversations with Seller AI or Guardian AI will appear here.', completed: 'Completed', close: 'Close', confirmInfo: 'Confirm research details', orderInfoOnly: 'This information is used only to save this simulated order.', name: 'Name', phone: 'Phone', address: 'Address', researchInfo: 'Research-use information', paymentAmount: 'Simulated payment', confirmPurchase: 'Confirm simulated purchase', sellerView: 'SELLER PERSPECTIVE', guardian: 'CONSUMER GUARDIAN', sellerAi: 'Seller AI', guardianAi: 'Guardian AI', discussing: 'Discussing', sellerEmpty: 'Ask about the product’s features, uses, or purchase value.', guardianEmpty: 'Ask about needs, budget, or purchase risks.', you: 'You', sellerPlaceholder: 'What value does this product offer?', guardianPlaceholder: 'Is this suitable for my needs?', send: 'Send', added: 'Added to cart', removed: 'Removed from cart', aiAddToCart: 'Add to cart', aiScarcity: 'Low stock: only {stock} left', aiSocialProof: '{count} people have bought this item', aiPriceAnchor: 'Was ¥{originalPrice}; now ¥{price}', orderComplete: 'Simulated purchase complete: {orderNo}', sessionExpired: 'Your session has expired. Please sign in again.', language: '中文', pageDescription: 'Nudge Mind consumer decision research prototype', currency: '¥', new: 'NEW',
  },
};

Object.assign(messages.zh, {
  requiredField: '必填',
  optionalField: '选填',
  purchaseNeeds: '购买需求',
  purchaseNeedsPlaceholder: '例如：想买一副通勤用的耳机，需要降噪、佩戴舒适，预算 500 元以内。',
  purchaseNeedsHint: '请具体说明自己想买什么，可补充用途、预算和偏好。',
  purchaseNeedsRequired: '请填写购买需求，具体说明自己想买什么',
  guardianExposureNote: '浏览器报告进入视区的模拟刺激；不代表已影响你的选择',
  guardianReturnToCompare: '返回比较',
  officialProductSource: '查看品牌官方资料',
  sourceCheckedAt: '资料核对日期',
  catalogDisclosure: '真实商品资料 · 价格、库存、评分、热度及促销名额、期限为研究模拟数据；图片为商品标签示意。',
  productSourceNote: '名称、规格和介绍根据官方资料整理，宣传文案为改写摘要。实际在售版本及包装请以品牌资料为准。',
  deleteChat: '删除对话',
  deleteChatConfirm: '确定删除“{product}”与{ai}的整段对话吗？删除后无法恢复。',
  chatDeleted: '对话已删除',
  guardianReviewing: '管家正在审阅购物车…',
  guardianInterventionTitle: '购买前，和消费管家再核对一次',
  guardianInterventionIntro: '分析结合原文证据与真实研究中的心理机制；模拟促销数据不是真实商家证据，是否购买仍由你决定。',
  guardianNeedsReview: '管家未给出单独建议，请结合自己的需求、预算和已有物品判断。',
  guardianRemove: '移出购物车',
  guardianKeep: '可以保留，但请自行核对',
  guardianClearCart: '移除出购物车',
  guardianContinue: '仍然确认模拟购买',
  guardianFoundPrompts: '发现的提示',
  guardianSellerChatFound: '曾与这件商品的卖家 AI 对话。',
  guardianNoSellerChat: '没有这件商品的卖家 AI 对话记录。',
  guardianNoPatterns: '未发现以下类别的提示。',
  guardianSellerPrompt: '卖家 AI',
  guardianProductPrompt: '已记录的页面模拟刺激',
  guardianSeeQuote: '查看原话',
  guardianSeeBasis: '查看页面依据',
  guardianPattern_scarcity: '稀缺提示',
  guardianPattern_social_proof: '社会认同提示',
  guardianPattern_price_anchor: '价格锚定提示',
  guardianPatternAdvice_scarcity: '库存数字可以核对，但不代表需要立即购买。',
  guardianPatternAdvice_social_proof: '他人的关注或购买不代表这件商品适合你。',
  guardianPatternAdvice_price_anchor: '请按当前价格和自身需求判断，不要只看原价对比。',
});

Object.assign(messages.en, {
  requiredField: 'Required',
  optionalField: 'Optional',
  purchaseNeeds: 'Purchase needs',
  purchaseNeedsPlaceholder: 'For example: headphones for commuting, with noise cancellation and a comfortable fit, within ¥500.',
  purchaseNeedsHint: 'Describe exactly what you want to buy. You can include your use case, budget, and preferences.',
  purchaseNeedsRequired: 'Please describe exactly what you want to buy',
  guardianExposureNote: 'Browser-reported visible simulation; no evidence of an effect on your choice',
  guardianReturnToCompare: 'Return to comparison',
  officialProductSource: 'View official product information',
  sourceCheckedAt: 'Source checked',
  catalogDisclosure: 'Real product information · Prices, stock, ratings, popularity, promotional allocations and deadlines are research simulations; images are label illustrations.',
  productSourceNote: 'Names, specifications and descriptions follow official sources; promotional copy is paraphrased. Check the brand source for the actual market version and packaging.',
  deleteChat: 'Delete conversation',
  deleteChatConfirm: 'Delete the entire conversation about “{product}” with {ai}? This cannot be undone.',
  chatDeleted: 'Conversation deleted',
  guardianReviewing: 'The guardian is reviewing your cart…',
  guardianInterventionTitle: 'Check once more with your purchase guardian',
  guardianInterventionIntro: 'This review connects exact cues to research-based mechanisms. Simulated promotions are not retailer evidence; the purchase decision remains yours.',
  guardianNeedsReview: 'The guardian gave no item-specific advice. Check your needs, budget, and what you already own.',
  guardianRemove: 'Remove from cart',
  guardianKeep: 'You may keep it — verify it yourself',
  guardianClearCart: 'Remove from cart',
  guardianContinue: 'Still confirm simulated purchase',
  guardianFoundPrompts: 'Prompts found',
  guardianSellerChatFound: 'You have chatted with Seller AI about this item.',
  guardianNoSellerChat: 'No Seller AI conversation was found for this item.',
  guardianNoPatterns: 'No prompts in these categories were found.',
  guardianSellerPrompt: 'Seller AI',
  guardianProductPrompt: 'Recorded page simulation',
  guardianSeeQuote: 'View original wording',
  guardianSeeBasis: 'View page evidence',
  guardianPattern_scarcity: 'Scarcity prompt',
  guardianPattern_social_proof: 'Social proof prompt',
  guardianPattern_price_anchor: 'Price anchor prompt',
  guardianPatternAdvice_scarcity: 'You can check the stock count, but it does not mean you need to buy now.',
  guardianPatternAdvice_social_proof: 'Other people’s interest or purchases do not show whether this item suits you.',
  guardianPatternAdvice_price_anchor: 'Judge the current price against your needs, not just the comparison price.',
});

const englishText = {
  '数码电子': 'Digital & Electronics',
  '服饰鞋包': 'Fashion & Bags',
  '家居生活': 'Home & Living',
  '美妆护肤': 'Beauty & Skincare',
  '食品饮料': 'Food & Drinks',
};

const chineseText = Object.fromEntries(Object.entries(englishText).map(([zh, en]) => [en, zh]));

export function translateCatalogText(value, locale) {
  if (typeof value !== 'string') return value;
  return (locale === 'en' ? englishText : chineseText)[value] || value;
}

export function localizeCatalogItem(item, locale) {
  if (!item) return item;
  return {
    ...item,
    name: translateCatalogText(item.name, locale),
    subtitle: translateCatalogText(item.subtitle, locale),
    description: translateCatalogText(item.description, locale),
    category_name: translateCatalogText(item.category_name, locale),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => translateCatalogText(tag, locale)) : item.tags,
    specs: item.specs && typeof item.specs === 'object'
      ? Object.fromEntries(Object.entries(item.specs).map(([key, value]) => [translateCatalogText(key, locale), translateCatalogText(value, locale)]))
      : item.specs,
    image_url: localizeImageUrl(item.image_url, locale),
  };
}

export function localizeImageUrl(imageUrl, locale) {
  if (typeof imageUrl !== 'string' || !imageUrl) return imageUrl;
  const withoutLocale = imageUrl.replace(/([?&])locale=[^&]*/u, '');
  return `${withoutLocale}${withoutLocale.includes('?') ? '&' : '?'}locale=${locale}`;
}

const englishApiErrors = {
  '接口不存在': 'API endpoint not found',
  '请求内容不是有效的 JSON': 'Request body is not valid JSON',
  '请先登录': 'Please sign in first',
  '登录已过期': 'Your session has expired',
  '用户名长度应为 2–40 位': 'Username must be 2–40 characters long',
  '请输入有效邮箱': 'Please enter a valid email address',
  '密码长度应为 8–128 位': 'Password must be 8–128 characters long',
  '用户名或邮箱已存在': 'Username or email already exists',
  '请输入用户名和密码': 'Please enter your username and password',
  '用户名或密码错误': 'Incorrect username or password',
  '商品不存在': 'Product not found',
  '购物车商品不存在': 'Cart item not found',
  '商品库存不足': 'Insufficient product stock',
  '购物车为空': 'Your cart is empty',
  '商品数量必须是 1–99 的整数': 'Quantity must be an integer from 1 to 99',
  '请填写购买信息': 'Please enter purchase details',
  '姓名不能为空': 'Name is required',
  '请填写购买需求，具体说明自己想买什么': 'Please describe exactly what you want to buy',
  '购买信息长度超出限制': 'Purchase details exceed the length limit',
  '需求长度应为 1–800 字': 'Your requirements must be 1–800 characters long',
  '问题长度应为 1–800 字': 'Your question must be 1–800 characters long',
  '请填写需求': 'Please enter your requirements',
  '请输入问题': 'Please enter a question',
  'AI 角色无效': 'Invalid AI role',
  '缺少有效的商品或 AI 角色': 'A valid product and AI role are required',
  'AI 未返回可用的商品匹配结果': 'AI did not return any usable product matches',
  'AI 对话摘要未返回有效内容': 'AI did not return a valid conversation summary',
  '请求已取消': 'Request cancelled',
};

const englishAiErrors = {
  AI_NOT_CONFIGURED: 'AI service has no API key configured',
  AI_CONNECTION_FAILED: 'Could not connect to the AI service. Check the connection or provider status',
  AI_OUTPUT_TRUNCATED: 'The AI provider returned a truncated reply. It was not used as a complete result. Please retry',
  AI_CHECKOUT_INVALID_RESPONSE: 'AI did not return a complete purchase review. Please retry',
  AI_EMPTY_RESPONSE: 'AI service did not return valid content',
  INTERNAL_ERROR: 'Internal server error. Contact an administrator with the request ID',
};

const englishUpstreamReasons = {
  400: 'invalid request format',
  401: 'invalid API key',
  402: 'insufficient AI account balance',
  422: 'invalid model or parameters',
  429: 'rate limit reached',
  500: 'internal error',
  503: 'service busy',
};

export function localizeApiError(data, status, locale) {
  if (locale !== 'en') return data.error || `请求失败（${status}）`;
  const code = typeof data.code === 'string' ? data.code : '';
  if (code.startsWith('AI_UPSTREAM_')) {
    const upstreamStatus = Number(data.upstreamStatus || code.slice('AI_UPSTREAM_'.length));
    const reason = englishUpstreamReasons[upstreamStatus] || 'request failed';
    return `AI provider returned ${upstreamStatus}: ${reason}`;
  }
  if (englishAiErrors[code]) return englishAiErrors[code];
  const error = typeof data.error === 'string' ? data.error : '';
  if (englishApiErrors[error]) return englishApiErrors[error];
  const stockMatch = error.match(/^(.+) 库存不足，请返回购物车调整$/u);
  if (stockMatch) return `${translateCatalogText(stockMatch[1], locale)} is out of stock. Please adjust your cart`;
  return `Request failed (${status})`;
}
