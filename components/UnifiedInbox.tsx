"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  Send,
  ShieldAlert,
  Tag,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  getConversationSummary,
  getConversationsForTenant,
  type ConversationRisk,
  type ConversationStatus,
} from "../lib/conversations";
import { getTenantById } from "../lib/saas";
import { ClientLoopProgress } from "./ClientLoopProgress";

type UnifiedInboxProps = {
  tenantId: string;
  view?: "inbox" | "lead-crm" | "all";
};

type ConversationActionKind = "confirm_send" | "transfer_human" | "add_followup";

type ConversationActionEventView = {
  id: string;
  tenantId: string;
  conversationId: string;
  action: ConversationActionKind;
  note: string;
  status: "logged";
  createdBy: string;
  createdAt: string;
};

const statusLabels: Record<ConversationStatus, string> = {
  ai_drafting: "AI 起草中",
  human_required: "必须人工",
  ready_to_send: "可确认发送",
  follow_up: "待跟进",
  closed: "已结束",
};

const riskLabels: Record<ConversationRisk, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const actionLabels: Record<ConversationActionKind, string> = {
  confirm_send: "确认发送",
  transfer_human: "转人工",
  add_followup: "加入跟进",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function UnifiedInbox({ tenantId, view = "all" }: UnifiedInboxProps) {
  const tenant = getTenantById(tenantId);
  const conversations = useMemo(() => getConversationsForTenant(tenant.id), [tenant.id]);
  const summary = useMemo(() => getConversationSummary(tenant.id), [tenant.id]);
  const [selectedId, setSelectedId] = useState(conversations[0]?.id);
  const [actions, setActions] = useState<ConversationActionEventView[]>([]);
  const [actionMessage, setActionMessage] = useState("动作日志会记录人工确认、转人工和跟进安排。");
  const [isSavingAction, setIsSavingAction] = useState(false);
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0];
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  const latestActionByConversation = useMemo(() => {
    const map = new Map<string, ConversationActionEventView>();
    actions.forEach((event) => {
      if (!map.has(event.conversationId)) map.set(event.conversationId, event);
    });
    return map;
  }, [actions]);

  const leadRows = conversations.map((conversation) => {
    const latestAction = latestActionByConversation.get(conversation.id);
    const handledStage =
      latestAction?.action === "transfer_human" || latestAction?.action === "add_followup"
        ? "成交跟进"
        : latestAction?.action === "confirm_send"
          ? "已加私域"
          : conversation.leadProfile.stage;
    const handledNextAction =
      latestAction?.action === "transfer_human"
        ? "已转人工，等待负责人继续跟进"
        : latestAction?.action === "add_followup"
          ? "已加入 CRM 跟进，按 SLA 处理"
          : latestAction?.action === "confirm_send"
            ? "已确认回复，等待客户回应"
            : conversation.nextAction;

    return {
      id: conversation.id,
      name: conversation.customerName,
      stage: handledStage,
      need: conversation.leadProfile.need,
      value: conversation.leadProfile.value,
      owner: conversation.owner,
      nextAction: handledNextAction,
      risk: conversation.risk,
      actionLabel: latestAction ? actionLabels[latestAction.action] : "未处理",
    };
  });

  async function loadActions() {
    try {
      const response = await fetch(`/api/workspace/conversation-actions?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "读取会话动作失败。");
      setActions(Array.isArray(data.conversationActions) ? data.conversationActions : []);
      setActionMessage(`已载入 ${Array.isArray(data.conversationActions) ? data.conversationActions.length : 0} 条动作日志。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "读取会话动作失败。");
    }
  }

  useEffect(() => {
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  async function recordAction(action: ConversationActionKind) {
    if (!selected || isSavingAction) return;
    if (action === "confirm_send" && selected.risk === "high") {
      setActionMessage("高风险会话不能直接确认发送，必须先转人工。");
      return;
    }

    setIsSavingAction(true);
    setActionMessage("正在记录动作...");
    try {
      const response = await fetch("/api/workspace/conversation-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          conversationId: selected.id,
          action,
          note:
            action === "confirm_send"
              ? `人工确认发送 AI 建议：${selected.aiSuggestion}`
              : action === "transfer_human"
                ? `会话已转人工处理：${selected.nextAction}`
                : `已加入 CRM 跟进：${selected.nextAction}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "记录会话动作失败。");
      await loadActions();
      setActionMessage(`已记录动作：${actionLabels[data.record.action as ConversationActionKind] ?? data.record.action}。`);
      window.dispatchEvent(new CustomEvent("client-loop:changed"));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "记录会话动作失败。");
    } finally {
      setIsSavingAction(false);
    }
  }

  const selectedActions = actions
    .filter((event) => event.conversationId === selected?.id)
    .slice(0, 4);

  return (
    <>
      {(view === "all" || view === "inbox") && (
      <section id="inbox" className="unified-inbox" aria-label="私信聚合中心">
        <div className="inbox-heading">
          <div>
            <div className="section-kicker">私信聚合中心 <span>新增原型</span></div>
            <h2>评论、私信、企微、Telegram 统一进一个工作台</h2>
            <p>
              客户授权后，系统把各平台咨询汇总成会话、线索、风险标签和下一步动作。
              高风险行业默认先给建议，不直接替客户发送。
            </p>
          </div>
          <a href={`/workspace/crm${tenantQuery}`} className="secondary-button">
            <UsersRound size={16} />
            查看线索 CRM
          </a>
        </div>

        <ClientLoopProgress tenantId={tenant.id} current="inbox" />

        <div className="inbox-metrics">
          <article>
            <span className="metric-icon green"><Inbox size={18} /></span>
            <div><small>聚合会话</small><strong>{summary.total}</strong><em>演示样例</em></div>
          </article>
          <article>
            <span className="metric-icon blue"><UsersRound size={18} /></span>
            <div><small>高意向/需人工</small><strong>{summary.highIntent}</strong><em>优先处理</em></div>
          </article>
          <article>
            <span className="metric-icon amber"><ShieldAlert size={18} /></span>
            <div><small>人工必审</small><strong>{summary.humanRequired}</strong><em>保护客户账号</em></div>
          </article>
          <article>
            <span className="metric-icon violet"><Send size={18} /></span>
            <div><small>可确认发送</small><strong>{summary.readyToSend}</strong><em>需点击确认</em></div>
          </article>
        </div>

        <div className="inbox-layout">
          <aside className="inbox-list-panel" aria-label="会话列表">
            <div className="panel-heading compact">
              <span>跨平台会话</span>
              <small>{tenant.name}</small>
            </div>
            <div className="unified-conversation-list">
              {conversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={conversation.id === selected.id ? "active" : ""}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span className={`conversation-avatar risk-${conversation.risk}`}>{conversation.avatar}</span>
                  <div>
                    <strong>{conversation.customerName}</strong>
                    <small>{conversation.platform} · {conversation.lastActive}</small>
                    <p>{conversation.question}</p>
                  </div>
                  <em className={`conversation-status ${conversation.status}`}>
                    {statusLabels[conversation.status]}
                  </em>
                </button>
              ))}
            </div>
          </aside>

          <article className="conversation-thread-panel" aria-label="会话详情">
            <div className="conversation-thread-heading">
              <div>
                <strong>{selected.customerName}</strong>
                <span>{selected.platform} · 来源：{selected.sourceContent}</span>
              </div>
              <em className={`risk-badge ${selected.risk}`}>
                {selected.risk === "high" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {riskLabels[selected.risk]}
              </em>
            </div>

            <div className="conversation-tag-row">
              {selected.tags.map((tag) => (
                <span key={tag}><Tag size={12} />{tag}</span>
              ))}
            </div>

            <div className="message-stream">
              {selected.messages.map((message) => (
                <div key={message.id} className={`message-bubble ${message.sender}`}>
                  <small>{message.sender === "customer" ? selected.customerName : message.sender === "ai" ? "AI 员工" : message.sender === "system" ? "系统风控" : "人工员工"} · {message.time}</small>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>

            <div className="ai-reply-draft">
              <div>
                <Bot size={18} />
                <strong>AI 回复建议</strong>
                <span>{selected.owner}</span>
              </div>
              <p>{selected.aiSuggestion}</p>
              {selected.risk === "high" && (
                <div className="risk-warning">
                  <ShieldAlert size={15} />
                  命中高风险：只能作为建议，不能自动发送。
                </div>
              )}
              <div className="reply-action-row">
                <button
                  type="button"
                  disabled={selected.risk === "high" || isSavingAction}
                  onClick={() => recordAction("confirm_send")}
                >
                  <Send size={15} />
                  确认发送
                </button>
                <button type="button" disabled={isSavingAction} onClick={() => recordAction("transfer_human")}>
                  <UserCheck size={15} />
                  转人工
                </button>
                <button type="button" disabled={isSavingAction} onClick={() => recordAction("add_followup")}>
                  <ArrowRight size={15} />
                  加入跟进
                </button>
              </div>
              <div className="conversation-action-message" role="status">{actionMessage}</div>
            </div>
          </article>

          <aside className="lead-profile-panel" aria-label="线索画像">
            <div className="panel-heading compact">
              <span>线索画像</span>
              <small>{selected.intent}</small>
            </div>
            <div className="lead-profile-summary">
              <span className={`conversation-avatar risk-${selected.risk}`}>{selected.avatar}</span>
              <div>
                <strong>{selected.customerName}</strong>
                <small>{selected.leadProfile.stage} · {selected.leadProfile.privateDomain}</small>
              </div>
            </div>
            <dl className="lead-profile-list">
              <div>
                <dt>核心需求</dt>
                <dd>{selected.leadProfile.need}</dd>
              </div>
              <div>
                <dt>潜在价值</dt>
                <dd>{selected.leadProfile.value}</dd>
              </div>
              <div>
                <dt>下一步</dt>
                <dd>{selected.nextAction}</dd>
              </div>
              <div>
                <dt>合规说明</dt>
                <dd>{selected.leadProfile.complianceNote}</dd>
              </div>
            </dl>
            <div className="inbox-boundary-note">
              <Clock3 size={15} />
              生产环境通过官方 Webhook / OAuth 接收消息；个人号外挂和绕过风控不纳入版本。
            </div>
            <div className="conversation-action-log">
              <strong>当前会话动作日志</strong>
              {selectedActions.length === 0 ? (
                <span>暂无动作记录。</span>
              ) : (
                selectedActions.map((event) => (
                  <div key={event.id}>
                    <em>{actionLabels[event.action]}</em>
                    <p>{event.note}</p>
                    <small>{formatTime(event.createdAt)} · {event.createdBy}</small>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
      )}

      {(view === "all" || view === "lead-crm") && (
      <section id="lead-crm" className="lead-crm-panel" aria-label="线索 CRM 原型">
        <div className="section-heading-row compact-heading">
          <div>
            <div className="section-kicker">线索 CRM</div>
            <h2>把私信变成可跟进商机</h2>
          </div>
          <p>按意向、风险、所在私域和下一步动作自动生成 CRM 视图，后续可接真实客户表和成交归因。</p>
        </div>

        <ClientLoopProgress tenantId={tenant.id} current="crm" />

        <div className="lead-crm-table">
          <div className="lead-crm-row lead-crm-head">
            <span>客户</span>
            <span>阶段</span>
            <span>需求</span>
            <span>价值</span>
            <span>负责人</span>
            <span>下一步</span>
            <span>处理状态</span>
          </div>
          {leadRows.map((lead) => (
            <button
              type="button"
              key={lead.id}
              className="lead-crm-row"
              onClick={() => {
              setSelectedId(lead.id);
                if (view === "lead-crm") {
                  window.location.assign(`/workspace/inbox${tenantQuery}`);
                } else {
                  document.getElementById("inbox")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <span>
                <em className={`mini-risk-dot ${lead.risk}`} />
                {lead.name}
              </span>
              <span>{lead.stage}</span>
              <span>{lead.need}</span>
              <span>{lead.value}</span>
              <span>{lead.owner}</span>
              <span>{lead.nextAction}</span>
              <span><em className="lead-action-chip">{lead.actionLabel}</em></span>
            </button>
          ))}
        </div>
      </section>
      )}
    </>
  );
}
