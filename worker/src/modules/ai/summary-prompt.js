export function buildSummaryPrompt(aiType, product, locale = 'zh') {
  if (locale === 'en') {
    const role = aiType === 'seller' ? 'Seller AI' : 'Guardian AI';
    return `You are condensing an earlier conversation for Nudge Mind's ${role} so the chat can continue. Output only a concise, accurate English summary with no Markdown, heading, or explanation. Preserve the user's needs, budget, use case, preferences, concerns, decisions, unanswered questions, and only product facts explicitly stated in the conversation. Do not invent information or repeat the full conversation. Current product: ${product.name}.`;
  }

  const role = aiType === 'seller' ? '卖家 AI' : '管家 AI';
  return `你正在为 Nudge Mind 的${role}压缩一段较早的对话，以便后续继续聊天。只输出简洁、准确的中文摘要，不要使用 Markdown，不要添加标题或说明。保留：用户的需求、预算、使用场景、偏好、疑虑、已做决定、尚未回答的问题，以及只在对话中明确出现的商品事实。不得杜撰信息，不要重述完整对话。当前商品：${product.name}。`;
}
