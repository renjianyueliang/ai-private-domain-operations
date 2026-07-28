# AI 私域 SaaS 指挥官 MVP

这是本地演示版 SaaS 系统：客户进入自己的工作台，上传行业知识库后，由 AI 指挥官调度多个 AI 员工，完成内容生成、视频适配、发布计划、评论/私信承接、私域销售辅助、合规审核和数据复盘。

## 本地启动

```powershell
npm install
npm run dev
```

默认访问：

```text
http://127.0.0.1:3000/login
http://127.0.0.1:3000/workspace/today
```

平台后台演示入口：

```text
http://127.0.0.1:3000/admin/overview
```

根路径 `http://127.0.0.1:3000` 会自动跳转到客户工作台。

## 本轮产品进化

当前界面已经从“功能陈列型演示”调整为“可执行的 SaaS 运营台”：

- 管理端与客户工作台使用独立导航、顶部状态栏和清晰的信息架构。
- 客户首屏改为今日优先事项，直接显示待审核内容、高意向客户、渠道配置和上线准备度。
- 以“内容 → 免费工具 → Telegram → AI 诊断 → 人工成交 → 自动交付”作为第一条可验证营收闭环。
- 增加独立人工审核中心，金融收益、报价、付款、退款和对外发布默认保留人工批准。
- 增加渠道连接器状态，明确官方 API、待授权、待认证和半自动发布边界。
- 平台后台增加客户健康度、续费风险、额度预警、连接异常和客户开通向导。
- 客户开通向导支持行业、套餐、到期日和席位配置演示。
- 客户端已拆成独立业务页面：今日待办、获客计划、AI 获客舱、公域雷达、账号矩阵、视频创作、私信聚合、线索 CRM、自动回复、销售 SOP 等。
- 后台已拆成独立管理页面：经营总览、客户管理、套餐订阅、用量账单、行业模板、功能授权、模型路由、连接器生产依赖、审计风控、上线检查。
- 主导航已从单页滚动改为真实路由，点击菜单只进入对应功能页，避免长页面上下滚动查找。
- 功能授权、审计复核、获客计划、自动回复策略已从纯前端状态升级为本地可保存记录。
- 知识库上传后，TXT/MD/CSV/JSON 可通过本地 worker 抽取预览、关键词和知识片段，并在获客计划、内容草稿、回复策略里展示引用来源。
- 新增内容草稿生成接口：基于客户产品、目标客户、资料钩子和知识库片段生成待审核内容草稿。
- 新增客户侧闭环：内容审核中心可审核/驳回草稿，并一键生成视频任务。
- 新增视频任务流转：审核通过的内容草稿可生成脚本、平台版本、字幕校对和合规清单。
- 新增发布包中心：从视频任务生成 YouTube/TikTok/抖音/小红书/快手/视频号/Telegram 等平台素材包或官方 API 待审核计划。
- 新增私信动作日志：确认发送、转人工、加入跟进会写入本地动作记录，便于后续接 CRM 和审计。
- 桌面端与移动端导航均完成响应式验证。

## 接入 OpenAI API

复制 `.env.example` 为 `.env.local`，并填写：

```text
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-5.6-sol
DATABASE_URL=你的 PostgreSQL 连接串
SAAS_SESSION_SECRET=至少 32 位随机字符串
```

如果没有配置 `OPENAI_API_KEY`，模型网关会继续尝试兼容模型接口；仍不可用时自动回退本地 mock 输出，不影响演示。
如果没有配置 `DATABASE_URL`，系统会继续使用 `.local-data` 本地存储。

生产化相关可选配置：

```text
REDIS_URL=redis://...
WORKER_QUEUE_NAME=ai-saas-jobs
OBJECT_STORAGE_ENDPOINT=https://...
OBJECT_STORAGE_BUCKET=...
TELEGRAM_BOT_TOKEN=...
WECOM_CORP_ID=...
WECHAT_KF_CORP_ID=...
GOOGLE_CLIENT_ID=...
TIKTOK_CLIENT_KEY=...
```

配置 Redis 后，上传任务会进入 BullMQ 常驻队列；未配置时继续保留本地 API 推进模式。配置对象存储参数后，后台会把存储状态标记为待接真实适配器，并继续本地镜像保存，避免误判为已经上传到云桶。

## 当前已实现

- 客户工作台 `/workspace/today`，兼容 `/workspace`
- 平台管理后台 `/admin/overview`，兼容 `/admin`
- 客户端真实路由：`/workspace/plan`、`/workspace/acquisition`、`/workspace/radar`、`/workspace/accounts`、`/workspace/foundation`、`/workspace/video`、`/workspace/channels`、`/workspace/inbox`、`/workspace/crm`、`/workspace/replies`、`/workspace/sop`、`/workspace/commander`、`/workspace/review`、`/workspace/analytics`、`/workspace/settings`
- 后台真实路由：`/admin/customers`、`/admin/plans`、`/admin/usage`、`/admin/templates`、`/admin/features`、`/admin/ai`、`/admin/connectors`、`/admin/audit`、`/admin/readiness`
- 根路径自动跳转到客户工作台
- 客户端与平台后台页面分离：客户只看自己的工作区，平台方在后台看全部客户
- 多行业模板：交易教学、金融、医美、中医
- SaaS 套餐模型：试用版、基础版、增长版、企业版
- 套餐价格示例：基础版 ¥10,000/年、增长版 ¥30,000/年、企业版 ¥80,000+/年
- 订阅状态：有效、试用中、已到期、已暂停
- 功能开关：知识库、内容工厂、视频工厂、发布中心、私域会话、企微、微信客服、Telegram、YouTube、TikTok、素材包、高级合规、团队成员、数据看板
- 服务端授权拦截：知识库上传会检查知识库功能和存储额度；视频上传会检查视频工厂、视频任务额度和存储额度
- 客户知识库演示：课程资料、合规规则、销售资料、医生/顾问资质、FAQ
- AI 内容工厂：选题、脚本、标题、封面文案、引流钩子、私信话术
- 视频剪辑与平台适配中心：短视频切片、尺寸比例、时长、字幕、平台版本、风控检查
- 多平台发布中心：YouTube、TikTok、抖音、快手、小红书、视频号、企业微信、Telegram 的接入状态演示
- 私域会话中心：评论/私信进入线索池，AI 生成回复建议，并按风险转人工
- AI 获客舱：把客户获客目标拆成内容、视频、发布、私信承接、CRM 跟进和合规审核任务
- 公域获客雷达：按行业关键词、地区和平台筛选潜在选题/流量机会
- 账号矩阵：展示不同平台账号授权、健康度、每日限制、最近动作和风险提醒
- 自动回复策略：本地模拟回复规则开关、命中条件和高风险转人工
- 销售 SOP：按线索阶段展示 AI 支持、人工作业边界和可复制话术
- 获客计划保存接口：`/api/workspace/acquisition-plans`
- 内容草稿生成接口：`/api/workspace/content-drafts`
- 内容审核与状态更新接口：`PATCH /api/workspace/content-drafts`
- 视频任务接口：`/api/workspace/video-jobs`
- 发布计划接口：`/api/workspace/publish-plans`
- 私信/线索动作日志接口：`/api/workspace/conversation-actions`
- 自动回复策略保存接口：`/api/workspace/reply-strategies`
- 真实知识库上传：本地保存文件，并创建知识库解析任务
- 真实视频上传：本地保存视频，并创建转码、字幕、合规审核任务
- 本地任务队列：展示排队中、需审核等任务状态
- 登录角色演示：平台管理员、客户管理员、运营员工、只读观察员
- 登录页面 `/login`：通过 httpOnly cookie 登录，`/admin` 和 `/workspace` 已由 `proxy.ts` 保护
- PostgreSQL 表结构草案：见 `db/schema.sql`
- PostgreSQL 迁移命令：`npm run db:migrate`
- PostgreSQL 初始化 seed：`npm run db:seed`
- BullMQ worker 启动命令：`npm run worker`
- PostgreSQL 表结构已增加套餐、套餐功能、订阅、租户功能开关
- 指挥官一句话任务输入
- 11 个 AI 员工配置
- 自动任务链流转
- 员工状态：等待中、执行中、已完成、需人工确认、已阻断
- 多行业合规风控
- 人工确认按钮
- 客户画像和执行详情面板
- 本地 mock 输出，不接真实微信、短信、电话、支付
- OpenAI API 服务端接入框架：有 Key 时调用真实模型，无 Key 或失败时自动回退 mock
- 统一模型网关：支持 OpenAI、OpenAI-compatible 备用端点和 mock 回退，并记录模型调用事件
- PostgreSQL 运行时适配层：配置 `DATABASE_URL` 后，上传、任务、审计、客户开通草稿和模型调用事件写入数据库
- 连接器状态中心：Telegram、企微、微信客服、YouTube、TikTok 按环境变量判断是否可进入真实授权；抖音、快手、小红书、视频号默认素材包/人工流
- 对象存储状态中心：预留 S3/R2/OSS 兼容配置，并保留本地镜像
- Redis/BullMQ 队列入口：上传任务可入队，常驻 worker 可消费任务
- 合同、发票、收款记录接口：平台管理员可创建账务记录，先记录业务单据，后续接支付网关
- 服务端会话基础：登录、退出、当前用户接口使用 httpOnly cookie，现有演示角色 header 仍兼容
- 后台客户开通草稿：平台管理员保存后会写入 PostgreSQL 或本地 `.local-data`
- 任务执行入口：上传后的知识库和视频任务可通过 worker API 推进状态
- SaaS 多租户演示层：workspace、行业、套餐、到期、用量、渠道状态、知识库状态、内容任务、视频任务、私域会话
- SaaS 总后台演示层：客户数、有效客户、到期客户、年化套餐额、租户列表、行业模板库、套餐授权中心、功能授权矩阵、审计与风控中心
- 后台功能授权保存接口：`/api/admin/features`
- 后台审计复核接口：`/api/admin/audit`
- 本地控制记录：无 PostgreSQL 时写入 `.local-data/control.json`；配置 `DATABASE_URL` 后写入 `app_tenant_feature_overrides`、`app_risk_events`、`app_acquisition_plans`、`app_reply_strategy_snapshots`
- 内容草稿记录：无 PostgreSQL 时写入 `.local-data/content-drafts.json`；配置 `DATABASE_URL` 后写入 `app_content_drafts`
- 客户执行流记录：无 PostgreSQL 时写入 `.local-data/client-workflow.json`；配置 `DATABASE_URL` 后写入 `app_video_workflow_jobs`、`app_publish_plan_records`、`app_conversation_action_events`

## SaaS 化说明

服务器准备前，当前版本先做成“本地 SaaS 雏形”。它已经具备客户工作区和平台后台的产品结构，但数据仍来自本地 mock。

当前已经有登录页面、服务端会话、本地授权模型、路由保护、PostgreSQL 迁移/seed、对象存储状态、BullMQ 队列入口、连接器状态和账务记录接口。服务器准备好后，仍需把演示用户替换为真实账号体系，把 token/secret 接入密钥管理，并完成官方平台授权、真实媒体处理和支付网关。

客户未来使用时，系统可以做成：

- 上传行业知识库，AI 基于客户资料生成内容、脚本、标题、封面文案、评论钩子和私信回复建议。
- 上传视频素材，生成剪辑任务、字幕任务、合规审核任务和多平台尺寸/时长/标题/标签适配。
- 对 YouTube、TikTok、Telegram、企业微信、微信客服等支持官方授权的平台，走官方 API/Webhook。
- 对抖音、快手、小红书、视频号等发布能力受限或需要平台审核的渠道，先生成素材包、发布清单和人工审核流。
- 评论、私信、企微、Telegram 等咨询统一进入会话中心，高意向客户标记并分配给人工。
- 金融、医美、中医、交易教学等高风险行业，默认保留人工确认和禁用表达检查。

服务器准备后，参考：

```text
docs/SAAS_SERVER_PLAN.md
```

## 当前边界

当前版本只做本地演示和流程验证。所有对外触达动作都停留在草稿、素材包、待授权和人工确认阶段，不会真实发布视频、发送私信、添加好友、拨打电话或收款。

平台自动化边界：

- 可以做：知识库入库、内容草稿、视频任务、字幕/标题建议、素材包、发布计划、评论/私信回复建议、私域会话分流、数据复盘。
- 需要客户授权后才能做：YouTube/TikTok 官方发布、Telegram Bot 回复、企业微信/微信客服承接、表单和 CRM 回调。
- 不做：个人微信外挂、模拟点击、绕过平台风控、批量骚扰私信、自动加好友、自动承诺成交、自动医疗/金融建议。

上传边界：

- 本地上传文件保存在 `.local-data/`。
- `.local-data/` 已加入 `.gitignore`，避免误提交客户资料。
- 当前 worker 可做 TXT/MD/CSV/JSON 文本类知识库抽取预览、关键词和知识片段，也可生成视频处理清单；PDF/Word 解析、向量检索、FFmpeg 转码、字幕识别仍未接入。
- 生产环境应改为对象存储 + PostgreSQL 元数据 + Redis/队列工作器。

最新实施状态见：

```text
docs/IMPLEMENTATION_STATUS_2026-07-26.md
```

高风险行业边界：

- 金融：不承诺收益，不推荐具体标的，不代客投资。
- 医美：不承诺效果，不夸大前后对比，不自动给医疗方案。
- 中医：不做远程诊断，不承诺包治根治，不替代正规就医。
- 所有行业：不使用个人号外挂，不模拟点击，不绕过平台风控。
