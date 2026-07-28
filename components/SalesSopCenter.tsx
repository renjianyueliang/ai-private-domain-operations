"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, MessageSquareText, ShieldCheck, UserCheck } from "lucide-react";
import { getSalesStagesForTenant } from "../lib/workspace-product";
import { getTenantById } from "../lib/saas";

type SalesSopCenterProps = {
  tenantId: string;
};

export function SalesSopCenter({ tenantId }: SalesSopCenterProps) {
  const tenant = getTenantById(tenantId);
  const stages = useMemo(() => getSalesStagesForTenant(tenant.id), [tenant.id]);
  const [selectedStageId, setSelectedStageId] = useState(stages[0]?.id);
  const selected = stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;

  return (
    <section className="workspace-page-shell" aria-label="销售 SOP">
      <div className="workspace-page-hero">
        <div>
          <div className="section-kicker">销售 SOP <span>新增</span></div>
          <h1>把线索跟进拆成标准动作，AI 只辅助不越界成交</h1>
          <p>适合高客单行业：AI 总结需求、给话术建议、提醒跟进；报价、合同、医疗/金融判断由人工处理。</p>
        </div>
        <a className="primary-button" href={`/workspace/crm${tenantQuery}`}>
          <UserCheck size={17} />
          查看线索 CRM
        </a>
      </div>

      <div className="sop-layout">
        <aside className="sop-stage-list">
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className={stage.id === selected.id ? "active" : ""}
              onClick={() => setSelectedStageId(stage.id)}
            >
              <em>{index + 1}</em>
              <div>
                <strong>{stage.name}</strong>
                <small>{stage.objective}</small>
              </div>
              <ArrowRight size={15} />
            </button>
          ))}
        </aside>

        <article className="sop-detail-panel">
          <div className="panel-heading compact">
            <span>{selected.name}</span>
            <small>{tenant.industryTemplate} SOP</small>
          </div>
          <div className="sop-detail-grid">
            <div>
              <ClipboardCheck size={18} />
              <strong>阶段目标</strong>
              <p>{selected.objective}</p>
            </div>
            <div>
              <MessageSquareText size={18} />
              <strong>AI 辅助</strong>
              <p>{selected.aiSupport}</p>
            </div>
            <div>
              <ShieldCheck size={18} />
              <strong>人工边界</strong>
              <p>{selected.humanGate}</p>
            </div>
          </div>
          <div className="sop-template-card">
            <strong>建议话术模板</strong>
            <p>{selected.template}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
