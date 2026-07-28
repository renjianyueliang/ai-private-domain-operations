"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileVideo2,
  MessageSquareText,
  PlayCircle,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import {
  getAcquisitionSummary,
  getCampaignsForTenant,
  type CampaignStageStatus,
  type CampaignStatus,
} from "../lib/campaigns";
import { getTenantById } from "../lib/saas";

type AcquisitionCockpitProps = {
  tenantId: string;
};

const campaignStatusLabels: Record<CampaignStatus, string> = {
  planning: "规划中",
  producing: "生产中",
  review: "审核中",
  running: "运行中",
  paused: "已暂停",
};

const stageStatusLabels: Record<CampaignStageStatus, string> = {
  done: "已完成",
  running: "执行中",
  waiting: "等待",
  blocked: "阻断",
};

export function AcquisitionCockpit({ tenantId }: AcquisitionCockpitProps) {
  const tenant = getTenantById(tenantId);
  const campaigns = useMemo(() => getCampaignsForTenant(tenant.id), [tenant.id]);
  const summary = useMemo(() => getAcquisitionSummary(tenant.id), [tenant.id]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id);
  const tenantQuery = `?tenant=${encodeURIComponent(tenant.id)}`;
  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0];

  return (
    <section id="acquisition" className="acquisition-cockpit" aria-label="AI 获客舱">
      <div className="acquisition-hero">
        <div>
          <div className="section-kicker">AI 获客舱 <span>新增原型</span></div>
          <h2>把“要获什么客户”变成可执行战役</h2>
          <p>
            系统根据 {tenant.name} 的行业模板、知识库、套餐权限和平台连接状态，
            自动拆解成内容、视频、发布、私信承接和 CRM 跟进任务。
          </p>
        </div>
        <div className="acquisition-actions">
          <a href={`/workspace/inbox${tenantQuery}`} className="secondary-button">
            <MessageSquareText size={16} />
            查看私信承接
          </a>
          <a href={`/workspace/commander${tenantQuery}`} className="primary-button">
            <Sparkles size={16} />
            交给 AI 指挥官
          </a>
        </div>
      </div>

      <div className="acquisition-metrics">
        <article>
          <span className="metric-icon green"><Target size={18} /></span>
          <div><small>获客战役</small><strong>{summary.campaigns}</strong><em>{summary.running} 个运行中</em></div>
        </article>
        <article>
          <span className="metric-icon blue"><Sparkles size={18} /></span>
          <div><small>今日内容草稿</small><strong>{summary.contentPieces}</strong><em>按知识库生成</em></div>
        </article>
        <article>
          <span className="metric-icon violet"><FileVideo2 size={18} /></span>
          <div><small>平台视频版本</small><strong>{summary.videoVersions}</strong><em>尺寸/字幕/时长适配</em></div>
        </article>
        <article>
          <span className="metric-icon amber"><UsersRound size={18} /></span>
          <div><small>预计线索</small><strong>{summary.expectedLeads}</strong><em>{summary.manualReviews} 项需审核</em></div>
        </article>
      </div>

      <div className="acquisition-layout">
        <article className="acquisition-builder">
          <div className="panel-heading compact">
            <span>新建获客战役</span>
            <small>客户只填业务目标，其余由 AI 员工拆解</small>
          </div>

          <div className="builder-form-grid" aria-label="新建获客战役表单原型">
            <label>
              行业模板
              <select defaultValue={tenant.industryTemplate}>
                <option>{tenant.industryTemplate}</option>
                <option>交易教学</option>
                <option>金融</option>
                <option>医美</option>
                <option>中医</option>
              </select>
            </label>
            <label>
              获客目标
              <input defaultValue={selectedCampaign.objective} />
            </label>
            <label>
              目标客户
              <input defaultValue={selectedCampaign.audience} />
            </label>
            <label>
              引流钩子
              <input defaultValue={selectedCampaign.offer} />
            </label>
          </div>

          <div className="builder-checklist">
            <div>
              <Bot size={18} />
              <strong>AI 自动拆任务</strong>
              <span>内容员工、视频员工、发布员工、私域员工、合规员工自动流转。</span>
            </div>
            <div>
              <ShieldAlert size={18} />
              <strong>风险先行</strong>
              <span>{selectedCampaign.riskMode}；高风险行业默认不自动发送成交承诺。</span>
            </div>
            <div>
              <RadioTower size={18} />
              <strong>平台边界明确</strong>
              <span>有官方接口则自动排期；无官方接口则生成素材包和人工操作清单。</span>
            </div>
          </div>
        </article>

        <article className="campaign-list-panel">
          <div className="panel-heading compact">
            <span>战役列表</span>
            <small>点击切换执行详情</small>
          </div>
          <div className="campaign-selector-list">
            {campaigns.map((campaign) => (
              <button
                type="button"
                key={campaign.id}
                className={campaign.id === selectedCampaign.id ? "active" : ""}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <span className={`campaign-status-dot ${campaign.status}`} />
                <div>
                  <strong>{campaign.name}</strong>
                  <small>{campaign.objective}</small>
                </div>
                <em>{campaignStatusLabels[campaign.status]}</em>
              </button>
            ))}
          </div>
        </article>
      </div>

      <article className="campaign-detail-card">
        <div className="campaign-detail-heading">
          <div>
            <span className={`campaign-pill ${selectedCampaign.status}`}>
              {campaignStatusLabels[selectedCampaign.status]}
            </span>
            <h3>{selectedCampaign.name}</h3>
            <p>{selectedCampaign.audience}</p>
          </div>
          <div className="campaign-target-card">
            <small>私域承接目标</small>
            <strong>{selectedCampaign.privateDomainTarget}</strong>
          </div>
        </div>

        <div className="campaign-stage-track">
          {selectedCampaign.stages.map((stage, index) => (
            <div key={stage.name} className={stage.status}>
              <span>
                {stage.status === "done" ? <CheckCircle2 size={16} /> : index + 1}
              </span>
              <strong>{stage.name}</strong>
              <small>{stage.description}</small>
              <em>{stageStatusLabels[stage.status]}</em>
            </div>
          ))}
        </div>

        <div className="campaign-bottom-grid">
          <div className="campaign-task-board">
            <div className="panel-heading compact">
              <span>AI 员工执行板</span>
              <small>把一个获客目标拆成多个员工任务</small>
            </div>
            {selectedCampaign.tasks.map((task) => (
              <div key={task.id} className={`campaign-task ${task.status}`}>
                <PlayCircle size={17} />
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.owner} · {task.eta}</span>
                  <p>{task.output}</p>
                </div>
                <em>{stageStatusLabels[task.status]}</em>
              </div>
            ))}
          </div>

          <div className="campaign-rule-card">
            <div className="panel-heading compact">
              <span>知识库与风控</span>
              <small>商业化版本必须可审计</small>
            </div>
            <div className="knowledge-chip-row">
              {selectedCampaign.sourceKnowledge.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <ul>
              {selectedCampaign.safeguards.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a href={`/workspace/review${tenantQuery}`} className="review-link-button">
              <ClipboardCheck size={15} />
              查看待审核动作
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </article>
    </section>
  );
}
