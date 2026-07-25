# 未完成事项推进记录

日期：2026-07-26

## 本轮已完成

- 新增 PostgreSQL 运行时适配层：配置 `DATABASE_URL` 后，上传记录、任务记录、审计日志、客户开通草稿和模型调用事件会写入数据库；未配置时继续使用 `.local-data`。
- 新增服务端会话基础：`/api/auth/login`、`/api/auth/logout`、`/api/auth/me` 使用 httpOnly cookie，现有演示 header 仍兼容。
- 后台“开通新客户”不再只是前端提示，已接 `/api/admin/tenants`，会保存客户开通草稿。
- 新增任务执行入口：`/api/jobs/run` 可以推进当前租户的排队任务。
- 知识库任务可处理 TXT/MD/CSV/JSON 的基础文本抽取预览；PDF/Word 仍进入待解析状态，等待服务器解析器。
- 视频任务会生成多平台规格清单和处理 manifest；真实剪辑、转码和字幕仍需要 FFmpeg 或云媒体服务。
- 合规任务保持 `needs_review`，金融、医美、中医、交易教学的高风险对外动作仍需人工确认。
- 新增统一模型网关：先尝试 OpenAI Responses API，再尝试 OpenAI-compatible 接口，失败后明确回退 mock，并记录模型调用事件。
- 更新数据库草案和 `.env.example`，让服务器部署所需配置更明确。
- 新增生产登录入口 `/login`，并用 `proxy.ts` 保护 `/admin` 与 `/workspace`。
- 新增 PostgreSQL 迁移脚本 `npm run db:migrate` 和初始化脚本 `npm run db:seed`。
- 新增 Redis/BullMQ 队列入口：配置 `REDIS_URL` 后上传任务可入队，`npm run worker` 可启动常驻消费者。
- 新增对象存储状态层：预留 S3/R2/OSS 兼容配置，未接 SDK 前继续本地镜像保存并显示真实边界。
- 新增官方连接器状态中心：Telegram、企微、微信客服、YouTube、TikTok 按凭证判断；抖音、快手、小红书、视频号默认素材包/人工流。
- 新增账务接口和后台表单：平台管理员可创建合同、发票、收款记录。
- 新增生产依赖面板：后台集中显示数据库、会话、对象存储、任务队列、连接器、账务和客户开通状态。

## 仍未完成

- 真实账号注册、密码重置、企业 SSO、CSRF、速率限制和完整 RBAC 后台。
- 对象存储真实 SDK：当前已建状态层和环境变量，未把文件真实上传到云桶。
- Redis/BullMQ 生产部署：当前已建队列入口和 worker 脚本，仍需服务器 Redis 常驻运行验证。
- PDF/Word 解析、知识库切片、向量检索、引用来源展示。
- FFmpeg/云媒体转码、字幕识别、封面生成、平台版本导出。
- YouTube、TikTok、Telegram、企业微信、微信客服、公众号等官方连接器的真实授权、回调验签和 token 加密存储。
- 抖音、快手、小红书、视频号的自动发布能力需要以开放平台实际权限为准；没有官方授权前只能做素材包和人工发布流。
- 支付网关、电子合同、电子发票、套餐扣费、用量超限扣减和续费自动化。
- 安全加固：速率限制、CSRF 防护、密钥管理服务、备份、日志留存策略和安全扫描。

## 当前验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
- 本地生产端到端自测：通过。覆盖未登录跳转、登录写 cookie、后台访问、当前用户接口、生产状态接口、连接器状态、账务创建和客户开通草稿创建。

## 下一批建议

1. 上服务器后配置 PostgreSQL、Redis、对象存储和生产环境变量，再执行 `npm run db:migrate`、`npm run db:seed`、`npm run worker`。
2. 把 demo 用户替换为真实账号体系，补注册、密码重置、企业 SSO、CSRF 和速率限制。
3. 接对象存储真实 SDK、知识库解析、切片、向量检索和引用来源展示。
4. 接 FFmpeg/云媒体服务，完成真实转码、字幕识别和平台版本导出。
5. 接第一批官方连接器：Telegram Bot、企业微信、微信客服、YouTube。
6. 接支付、合同、发票、续费、暂停和套餐升级。
