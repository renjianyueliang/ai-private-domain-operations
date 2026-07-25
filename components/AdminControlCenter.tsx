"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  CreditCard,
  KeyRound,
  Link2Off,
  PackageCheck,
  Plus,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";

type AdminMetrics = {
  tenants: number;
  activeTenants: number;
  trialTenants: number;
  expiredTenants: number;
  yearlyValue: number;
  contacts: number;
  aiRuns: number;
};

type AdminControlCenterProps = {
  metrics: AdminMetrics;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminControlCenter({ metrics }: AdminControlCenterProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdTenant, setCreatedTenant] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    company: "",
    industry: "交易教学",
    plan: "增长版",
    renewalDate: "2027-07-26",
    seats: "8",
  });

  async function submitTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setFormMessage("正在创建客户开通草稿...");

    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-user": "user-platform-admin",
        },
        body: JSON.stringify({
          ...form,
          seats: Number.parseInt(form.seats, 10),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "创建客户工作区失败。");
      }

      setCreatedTenant(`${data.draft.company}（草稿 ${String(data.draft.id).slice(0, 8)}）`);
      setFormMessage("");
      setDialogOpen(false);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "创建客户工作区失败。");
    } finally {
      setIsSaving(false);
    }
  }

  const overviewMetrics = [
    { label: "有效客户", value: metrics.activeTenants, note: `${metrics.trialTenants} 个试用中`, icon: UsersRound, tone: "green" },
    { label: "年化套餐额", value: formatCurrency(metrics.yearlyValue), note: "按样例合同价格", icon: CreditCard, tone: "blue" },
    { label: "总线索", value: metrics.contacts.toLocaleString("zh-CN"), note: "跨租户汇总", icon: Building2, tone: "violet" },
    { label: "AI 执行", value: metrics.aiRuns.toLocaleString("zh-CN"), note: "本计费周期", icon: Activity, tone: "amber" },
  ];

  return (
    <>
      <section id="admin-overview" className="admin-control-center" aria-label="平台经营总览">
        {createdTenant && (
          <div className="admin-success-banner" role="status">
            <CircleCheck size={17} />
            已创建“{createdTenant}”开通草稿。下一步需要配置知识库、连接器和审核规则。
            <button type="button" onClick={() => setCreatedTenant("")} aria-label="关闭提示"><X size={15} /></button>
          </div>
        )}

        <div className="admin-control-heading">
          <div>
            <div className="section-kicker">平台经营总览</div>
            <h1>先处理影响续费与交付的问题</h1>
            <p>客户、套餐、连接器、用量和风险状态已汇总。这里是平台运营人员每天进入的第一屏。</p>
          </div>
          <div className="admin-control-actions">
            <button type="button" onClick={() => setDialogOpen(true)}><Plus size={17} />开通新客户</button>
            <Link href="/workspace">进入客户工作台<ArrowRight size={16} /></Link>
          </div>
        </div>

        <div className="admin-overview-metrics">
          {overviewMetrics.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <span className={`metric-icon ${item.tone}`}><Icon size={18} /></span>
                <div><small>{item.label}</small><strong>{item.value}</strong><em>{item.note}</em></div>
              </article>
            );
          })}
        </div>

        <div className="admin-overview-grid">
          <article className="admin-attention-panel">
            <div className="admin-panel-heading">
              <div><strong>需要处理</strong><span>按商业影响排序</span></div>
              <em>4</em>
            </div>
            <div className="admin-attention-list">
              <a href="#admin-customers">
                <span className="attention-icon danger"><CalendarClock size={18} /></span>
                <div><strong>期货复盘训练营已到期</strong><small>暂停自动任务，等待续费或导出数据</small></div>
                <em>今天</em>
              </a>
              <a href="#admin-connectors">
                <span className="attention-icon warning"><Link2Off size={18} /></span>
                <div><strong>3 个客户未完成渠道授权</strong><small>Telegram、企业微信与 YouTube 待配置</small></div>
                <em>影响交付</em>
              </a>
              <a href="#admin-usage">
                <span className="attention-icon warning"><PackageCheck size={18} /></span>
                <div><strong>金石交易学院视频额度接近上限</strong><small>已使用 76%，建议升级或购买加量包</small></div>
                <em>76%</em>
              </a>
              <a href="#admin-readiness">
                <span className="attention-icon info"><ShieldCheck size={18} /></span>
                <div><strong>2 个行业模板等待合规复核</strong><small>金融报价与医美诊疗边界需要确认</small></div>
                <em>本周</em>
              </a>
            </div>
          </article>

          <article className="admin-health-panel">
            <div className="admin-panel-heading">
              <div><strong>客户健康度</strong><span>续费风险与活跃度</span></div>
              <small>{metrics.tenants} 个客户</small>
            </div>
            <div className="health-ring-row">
              <div className="health-ring"><strong>72</strong><span>平均健康分</span></div>
              <div className="health-legend">
                <span><i className="healthy" />健康 3</span>
                <span><i className="attention" />需关注 1</span>
                <span><i className="risk" />高风险 {Math.max(metrics.expiredTenants, 1)}</span>
              </div>
            </div>
            <div className="admin-health-note">
              <Clock3 size={16} />
              下一个续费节点：金石交易学院，36 天后到期。
            </div>
          </article>
        </div>

        <div className="admin-boundary-strip">
          <KeyRound size={17} />
          <span><strong>上线边界：</strong>当前为本地演示数据。正式环境必须接真实登录、多租户隔离、数据库、支付与操作审计。</span>
          <a href="#admin-readiness">查看上线清单<ArrowRight size={14} /></a>
        </div>
      </section>

      {dialogOpen && (
        <div className="admin-dialog-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogOpen(false);
        }}>
          <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="launch-dialog-title">
            <div className="admin-dialog-heading">
              <div>
                <span>客户开通向导</span>
                <h2 id="launch-dialog-title">创建客户工作区</h2>
                <p>先定义行业、套餐、到期日与席位，保存后再配置知识库和渠道。</p>
              </div>
              <button type="button" onClick={() => setDialogOpen(false)} aria-label="关闭"><X size={19} /></button>
            </div>
            <div className="dialog-stepper" aria-label="开通步骤">
              <span className="active"><em><Check size={12} /></em>基础资料</span>
              <span><em>2</em>功能授权</span>
              <span><em>3</em>渠道与上线</span>
            </div>
            <form onSubmit={submitTenant}>
              <label className="full-field">客户或品牌名称
                <input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="例如：华南医美咨询中心" />
              </label>
              <label>行业模板
                <select value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}>
                  <option>交易教学</option><option>金融服务</option><option>医美</option><option>中医健康</option><option>通用行业</option>
                </select>
              </label>
              <label>套餐
                <select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>
                  <option>试用版</option><option>基础版</option><option>增长版</option><option>企业版</option>
                </select>
              </label>
              <label>到期日期
                <input type="date" value={form.renewalDate} onChange={(event) => setForm({ ...form, renewalDate: event.target.value })} />
              </label>
              <label>成员席位
                <input type="number" min="1" max="200" value={form.seats} onChange={(event) => setForm({ ...form, seats: event.target.value })} />
              </label>
              <div className="admin-dialog-warning">
                <CircleAlert size={16} />
                金融、医疗和医美行业默认开启“发布前人工审核”，不能由客户关闭。
              </div>
              {formMessage && (
                <div className="admin-dialog-warning" role="status">
                  <Activity size={16} />
                  {formMessage}
                </div>
              )}
              <div className="admin-dialog-actions">
                <button type="button" onClick={() => setDialogOpen(false)} disabled={isSaving}>取消</button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "保存中" : "保存并继续"}<ArrowRight size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
