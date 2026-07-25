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

## 仍未完成

- 真实生产登录页面、注册、密码重置、企业 SSO 和完整 RBAC 后台。
- PostgreSQL 生产迁移工具和初始化 seed 脚本。
- 对象存储：原始视频、导出视频、字幕、封面图仍未接入 S3/R2/OSS。
- Redis/BullMQ 或云队列：当前 worker 是 API 触发式，不是常驻后台消费者。
- PDF/Word 解析、知识库切片、向量检索、引用来源展示。
- FFmpeg/云媒体转码、字幕识别、封面生成、平台版本导出。
- YouTube、TikTok、Telegram、企业微信、微信客服、公众号等官方连接器。
- 抖音、快手、小红书、视频号的自动发布能力需要以开放平台实际权限为准；没有官方授权前只能做素材包和人工发布流。
- 支付、发票、合同、套餐扣费、用量超限扣减和续费自动化。
- 安全加固：速率限制、CSRF 防护、密钥管理服务、备份、日志留存策略和安全扫描。

## 当前验证

- `npm run typecheck`：通过。
- `npm run build`：通过。

## 下一批建议

1. 做 PostgreSQL seed 和迁移命令，让服务器可以一键初始化。
2. 做登录页面和中间件保护 `/admin`、`/workspace`。
3. 接 Redis/BullMQ，把 `/api/jobs/run` 改成真正的后台队列消费者。
4. 接知识库解析和向量检索。
5. 接第一批官方连接器：Telegram Bot、企业微信、YouTube。
