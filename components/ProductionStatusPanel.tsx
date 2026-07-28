"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CreditCard,
  Database,
  FileText,
  HardDrive,
  KeyRound,
  Network,
  RadioTower,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import { saasTenants } from "../lib/saas";

type PlatformStatus = {
  generatedAt: string;
  database: { mode: string; configured: boolean; note: string };
  auth: {
    configured: boolean;
    loginCodeRequired: boolean;
    sessionActive: boolean;
    currentUser: { id: string; name: string; role: string } | null;
    note: string;
  };
  storage: { backend: string; configured: boolean; bucket: string; note: string };
  queue: { backend: string; configured: boolean; queueName: string; note: string };
  connectors: {
    ready: number;
    needsCredentials: number;
    manualOnly: number;
    connectors: Array<{
      id: string;
      name: string;
      status: "ready" | "needs_credentials" | "manual_only" | "not_supported";
      automationLevel: string;
      missingEnv: string[];
      note: string;
    }>;
  };
  billing: { records: number; note: string };
  onboarding: { tenantDrafts: number };
};

const statusLabels = {
  ready: "可用",
  needs_credentials: "缺凭证",
  manual_only: "素材包/人工",
  not_supported: "不支持",
};

const emptyForm = {
  tenantId: "tenant-gold-academy",
  kind: "contract",
  title: "年度 SaaS 服务合同",
  amountCny: "30000",
  status: "draft",
  dueDate: "2026-08-31",
};

export function ProductionStatusPanel() {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [message, setMessage] = useState("正在读取生产依赖状态...");
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function refreshStatus() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/platform/status");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "读取生产状态失败。");
      setStatus(data);
      setMessage(`状态已更新：${new Date(data.generatedAt).toLocaleString("zh-CN")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取生产状态失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("正在创建账务记录...");

    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountCny: Number(form.amountCny),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "创建账务记录失败。");
      setMessage(`已创建账务记录：${data.record.title}`);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建账务记录失败。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  const healthCards = status
    ? [
        { label: "数据库", value: status.database.mode, configured: status.database.configured, note: status.database.note, icon: Database },
        {
          label: "登录会话",
          value: status.auth.sessionActive ? "已登录" : "未登录",
          configured: status.auth.sessionActive && status.auth.configured,
          note: `${status.auth.currentUser?.name ?? "未识别用户"}；${status.auth.note}`,
          icon: KeyRound,
        },
        { label: "对象存储", value: status.storage.backend, configured: status.storage.configured, note: status.storage.note, icon: HardDrive },
        { label: "任务队列", value: status.queue.backend, configured: status.queue.configured, note: status.queue.note, icon: ServerCog },
      ]
    : [];

  return (
    <section id="admin-connectors" className="production-panel" aria-label="连接器与生产依赖">
      <div className="model-control-heading">
        <div>
          <div className="section-kicker">连接器与生产依赖</div>
          <h2>服务器、连接器、账务与安全状态</h2>
          <p>这里展示能否从本地演示进入可交付 SaaS。缺凭证的外部能力会保持待配置状态。</p>
        </div>
        <button type="button" onClick={refreshStatus} disabled={isLoading}>
          <RefreshCw size={16} />
          刷新状态
        </button>
      </div>

      <div className="production-health-grid">
        {healthCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={card.configured ? "ready" : "review"}>
              <Icon size={19} />
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="production-two-column">
        <article className="production-card">
          <div className="model-panel-heading">
            <div><strong>官方连接器</strong><span>按凭证与平台权限判断真实可用性</span></div>
            <RadioTower size={19} />
          </div>
          <div className="connector-grid">
            {status?.connectors.connectors.map((connector) => (
              <div key={connector.id} className={`connector-row ${connector.status}`}>
                <div>
                  <strong>{connector.name}</strong>
                  <span>{connector.note}</span>
                </div>
                <em>{statusLabels[connector.status]}</em>
                {connector.missingEnv.length > 0 && <small>缺少：{connector.missingEnv.join("、")}</small>}
              </div>
            ))}
          </div>
        </article>

        <article className="production-card">
          <div className="model-panel-heading">
            <div><strong>合同、发票与收款</strong><span>先记录业务单据，后续接支付网关</span></div>
            <CreditCard size={19} />
          </div>
          <form className="billing-form" onSubmit={submitBilling}>
            <label>客户
              <select value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })}>
                {saasTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </label>
            <label>类型
              <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                <option value="contract">合同</option>
                <option value="invoice">发票</option>
                <option value="payment">收款</option>
              </select>
            </label>
            <label className="full-field">标题
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>金额
              <input type="number" min="0" value={form.amountCny} onChange={(event) => setForm({ ...form, amountCny: event.target.value })} />
            </label>
            <label>状态
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="draft">草稿</option>
                <option value="issued">已开具</option>
                <option value="paid">已收款</option>
                <option value="void">已作废</option>
              </select>
            </label>
            <label>到期日
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
            <button type="submit" disabled={isLoading}>
              <FileText size={16} />
              创建账务记录
            </button>
          </form>
          <div className="production-note" role="status">
            <Network size={16} />
            {message}
            {status && <span>账务记录：{status.billing.records} 条；开通草稿：{status.onboarding.tenantDrafts} 个。</span>}
          </div>
        </article>
      </div>
    </section>
  );
}
