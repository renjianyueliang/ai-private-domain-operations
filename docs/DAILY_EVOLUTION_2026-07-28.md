# 每日自动进化：会话决策的服务端可信契约

日期：2026-07-28
项目：规划全自动 AI 私域员工
本轮类型：产品规格、接口契约与验收清单（不接真实渠道、不发送消息）

## 今日只推进的一个演进点

把“确认发送 / 转人工 / 加入跟进”从前端按钮加动作日志，收敛成一个可解释、可幂等、可并发保护的服务端会话决策契约。

本轮不修改正在开发的会话、收件箱、数据库或 API 代码；只冻结下一次小范围实现的输入、状态变化、审计证据和用户反馈，避免界面显示“已处理”而真实会话状态没有同步变化。

## 当前证据与问题边界

当前实现已经具备良好起点：

- `UnifiedInbox` 明确展示风险等级、AI 建议、动作日志和高风险提示。
- `conversation-actions` API 可以把人工动作写入本地存储或 PostgreSQL。
- CRM 列表会根据最新动作展示“已确认回复 / 已转人工 / 已加入跟进”。
- 所有动作仍是本地演示，不调用真实消息渠道。

但当前还不能把“已记录动作”等同于“会话已安全流转”：

1. 高风险“禁止确认发送”主要由客户端判断；服务端动作入口尚未根据会话风险和当前状态再次校验。
2. 动作事件只记录 `action`、`note` 和操作者，没有 `fromStatus`、`toStatus`、接管人、SLA、命中规则或来源战役。
3. CRM 阶段是页面根据动作日志临时推导，基础会话状态并未原子更新。
4. 现有去重条件是“同一会话 + 同一动作”，会让以后合法的第二次跟进也被当成重复；同时缺少数据库唯一键，无法抵御并发双写。
5. API 对未知动作缺少显式拒绝契约，不能依靠客户端下拉值保证服务端安全。

## 用户要获得的可信结果

主要用户是处理私信的运营员工，协作用户是合规员工与销售/顾问。

一次动作完成后，用户必须能立即确认：

- 系统实际接受了哪个动作，而不只是按钮被点击。
- 会话从什么状态变成什么状态。
- 高风险规则是否强制人工接管。
- 当前负责人和最迟处理时间是谁、何时。
- 刷新、重复点击或多人同时处理时，结果是否仍然一致。

## 决策动作契约

### 请求

```ts
type ConversationDecisionRequest = {
  tenantId: string;
  conversationId: string;
  action: "confirm_send" | "transfer_human" | "add_followup";
  expectedVersion: number;
  idempotencyKey: string;
  finalReply?: string;
  assigneeRole?: "operator" | "compliance" | "sales";
  dueAt?: string;
  nextAction?: string;
};
```

约束：

- `idempotencyKey` 标识一次用户提交，不等同于动作类型；重复提交同一个 key 返回第一次结果。
- `expectedVersion` 用于发现两名员工同时处理同一会话的冲突。
- `confirm_send` 必须包含最终确认文案；当前版本只记为本地模拟确认，不调用渠道。
- `transfer_human` 必须包含接管角色、SLA 和下一步。
- `add_followup` 必须包含下一步；没有明确待办不能进入跟进状态。

### 服务端校验顺序

1. 校验登录用户、租户访问权和会话归属。
2. 严格校验动作枚举；未知动作返回 `400 invalid_action`，不得自动降级为其他动作。
3. 读取会话当前版本、风险、状态和命中规则。
4. 比较 `expectedVersion`；不一致返回 `409 conversation_changed` 和最新摘要。
5. 执行状态转换规则；高风险或 `human_required` 会话的 `confirm_send` 必须返回 `422 human_required`。
6. 在一次原子提交中更新会话投影并追加审计事件。
7. 使用 `(tenantId, idempotencyKey)` 唯一约束返回同一次提交的稳定结果。

### 最小状态转换

| 当前状态 | 动作 | 成功后状态 | 必填信息 | 服务端必须拒绝 |
| --- | --- | --- | --- | --- |
| `ready_to_send` | `confirm_send` | `follow_up` | 最终文案、下一步 | 高风险、空文案、版本冲突 |
| `ready_to_send` | `transfer_human` | `human_required` | 接管角色、SLA、下一步 | 空负责人或空 SLA |
| `human_required` | `transfer_human` | `follow_up` | 接管角色、SLA、下一步 | `confirm_send`、空负责人 |
| `ready_to_send` / `follow_up` | `add_followup` | `follow_up` | 下一步、SLA | 空下一步、版本冲突 |
| `closed` | 任意写动作 | `closed` | 无 | 所有写动作；只能查看历史 |

## 只追加审计事件

每次成功决策追加一条不可覆盖的事件：

```ts
type ConversationDecisionEvent = {
  id: string;
  tenantId: string;
  conversationId: string;
  campaignId?: string;
  sourceContentId?: string;
  action: ConversationDecisionRequest["action"];
  fromStatus: ConversationStatus;
  toStatus: ConversationStatus;
  risk: ConversationRisk;
  matchedRules: string[];
  finalReply?: string;
  assigneeRole?: string;
  dueAt?: string;
  nextAction: string;
  idempotencyKey: string;
  conversationVersion: number;
  createdBy: string;
  createdAt: string;
};
```

审计事件用于解释“谁基于什么风险和版本做了什么决定”；会话投影用于显示当前状态。两者必须同一事务成功或同一事务失败，不能只写其中一边。

## 界面反馈契约

- 提交前：展示渠道、本地模拟标识、最终文案、风险原因和动作后状态。
- 提交中：只禁用当前决策区并显示“正在记录决策”，避免重复点击。
- 成功：用可感知的状态消息展示“已记录 + 新状态 + 负责人/SLA”；刷新后内容一致。
- 高风险拒绝：明确写出“命中高风险规则，必须转人工”，不能只禁用按钮或只用红色。
- 并发冲突：保留用户输入，展示最新状态，并提供“查看最新会话”，不得静默覆盖。
- 保存失败：保留最终文案、负责人和下一步，允许使用同一 `idempotencyKey` 重试。

## 可重复验收清单

1. 中风险 `ready_to_send` + 合法确认：返回 `200/201`，状态变为 `follow_up`，只新增一条事件，不调用真实渠道。
2. 高风险会话直接调用 API 确认：返回 `422 human_required`，会话和事件数均不变化。
3. 同一个 `idempotencyKey` 连续提交两次：两次返回相同事件 ID，只产生一条事件。
4. 使用新的 key 再次加入跟进：允许形成新的合法事件，不被“相同动作永久去重”。
5. 两个请求使用相同旧版本并发提交：一个成功，另一个返回 `409 conversation_changed`。
6. 未知动作、空负责人、空 SLA 或空下一步：服务端拒绝，客户端保留输入。
7. 操作成功后刷新页面：会话状态、CRM 下一步、负责人、SLA 和审计时间线一致。
8. `closed` 会话提交写动作：服务端拒绝，历史事件保持只读。

## 下一次实现的最小切片

后续如代码边界允许，只实现一个纯函数 `decideConversation(current, request)` 及上述 8 组无副作用测试；暂不接数据库事务、页面按钮或真实连接器。纯函数输出应为“新会话投影 + 待追加事件”或结构化拒绝原因。

## 本轮边界

- 不修改现有未提交代码、数据库结构或自动化配置。
- 不部署、不发布、不推送、不创建 PR。
- 不登录账号，不接入渠道，不发送消息，不调用真实 CRM。
- 不新增依赖，不启动长期服务。
- 本文中的“确认发送”只代表本地模拟决策记录，不代表实际送达。

## 明日候选下一步

在确认相关代码没有与用户改动冲突后，只新增纯函数状态转换与无副作用测试；若缺少测试框架，则先用项目现有 TypeScript 运行方式写一个可直接执行的零依赖校验脚本，不安装依赖。
