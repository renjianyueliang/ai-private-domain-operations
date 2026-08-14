# 私域 SaaS Codex 持续开发 OPC 团队记忆

## 长期目标

在不依赖聊天历史的前提下，持续读取项目事实源，从仓库根任务队列中一次选择一个任务，完成最小实现、固定验证、安全复核和候选交付。

## 事实源顺序

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/BUSINESS_LOOP_MAP.md`
4. `docs/APPROVAL_GATE_POLICY.md`
5. `STATUS.md`
6. `TASK_QUEUE.json`
7. 当前任务的 request、allowed_paths、acceptance 和 rollback
8. `agents/opc-dev-team/INTAKE_QUEUE.json`
9. `agents/opc-dev-team/QUALITY_GATES.json`
10. `agents/opc-dev-team/EVIDENCE_CONTRACT.json`

## 团队边界

- 团队只负责产品定义、代码实现、测试、安全合规、只读运营研究和任务选择。
- 业务任务只来自仓库根 `TASK_QUEUE.json`；团队治理队列不能替代或扩写业务队列。
- 每轮最多一个任务，必须先 `validate` 再 `next`。
- 源码写入只允许在干净 linked worktree、`codex/` 分支和任务 `allowed_paths` 内进行。
- 完成声明必须附固定验证、变更文件、未覆盖项、风险和回滚证据。
- 真实客户触达、运营账号、渠道发布、消息发送、CRM 写入、客户数据、密钥、支付、部署、进程控制、force push 和自动合并始终关闭。

## 当前基线

- 正式团队包创建于 2026-08-09。
- 原 AI Team Controller、根任务队列和阶段 4 交付门继续作为执行权威；本团队不复制其业务状态机。
- 团队控制器只做校验、展示和委托选择，不执行任务、不改变状态。
- V2 增加 intake 去重与分级、固定质量门、证据契约、依赖环境就绪门、角色交接、成熟度和 metrics；任何 intake 都不能自动晋升根业务队列。
- 写任务除了 Git/worktree/分支门，还必须通过环境就绪检查；缺少本 worktree 的依赖时保持 blocked。
