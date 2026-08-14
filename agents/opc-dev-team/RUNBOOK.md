# 私域 SaaS Codex 持续开发 OPC 团队运行手册

## 入口

在项目 linked worktree 中运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode validate
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode status
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode team
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode intake
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode metrics
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode readiness
powershell -NoProfile -ExecutionPolicy Bypass -File automations/opc/Invoke-PrivateDomainDevOpc.ps1 -Mode next
```

固定回归：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-PrivateDomainDevOpc.ps1
```

## 每轮顺序

1. 核对路径、分支、HEAD、Git 状态与 linked worktree。
2. 完整读取项目事实源和本团队记忆。
3. 运行 OPC `validate`；失败立即停止。
4. 运行 `intake`、`readiness` 和 `metrics`，确认请求无重复、环境就绪、硬边界违规为 0。
5. 运行 OPC `next`；它只委托原控制器选择最多一个业务任务。
6. 没有选择时停止，不创建任务、不降低风险、不借用其他任务范围。
7. 有选择时，只在任务 allowed_paths 内实现最小改动。
8. 运行变更路径门、固定 verification profile、团队回归和必要的 `git diff --check`。
9. 按证据契约记录候选、未覆盖项、风险、外部动作和回滚。
10. 安全合规复核通过后，只形成候选提交/既有草稿 PR 更新；不合并、不部署。

## 停止条件

- Git 不干净、不是 linked worktree、分支不是 `codex/`、HEAD 或事实源不确定。
- 原控制器 `validate` 失败或 `next` 返回零个任务。
- 请求与 selected task、allowed_paths、固定验证或风险等级不一致。
- 需要客户、账号、密钥、真实渠道、CRM、支付、生产数据、部署或进程控制。
- 测试失败、证据不足、远端竞争或回滚不明确。
- intake 重复/无风险分级、证据字段缺失、metrics 硬边界违规非零或本 worktree 依赖环境不就绪。
