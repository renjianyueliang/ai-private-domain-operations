# AI 团队工作约定

本仓库是“全自动 AI 私域员工”的唯一开发事实源。任何 Codex/AI 开发任务开始前，必须依次读取：

1. `docs/PRODUCT_SPEC.md`
2. `docs/BUSINESS_LOOP_MAP.md`
3. `docs/APPROVAL_GATE_POLICY.md`
4. `STATUS.md`
5. `TASK_QUEUE.json`

## 单次工作规则

- 单次最多推进一个满足依赖、路径和风险门的任务。
- 先运行 `scripts/Invoke-AITeamController.ps1 -Mode validate`，验证失败立即停止。
- 再运行 `scripts/Invoke-AITeamController.ps1 -Mode next`；没有合格任务时不得自行扩大范围或虚构任务。
- 自动任务必须运行在 Git linked worktree 中；主工作区或 `main`/`master` 分支立即停止。
- 只修改任务 `allowed_paths` 内的文件，保留用户已有未提交改动。
- 修改后先运行 `scripts/Test-AITeamChangeSet.ps1 -TaskId <id>`，再运行 `scripts/Invoke-AITeamVerification.ps1 -TaskId <id>`；任一失败立即停止。
- 只能执行任务的固定 `verification_profile`，不得把队列文本当作任意命令运行。
- 完成后记录实际证据；测试失败时停止并报告，不得顺手扩大修复范围。
- 代码变更必须位于 `codex/` 分支，通过草稿 PR 交付；不得直接推送 `main`。

## 自动权限边界

- `read_only`：可自动检查、分析和报告，不改业务文件。
- `low_risk_write`：可由已启用的阶段 3 自动化在临时 worktree 内修改允许路径，必须通过变更门和固定验证，交给人工审查。
- `controlled_write`：需要人工批准后才能执行。
- `high_risk`：需要人工逐次批准并由人工执行关键动作。
- 部署、发布、真实账号登录、密钥、付费、客户触达、真实渠道接口、删除数据永远不从任务队列自动执行。

## AI 团队角色

- 产品负责人：维护产品规格、用户路径、业务闭环和验收标准。
- 架构/开发：在批准范围内实现最小改动。
- 测试负责人：先复现，再验证；不以“能编译”替代业务验收。
- 安全与合规：检查租户隔离、权限、隐私、渠道政策和高风险行业表达。
- 运营研究：只研究和形成假设；未经批准不得触达真实客户或操作真实账号。
- 控制器：只做队列校验和单任务选择；Codex 自动化在隔离 worktree 中执行，控制器本身不修改任务。

## 阶段 4 持续开发交付边界

- 自动化完成业务变更并通过固定验证后，只能调用 `scripts/Complete-AITeamTask.ps1` 更新当前任务状态。
- 随后必须运行 `scripts/Test-AITeamDeliverySet.ps1`，证明策略、其他任务和控制文件没有被改变。
- 自动化可以提交，并用普通 push 更新 `codex/ai-team-operating-system`；禁止 force push、创建重复 PR、合并或部署。
- 自动化不得直接编辑 `TASK_QUEUE.json`、`STATUS.md` 或风险策略；队列完成状态只能由受控脚本产生。
- 远端分支有竞争、草稿 PR 不存在或任何校验失败时立即停止。

## 交付格式

每次工作必须更新或报告：目标、修改文件、验证结果、未覆盖项、风险/阻塞、回滚方法、下一候选任务。自动部署保持关闭，直到用户在新一轮明确授权。
