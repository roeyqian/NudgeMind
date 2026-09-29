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
当前默认模型为 `deepseek-flash`。如果线上 Worker 的 `DEEPSEEK_MODEL` 是旧模型名，部署时也应更新该变量。

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npm run dev
```

## AI 请求失败排查

聊天报错会显示 HTTP 状态、应用错误码和请求 ID；DeepSeek 返回错误时，还会显示其状态和错误详情。`AI_UPSTREAM_401` 表示上游 API Key 无效，`AI_UPSTREAM_402` 表示余额不足，`AI_UPSTREAM_422` 通常要检查模型名或请求参数，`AI_UPSTREAM_429` 表示限流，`AI_UPSTREAM_500` / `AI_UPSTREAM_503` 表示上游暂时故障或过载。AI 问题和回复不再受字符数限制；模型达到输出 token 上限时，Worker 会继续处理已返回的非空内容，原有 `max_tokens` 设置保持不变。`INTERNAL_ERROR` 表示 Worker 内部或数据库错误，应使用请求 ID 在 Worker 日志中定位。连接失败及 429/5xx 上游错误会在单次聊天请求内最多重试两次；配置和额度错误不会重试。

## AI 上下文摘要

当同一用户、商品和 AI 角色的聊天上下文超过 `AI_CONTEXT_SUMMARY_THRESHOLD`（默认 `10000` 个字符）时，Worker 会让模型将较早对话总结并持久化。之后的聊天请求会使用该摘要和最近的 `AI_CONTEXT_RECENT_CHARS`（默认 `4000` 个字符）作为上文。可在 `worker/wrangler.jsonc` 的 `vars` 中覆盖这两个值。

## 数据边界

购买为研究用模拟购买，不接入真实支付。订单会保存为 `completed`，并扣减样本库存。项目不会连接或访问 Shop Assistant 的 Worker URL。

---

# Nudge Mind (English)

Nudge Mind is a lightweight e-commerce prototype for research on purchase decisions, rebuilt from Shop Assistant. The first version includes only what is needed for the basic research flow:

- User registration, login, and logout
- Product, cart, order, and AI conversation data in D1
- Product categories, search, details, and specifications
- Add to cart, change quantities, and simulate purchases
- “Ask Seller AI” and “Ask Butler AI” on product detail pages
- Basic prompts for both roles, without automated interventions, a research dashboard, or complex evaluation workflows

## Technology Stack

- Vue 3 + Vite
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV
- DeepSeek-compatible Chat Completions API

## Local Setup

```powershell
cd view
npm install
npm run build

cd ..\worker
npm install
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

Enter the IDs of a new D1 database and KV namespace in `worker/wrangler.jsonc`. Do not use Shop Assistant's production resources.

Initialize the local database:

```powershell
npm run db:migrate:local
npm run db:seed:local
```

For AI features, set `DEEPSEEK_API_KEY` as a Worker Secret. You can also configure `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, and `AI_TEMPERATURE` as variables. The default model is currently `deepseek-flash`. If the deployed Worker's `DEEPSEEK_MODEL` uses an old model name, update that variable when deploying.

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npm run dev
```

## AI Request Errors

Chat errors display the HTTP status, application error code, and request ID. When DeepSeek returns an error, its status and error details are also displayed. `AI_UPSTREAM_401` means the upstream API key is invalid; `AI_UPSTREAM_402` means the account has insufficient balance; `AI_UPSTREAM_422` usually calls for checking the model name or request parameters; and `AI_UPSTREAM_429` means rate limiting. `AI_UPSTREAM_500` and `AI_UPSTREAM_503` indicate a temporary upstream failure or overload. AI questions and replies no longer have a character limit. If the model reaches its output token limit, the Worker continues processing any nonempty content already returned; the existing `max_tokens` setting remains unchanged. `INTERNAL_ERROR` indicates a Worker or database error; use the request ID to locate it in the Worker logs. Connection failures and upstream 429/5xx errors are retried up to twice within a single chat request. Configuration and balance errors are not retried.

## AI Context Summaries

When the chat context for the same user, product, and AI role exceeds `AI_CONTEXT_SUMMARY_THRESHOLD` (default: `10000` characters), the Worker asks the model to summarize earlier messages and stores the summary. Subsequent chat requests use that summary and the most recent `AI_CONTEXT_RECENT_CHARS` (default: `4000` characters) as context. Both values can be overridden in the `vars` section of `worker/wrangler.jsonc`.

## Data Boundaries

Purchases are simulated for research purposes; no real payment processing is involved. Orders are saved as `completed`, and sample inventory is reduced. This project does not connect to or access the Shop Assistant Worker URL.
