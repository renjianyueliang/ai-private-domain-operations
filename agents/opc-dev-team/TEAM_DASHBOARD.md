# 私域 SaaS Codex 持续开发 OPC 团队

这是 `D:\全自动私域运营项目` 的正式、受控开发团队包。它包装现有 AI Team Controller，但不替代根任务队列和批准策略。

## 六个角色

| 角色 | 模式 | 职责 |
|---|---|---|
| 产品负责人 `product-lead` | 协调 | 冻结单轮产品范围、用户价值和验收标准 |
| 架构开发 `architecture-developer` | 受控写入 | 在 selected task 与 allowed_paths 内完成最小实现 |
| 测试 `qa-test-agent` | 只读 | 运行固定验证，拒绝用编译代替业务验收 |
| 安全合规 `security-compliance-agent` | 风险门 | 审查租户、隐私、高风险内容和外部动作 |
| 运营研究 `operations-researcher` | 只读 | 从本地证据形成假设，不接触真实客户 |
| 任务控制器 `task-controller` | 只读 | 委托原控制器 validate/next，最多选择一个任务 |

## 能做什么

- 读取项目事实源和已有历史。
- 校验原任务队列和团队包。
- 单次选择最多一个 `read_only` 或 `low_risk_write` 任务。
- 在隔离 worktree 内开发、测试、安全复核并留下候选提交。
- 通过既有阶段 4 门禁更新既有草稿 PR；人工审查后再决定后续动作。

## 永久关闭

- 真实客户触达与客户数据访问。
- 运营账号登录、真实发布、私信发送和真实 CRM 写入。
- 密钥、支付、生产部署和进程控制。
- 新建重复 PR、force push、自动合并和自动部署。

## 当前入口

- 团队定义：`agents/opc-dev-team/TEAM_MANIFEST.json`
- 团队记忆：`agents/opc-dev-team/PROJECT_MEMORY.md`
- 运行手册：`agents/opc-dev-team/RUNBOOK.md`
- 团队控制器：`automations/opc/Invoke-PrivateDomainDevOpc.ps1`
- 固定回归：`scripts/Test-PrivateDomainDevOpc.ps1`
- 正式 intake：`agents/opc-dev-team/INTAKE_QUEUE.json`
- 质量门：`agents/opc-dev-team/QUALITY_GATES.json`
- 证据契约：`agents/opc-dev-team/EVIDENCE_CONTRACT.json`
- 成熟度：`agents/opc-dev-team/MATURITY_SCORECARD.json`
- 交接契约：`agents/opc-dev-team/HANDOFF_CONTRACT.md`

## V2 运行能力

- `intake`：校验请求字段、状态、风险、去重键和外部动作，不自动晋升根队列。
- `readiness`：核对 Git、linked worktree、分支、Node/npm 和本 worktree 依赖。
- `metrics`：输出业务队列、治理队列、intake、成熟度、环境和硬边界指标。
- `next`：只有 Git 与依赖环境都就绪时，才允许低风险写任务进入 selected。
