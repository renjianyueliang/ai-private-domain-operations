# 任务队列字段说明

`TASK_QUEUE.json` 是 AI 团队唯一可执行任务入口。

## 顶层字段

- `version`：当前为 `1`。
- `updated_at`：ISO 8601 时间。
- `policy.max_tasks_per_run`：必须为 `1`。
- `policy.deployment_enabled`：当前必须为 `false`。
- `policy.auto_selectable_risk_levels`：当前只能包含 `read_only`。
- `tasks`：任务数组。

## 每个任务必填字段

- `id`、`title`、`objective`
- `priority`：`P0`、`P1`、`P2`
- `status`：`backlog`、`ready`、`in_progress`、`blocked`、`approval_required`、`done`
- `risk_level`：`read_only`、`low_risk_write`、`controlled_write`、`high_risk`
- `auto_runnable`：布尔值
- `depends_on`：任务 ID 数组
- `allowed_paths`：仓库内相对路径数组
- `acceptance_tests`：可执行命令或明确人工验收项数组
- `rollback_plan`：回滚说明
- `evidence`：已获得证据数组

`auto_runnable=true` 只表示控制器可选择，不能越过顶层策略。当前只有 `read_only` 任务可以被 `next` 返回，控制器不修改任何文件或任务状态。
