# Nudge Mind

## 研究依据与购买审阅

Guardian 购买审阅现按“原文证据 → 真实研究中的可能机制 → 不确定性 → 核验建议”分析。v3 为 90 件商品逐件配置无诱导、折扣、虚构名人推荐、热度、限量、搭配购买或全部叠加；只有少数商品使用二次选择弹窗，记录各位置实际曝光。商品研究数据直接维护在 `worker/store/product-research.mjs`，理论与刺激逻辑位于 `worker/src/modules/ai/research-patterns.mjs`。首次升级需应用 `0008_research_exposures.sql`；已经应用者无需再次迁移。

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

**强制规则：严禁项目设置输出 token 上限或主动截断 AI 输出。** 所有 AI 调用（卖家聊天、管家聊天、商品推荐、购买审阅、上下文摘要）均不发送 `max_tokens`、`max_completion_tokens`、`max_output_tokens` 等输出限额参数，不设置默认 token 预算、上限裁剪函数或调用方 token 限制。后续修改不得重新引入这些限制，也不得将被截断的回复作为完整结果展示、写入聊天记录或持久化为摘要。

上游模型的默认输出长度、上下文窗口及服务端硬限制不受本项目控制；省略限额参数不等于模型能够无限输出。所有 AI 调用统一检查 `finish_reason`，若上游返回 `length`，拒绝该不完整结果并返回 `AI_OUTPUT_TRUNCATED`，不能静默当作成功。

确认模拟购买会先调用管家购买审阅，成功后才进入最终确认。审阅按最多 3 件商品分批生成，不设置输出 token 限额。遇到输出截断或缺项、重复 ID、字段格式错误时，该批会自动重试一次。最终失败会显示 `AI_OUTPUT_TRUNCATED` 或 `AI_CHECKOUT_INVALID_RESPONSE`，保留购买信息和购物车，不自动下单，也不把失败分析当作成功结果。此前这些无错误码的审阅校验失败会被错误地显示为 `INTERNAL_ERROR`。部署后需由用户在网站验证购买审阅流程。

聊天报错会显示 HTTP 状态、应用错误码和请求 ID；DeepSeek 返回错误时，还会显示其状态和错误详情。`AI_UPSTREAM_401` 表示上游 API Key 无效，`AI_UPSTREAM_402` 表示余额不足，`AI_UPSTREAM_422` 通常要检查模型名或请求参数，`AI_UPSTREAM_429` 表示限流，`AI_UPSTREAM_500` / `AI_UPSTREAM_503` 表示上游暂时故障或过载。`AI_OUTPUT_TRUNCATED` 表示上游回复被截断，项目已拒绝将其作为完整结果使用。`INTERNAL_ERROR` 表示 Worker 内部或数据库错误，应使用请求 ID 在 Worker 日志中定位。连接失败及 429/5xx 上游错误会在单次聊天请求内最多重试两次；配置和额度错误不会重试。

## AI 上下文摘要

当同一用户、商品和 AI 角色的聊天上下文超过 `AI_CONTEXT_SUMMARY_THRESHOLD`（默认 `10000` 个字符）时，Worker 会让模型将较早对话总结并持久化。之后的聊天请求会使用该摘要和最近的 `AI_CONTEXT_RECENT_CHARS`（默认 `4000` 个字符）作为上文。可在 `worker/wrangler.jsonc` 的 `vars` 中覆盖这两个值。

## 真实商品目录

目录包含 90 件真实品牌商品，每类 18 件，沿用 `prod_001` 至 `prod_090`。
商品名称、型号、规格和中英文介绍根据品牌官方产品页或说明资料整理；副标题及宣传文案为改写摘要，并非品牌逐字口号。每件商品都保存官方链接与核对日期，详情页可直接查看来源。部分商品对应海外市场版本，支持功能、配方、包装及在售状态应以链接中的具体版本为准。

- `worker/store/catalog.mjs`：唯一商品内容来源，包含品牌、型号、中英文文案、规格、标签、官方链接及研究价格。
- `worker/store/research-fixtures.json`：模拟库存、销量、评分及热门/新品标记，保留原研究数据设置。
- `worker/store/seed.sql` 与 `worker/store/migrations/0007_real_product_catalog.sql`：已有的初始化与升级 SQL 快照。

修改商品目录时，同步维护新库使用的 `seed.sql`；已有数据库的商品更新通过新增迁移实施，不改写已应用的历史迁移。研究诱导配置直接修改 `product-research.mjs`，不需要数据库迁移。

新数据库先运行全部迁移，再运行 seed；已有数据库只需应用新增的 `0007` 迁移，无需清库。迁移更新商品内容与模拟价格，补齐全部英文翻译，保留已有库存、销量、评分、商品 ID、购物车关联、订单和对话。历史订单名称、价格与对话作为原研究记录保留；AI 提示词要求使用当前型号事实，避免沿用旧对话中的虚构参数。

```powershell
# 在实际使用的数据库上执行升级（二选一）
npm run db:migrate:local
npm run db:migrate:remote
```

`0004` 与 `0005` 补充了新库初始化依赖：前者只为已存在商品写入翻译，后者先补齐分类，确保开启外键时也能在 seed 前完成迁移。已应用的历史迁移不需要重新执行。

`0007` 在更新前将已有商品和英文翻译保存到 `catalog_0007_products_backup` 与 `catalog_0007_translations_backup`。需要回退时，配合升级前代码，执行 `worker/store/rollback/0007_real_product_catalog.sql`；它恢复被升级的旧商品内容与价格，保留当前库存及用户记录。备份表保留不删除；回退 SQL 不改变 D1 迁移登记，后续再次升级需显式执行升级 SQL。新库中原本没有的商品不会因回退被删除。

价格为人民币研究模拟定价，库存、销量、评分和热门/新品标记均为模拟数据，不代表品牌或零售商实时数据。商品事实表不保存没有可靠依据的折扣原价；研究配置为部分商品提供模拟划线价，该值不写入商品事实表或用于结算。商品图继续使用根据当前名称与标签生成的示意图；本次没有引入商品实拍照片。迁移应用及部署需要在目标环境执行，Worker URL 的访问验证由用户完成。

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

**Mandatory rule: application-imposed output token limits and deliberate truncation of AI output are prohibited.** All AI calls, including seller/guardian chats, recommendations, checkout reviews and context summaries, omit `max_tokens`, `max_completion_tokens`, `max_output_tokens` and equivalent output limits. Do not reintroduce token budgets or clamp functions. Truncated replies must never be displayed as complete results, stored as chat replies or persisted as summaries.

The application cannot remove the upstream model's default output limits, context window or server-side limits; omitting these parameters does not guarantee unlimited output. Every AI call checks `finish_reason` and rejects `length` responses with `AI_OUTPUT_TRUNCATED`. Checkout reviews process up to three products per batch without an output token budget and retry an incomplete or invalid batch once.

Chat errors display the HTTP status, application error code, and request ID. When DeepSeek returns an error, its status and error details are also displayed. `AI_UPSTREAM_401` means the upstream API key is invalid; `AI_UPSTREAM_402` means the account has insufficient balance; `AI_UPSTREAM_422` usually calls for checking the model name or request parameters; and `AI_UPSTREAM_429` means rate limiting. `AI_UPSTREAM_500` and `AI_UPSTREAM_503` indicate a temporary upstream failure or overload. `AI_OUTPUT_TRUNCATED` means the provider returned an incomplete reply which the application rejected. `INTERNAL_ERROR` indicates a Worker or database error; use the request ID to locate it in the Worker logs. Connection failures and upstream 429/5xx errors are retried up to twice within a single chat request. Configuration and balance errors are not retried.

## AI Context Summaries

When the chat context for the same user, product, and AI role exceeds `AI_CONTEXT_SUMMARY_THRESHOLD` (default: `10000` characters), the Worker asks the model to summarize earlier messages and stores the summary. Subsequent chat requests use that summary and the most recent `AI_CONTEXT_RECENT_CHARS` (default: `4000` characters) as context. Both values can be overridden in the `vars` section of `worker/wrangler.jsonc`.

## Data Boundaries

Purchases are simulated for research purposes; no real payment processing is involved. Orders are saved as `completed`, and sample inventory is reduced. This project does not connect to or access the Shop Assistant Worker URL.
