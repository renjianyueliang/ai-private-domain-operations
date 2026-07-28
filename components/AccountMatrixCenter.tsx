"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Network, RadioTower, ShieldCheck } from "lucide-react";
import { getAccountsForTenant } from "../lib/workspace-product";
import { getTenantById } from "../lib/saas";

type AccountMatrixCenterProps = {
  tenantId: string;
};

const authLabels = {
  connected: "已授权",
  pending: "待授权",
  manual: "素材包/人工",
};

export function AccountMatrixCenter({ tenantId }: AccountMatrixCenterProps) {
  const tenant = getTenantById(tenantId);
  const accounts = useMemo(() => getAccountsForTenant(tenant.id), [tenant.id]);
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  return (
    <section className="workspace-page-shell" aria-label="账号矩阵管理">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">账号矩阵管理 <span>新增</span></div>
          <h1>每个平台账号的定位、授权和健康度一眼可见</h1>
          <p>客户可以知道哪些账号能自动排期，哪些只能导出素材包，哪些存在风控风险。</p>
        </div>
        <a className="primary-button" href={`/workspace/channels${tenantQuery}`}>
          <RadioTower size={17} />
          配置渠道授权
        </a>
      </div>

      <div className="account-matrix-grid">
        {accounts.map((account) => (
          <article key={account.id} className="account-card">
            <div className="account-card-heading">
              <span><Network size={18} />{account.platform}</span>
              <em className={account.authStatus}>{authLabels[account.authStatus]}</em>
            </div>
            <h2>{account.accountName}</h2>
            <p>{account.positioning}</p>
            <div className="account-health">
              <strong>{account.healthScore}</strong>
              <span>
                <i style={{ width: `${account.healthScore}%` }} />
              </span>
              <small>账号健康度</small>
            </div>
            <dl>
              <div><dt>发布频率</dt><dd>{account.dailyPublishLimit}</dd></div>
              <div><dt>最近动作</dt><dd>{account.lastAction}</dd></div>
              <div><dt>风险提醒</dt><dd>{account.riskNote}</dd></div>
            </dl>
            <div className="account-card-footer">
              {account.healthScore >= 75 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {account.healthScore >= 75 ? "可继续测试内容节奏" : "建议降低频率并加强人工审核"}
            </div>
          </article>
        ))}
      </div>

      <div className="boundary-card">
        <ShieldCheck size={17} />
        账号养护在产品里只做频率、授权、风险和任务建议，不做养号脚本、外挂登录或批量模拟行为。
      </div>
    </section>
  );
}
