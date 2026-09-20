# Nudge Mind

Nudge Mind 是一个用于消费决策研究的轻量电商原型，由 Shop Assistant 重构而来。第一版只保留完成基础研究流程所需的能力：

- 用户注册、登录与退出
- D1 商品、购物车、订单及 AI 对话数据
- 商品分类、搜索、详情和参数展示
- 加入购物车、修改数量与模拟购买
- 商品详情页中的“问 卖家 AI”和“问 管家 AI”
- 两个角色的基础提示词，不包含自动干预、研究后台或复杂评测流程

## 技术栈

- Vue 3 + Vite
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV
- DeepSeek 兼容 Chat Completions API

## 本地准备

```powershell
cd view
npm install
npm run build

cd ..\worker
npm install
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

在 `worker/wrangler.jsonc` 中填写全新的 D1 数据库与 KV 命名空间 ID。不要使用 Shop Assistant 的线上资源。

初始化本地数据库：

```powershell
npm run db:migrate:local
npm run db:seed:local
```

如需 AI，在 Worker Secret 中设置 `DEEPSEEK_API_KEY`；也可通过变量设置 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 和 `AI_TEMPERATURE`。

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npm run dev
```

## AI 上下文摘要

当同一用户、商品和 AI 角色的聊天上下文超过 `AI_CONTEXT_SUMMARY_THRESHOLD`（默认 `10000` 个字符）时，Worker 会让模型将较早对话总结并持久化。之后的聊天请求会使用该摘要和最近的 `AI_CONTEXT_RECENT_CHARS`（默认 `4000` 个字符）作为上文。可在 `worker/wrangler.jsonc` 的 `vars` 中覆盖这两个值。

## 数据边界

购买为研究用模拟购买，不接入真实支付。订单会保存为 `completed`，并扣减样本库存。项目不会连接或访问 Shop Assistant 的 Worker URL。
