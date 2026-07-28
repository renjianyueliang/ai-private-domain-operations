"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { getTenantOperations, industryTemplates } from "../lib/operations";
import { saasTenants } from "../lib/saas";

type RiskEvent = {
  id: string;
  tenantId: string;
  type: string;
  level: "low" | "medium" | "high";
  action: string;
  owner: string;
  status: "open" | "reviewed";
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const fallbackAuditEvents: RiskEvent[] = [
  {
    id: "audit-001",
    tenantId: "tenant-finance-advisory",
    type: "金融高风险回复",
    level: "high",
    action: "客户询问保本保息，AI 已阻断自动发送并转人工。",
    owner: "08 私域成交员工",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "audit-002",
    tenantId: "tenant-aesthetic-clinic",
    type: "医美内容审核",
    level: "high",
    action: "脚本出现“一定有效”表达，合规员工已生成安全改写。",
    owner: "06 视频合规员工",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "audit-003",
    tenantId: "tenant-gold-academy",
    type: "发布前确认",
    level: "medium",
    action: "YouTube Shorts 发布计划等待运营确认。",
    owner: "11 发布员工",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "audit-004",
    tenantId: "tenant-tcm-clinic",
    type: "健康咨询边界",
    level: "high",
    action: "用户询问具体症状和用药，AI 已转门店人工。",
    owner: "08 私域成交员工",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const productionRules = [
  {
    title: "对外发布",
    detail: "金融、医美、中医、交易教学内容默认发布前人工确认；无官方接口的平台只生成素材包。",
    icon: RadioTower,
  },
  {
    title: "私信回复",
    detail: "AI 可起草回复；遇到收益、诊疗、价格承诺、付款退款、账号异常必须转人工。",
    icon: ShieldAlert,
  },
  {
    title: "客户授权",
    detail: "平台账号必须由客户 OAuth/官方后台授权，系统只保存服务端 token，不保存个人号密码。",
    icon: UserCheck,
  },
  {
    title: "审计留痕",
    detail: "每次模型调用、素材生成、发布确认、私信建议、人工接管都要记录租户、用户、时间和结果。",
    icon: FileWarning,
  },
];

export function AdminAuditCenter() {
  const [events, setEvents] = useState<RiskEvent[]>(fallbackAuditEvents);
  const [message, setMessage] = useState("正在读取审计事件...");
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const pendingEvents = events.filter((event) => event.status !== "reviewed");
  const highRiskCount = events.filter((event) => event.level === "high").length;

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await fetch("/api/admin/audit");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "读取审计事件失败。");
        if (!cancelled && Array.isArray(data.riskEvents)) {
          setEvents(data.riskEvents);
          setMessage(`已载入审计事件，存储模式：${data.storageMode}。`);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取审计事件失败。");
        }
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleReviewed(event: RiskEvent) {
    if (savingEventId) return;
    const nextReviewed = event.status !== "reviewed";
    setSavingEventId(event.id);
    setMessage(nextReviewed ? "正在标记已复核..." : "正在恢复为待复核...");

    try {
      const response = await fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, reviewed: nextReviewed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "更新审计事件失败。");
      setEvents((current) => current.map((item) => item.id === event.id ? data.event : item));
      setMessage(nextReviewed ? "审计事件已标记复核。" : "审计事件已恢复待复核。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新审计事件失败。");
    } finally {
      setSavingEventId(null);
    }
  }

  return (
    <section id="admin-audit" className="admin-section" aria-label="审计与风控">
      <div className="section-heading-row">
        <div>
          <div className="section-kicker">审计与风控</div>
          <h2>把“自动赚钱”拆成可控、可审计、可交付的自动化</h2>
        </div>
        <p>
          商业化版本不能只追求自动执行，必须知道哪些动作能自动、哪些动作要人工确认、
          哪些平台能力依赖官方授权。这里是平台方的风控总台。
        </p>
      </div>

      <div className="admin-audit-kpis">
        <article>
          <ShieldAlert size={19} />
          <div>
            <span>高风险事件</span>
            <strong>{highRiskCount}</strong>
            <small>今日样例</small>
          </div>
        </article>
        <article>
          <Clock3 size={19} />
          <div>
            <span>待处理</span>
            <strong>{pendingEvents.length}</strong>
            <small>需管理员复核</small>
          </div>
        </article>
        <article>
          <ShieldCheck size={19} />
          <div>
            <span>行业规则</span>
            <strong>{industryTemplates.length}</strong>
            <small>交易/金融/医美/中医</small>
          </div>
        </article>
      </div>

      <div className="model-save-banner" role="status">
        <ShieldCheck size={16} />
        {message}
      </div>

      <div className="admin-audit-layout">
        <article className="audit-event-panel">
          <div className="panel-heading compact">
            <span>风险事件队列</span>
            <small>点击可标记已复核</small>
          </div>
          <div className="audit-event-list">
            {events.map((event) => {
              const tenant = saasTenants.find((item) => item.id === event.tenantId);
              const isReviewed = event.status === "reviewed";
              return (
                <button
                  type="button"
                  key={event.id}
                  className={isReviewed ? "reviewed" : event.level}
                  onClick={() => toggleReviewed(event)}
                  disabled={savingEventId === event.id}
                >
                  <span className={`audit-level ${event.level}`}>
                    {isReviewed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  </span>
                  <div>
                    <strong>{event.type}</strong>
                    <small>
                      {tenant?.name ?? event.tenantId} · {event.owner} · {new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </small>
                    <p>{event.action}</p>
                    {event.reviewedBy && <small>复核人：{event.reviewedBy}</small>}
                  </div>
                  <em>{savingEventId === event.id ? "保存中" : isReviewed ? "已复核" : "待复核"}</em>
                </button>
              );
            })}
          </div>
        </article>

        <article className="audit-rule-panel">
          <div className="panel-heading compact">
            <span>生产规则</span>
            <small>上线前必须固化到后端策略</small>
          </div>
          <div className="risk-rule-grid">
            {productionRules.map((rule) => {
              const Icon = rule.icon;
              return (
                <div key={rule.title}>
                  <Icon size={19} />
                  <strong>{rule.title}</strong>
                  <p>{rule.detail}</p>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="industry-risk-board">
        {industryTemplates.map((template) => {
          const tenants = saasTenants.filter((tenant) => {
            const operations = getTenantOperations(tenant.id);
            return operations.industryTemplateId === template.id || tenant.industryTemplate === template.name;
          });
          return (
            <article key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <em>{template.riskLevel}</em>
              </div>
              <p>{template.reviewMode}</p>
              <span>客户：{tenants.length || 0} 个</span>
              <div className="tag-cloud">
                {template.prohibitedClaims.slice(0, 3).map((claim) => (
                  <small key={claim} className="tag blocked">禁：{claim}</small>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
