# 数据库结构说明

`schema.sql` 是后续上服务器时使用的 PostgreSQL 表结构草案。

当前版本已经支持 `DATABASE_URL`。配置 PostgreSQL 后，上传文件元数据、任务记录、审计日志、客户开通草稿和模型调用事件会写入运行时表；未配置时继续写入 `.local-data/`。
服务器版建议：

- PostgreSQL：存储租户、用户、权限、知识库元数据、视频元数据、任务、发布结果、会话和审计日志。
- 套餐授权：`plans`、`plan_features`、`subscriptions`、`tenant_feature_flags` 控制客户到期、席位、额度和功能开关。
- 对象存储：存放原始文件、视频切片、字幕、封面图和导出文件。
- Redis / BullMQ / 云队列：执行知识库解析、视频转码、字幕生成、合规审核、平台发布等异步任务。

当前代码会自动创建 `app_uploads`、`app_queue_jobs`、`app_audit_logs`、`app_tenant_drafts`、`app_model_usage_events`、`app_connector_connections`、`app_billing_records`、`app_schema_migrations` 这些运行时表。正式生产建议使用迁移命令初始化数据库，并把后续结构变更继续纳入迁移记录。

## 当前可用命令

```powershell
npm run db:migrate
npm run db:seed
npm run worker
```

- `npm run db:migrate`：读取 `db/schema.sql`，在配置 `DATABASE_URL` 的 PostgreSQL 中建表，并把 schema checksum 写入 `app_schema_migrations`。
- `npm run db:seed`：初始化套餐、套餐功能和演示租户，方便服务器首次部署后马上进入后台验证。
- `npm run worker`：需要 `REDIS_URL`，启动 BullMQ 常驻消费者，处理上传后进入队列的任务。

未配置 `DATABASE_URL` 时，系统继续写入 `.local-data/`；未配置 `REDIS_URL` 时，任务仍可通过 `/api/jobs/run` 做本地演示推进。
