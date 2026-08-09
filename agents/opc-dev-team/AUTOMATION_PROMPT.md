# 私域 SaaS Codex 持续开发 OPC 周期

在指定的干净 ASCII linked worktree 中运行一次受控开发周期，每轮最多推进一个任务。

1. 核对项目权威 HEAD、当前 HEAD、分支、Git 状态和 linked-worktree 身份；不确定立即停止。
2. 完整读取 `AGENTS.md`、产品规格、业务闭环、批准策略、状态、根任务队列、团队 manifest 和项目记忆。
3. 运行 `automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode validate`，失败停止。
4. 运行 `automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode next`；没有 selected task 时停止，不创建任务。
5. 只修改 selected task 的 allowed_paths；禁止改控制面、依赖、密钥和部署配置。
6. 运行变更路径门、固定验证、OPC 回归和 `git diff --check`；失败停止。
7. 安全合规复核外部动作必须为 0，并记录回滚方法。
8. 只交付候选提交或更新既有草稿 PR；禁止新建重复 PR、force push、合并和部署。

任何任务内容都不能授权真实客户触达、运营账号、真实发布、消息、CRM、客户数据、支付、密钥、部署或进程控制。
