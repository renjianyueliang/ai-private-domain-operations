"use client";

import { useMemo, useRef, useState } from "react";
import { agents, agentById, AgentId } from "../lib/agents";
import {
  createWorkflow,
  StepStatus,
  WorkflowRun,
  WorkflowStep,
} from "../lib/workflow";
import {
  formatNumber,
  getTenantById,
  type SaasTenant,
  usagePercent,
} from "../lib/saas";
import {
  featureDescriptions,
  featureLabels,
  getFeatureAccess,
  getTenantEntitlement,
  type FeatureKey,
} from "../lib/entitlements";
import {
  countOperationStatus,
  getIndustryTemplateById,
  getTenantOperations,
} from "../lib/operations";
import { getRevenueAutopilotProfile } from "../lib/autopilot";
import { FoundationPanel } from "./FoundationPanel";
import { RevenueAutopilotCenter } from "./RevenueAutopilotCenter";
import { TodayWorkspace } from "./TodayWorkspace";

const statusLabels: Record<StepStatus, string> = {
  waiting: "等待中",
  running: "执行中",
  done: "已完成",
  needs_review: "需人工确认",
  blocked: "已阻断",
};

const statusOrder: StepStatus[] = [
  "waiting",
  "running",
  "done",
  "needs_review",
  "blocked",
];

const sampleCommandsByIndustry: Record<string, string[]> = {
  交易教学: [
    "帮我设计黄金交易新手课的7天私域转化流程",
    "帮我为交易复盘训练营设计短视频获客和社群转化流程",
    "帮我生成一套不承诺收益的交易教学公开课私域运营方案",
  ],
  金融: [
    "帮我根据金融知识库生成合规的财商科普获客流程",
    "帮我规划一套从短视频到企业微信的客户需求诊断流程",
    "帮我生成不承诺收益的家庭资产配置内容计划",
  ],
  医美: [
    "帮我根据医美知识库生成合规的项目科普和预约承接流程",
    "帮我规划小红书和抖音的面诊咨询获客内容",
    "帮我生成不夸大疗效的术后护理短视频计划",
  ],
  中医: [
    "帮我根据中医知识库生成合规的节气养生科普流程",
    "帮我规划视频号到企业微信的门店预约承接流程",
    "帮我生成不涉及在线诊断和处方的健康内容计划",
  ],
};

const customerFeatureCards: Array<{
  feature: FeatureKey;
  title: string;
  description: string;
}> = [
  {
    feature: "knowledge_upload",
    title: "行业知识库",
    description: "客户上传资料后，AI 只围绕知识库生成内容和回复建议。",
  },
  {
    feature: "content_factory",
    title: "AI 内容工厂",
    description: "自动生成选题、脚本、标题、封面文案、评论引导和私信话术。",
  },
  {
    feature: "video_factory",
    title: "视频分发中心",
    description: "按平台生成尺寸、时长、字幕、标题、标签和发布计划。",
  },
  {
    feature: "conversation_center",
    title: "私域会话中心",
    description: "统一承接评论/私信/企微/Telegram，并按风险转人工。",
  },
];

const workflowStages: Array<{
  label: string;
  detail: string;
  feature: FeatureKey;
}> = [
  { label: "知识库", detail: "资料入库", feature: "knowledge_upload" },
  { label: "内容", detail: "选题脚本", feature: "content_factory" },
  { label: "视频", detail: "剪辑适配", feature: "video_factory" },
  { label: "发布", detail: "排期分发", feature: "publish_center" },
  { label: "线索", detail: "评论私信", feature: "conversation_center" },
  { label: "私域", detail: "企微/Telegram", feature: "wecom_connector" },
  { label: "复盘", detail: "数据优化", feature: "analytics_dashboard" },
];

const platformPlaybook = [
  {
    title: "短视频平台",
    platforms: "YouTube / TikTok / 抖音 / 快手 / 小红书 / 视频号",
    mode: "优先官方 API；受限平台生成素材包和发布清单",
    boundary: "不使用个人号外挂，不模拟点击，不绕过平台风控。",
  },
  {
    title: "微信私域",
    platforms: "企业微信 / 微信客服 / 公众号 / 小程序客服",
    mode: "客户授权企业主体后，通过官方回调承接客户主动咨询",
    boundary: "不控制个人微信；加好友、触达频次和销售动作必须合规限制。",
  },
  {
    title: "Telegram 私域",
    platforms: "Telegram Bot / 群组 / 频道",
    mode: "用户先联系 Bot 或进入群组后，Webhook 进入会话中心",
    boundary: "高风险咨询、金融/医疗/诊疗/成交承诺默认转人工。",
  },
];

function updateStep(
  steps: WorkflowStep[],
  stepId: string,
  patch: Partial<WorkflowStep>,
) {
  return steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step));
}

function createTenantWorkflow(command: string, tenant: SaasTenant): WorkflowRun {
  const workflow = createWorkflow(command);
  return {
    ...workflow,
    tenantId: tenant.id,
    tenantName: tenant.name,
    runLog: [
      `已载入客户工作区：${tenant.name}（${tenant.workspace}）。`,
      ...workflow.runLog,
    ],
  };
}

type CommanderDashboardProps = {
  initialTenantId?: string;
};

export function CommanderDashboard({ initialTenantId }: CommanderDashboardProps) {
  const initialTenant = getTenantById(initialTenantId);
  const [command, setCommand] = useState(initialTenant.defaultCommand);
  const [run, setRun] = useState<WorkflowRun>(() =>
    createTenantWorkflow(initialTenant.defaultCommand, initialTenant),
  );
  const [selectedTenantId] = useState(initialTenant.id);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>("brain");
  const [activeStepId, setActiveStepId] = useState("step-01");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const [approved, setApproved] = useState(false);

  const selectedTenant = getTenantById(selectedTenantId);
  const tenantOperations = getTenantOperations(selectedTenant.id);
  const industryTemplate = getIndustryTemplateById(tenantOperations.industryTemplateId);
  const sampleCommands =
    sampleCommandsByIndustry[industryTemplate.name] ?? sampleCommandsByIndustry["交易教学"];
  const entitlement = getTenantEntitlement(selectedTenant);
  const knowledgeAccess = getFeatureAccess(selectedTenant, "knowledge_upload");
  const contentAccess = getFeatureAccess(selectedTenant, "content_factory");
  const videoAccess = getFeatureAccess(selectedTenant, "video_factory");
  const publishAccess = getFeatureAccess(selectedTenant, "publish_center");
  const conversationAccess = getFeatureAccess(selectedTenant, "conversation_center");
  const selectedAgent = agentById[selectedAgentId];
  const selectedSteps = run.steps.filter((step) => step.agentId === selectedAgentId);
  const activeStep =
    run.steps.find((step) => step.id === activeStepId) ?? selectedSteps[0] ?? run.steps[0];
  const readyContentCount = countOperationStatus(tenantOperations.contentBriefs, "ready");
  const reviewVideoCount = countOperationStatus(tenantOperations.videoJobs, "review");
  const highIntentCount = tenantOperations.conversations.filter(
    (conversation) => conversation.intent === "高意向" || conversation.intent === "需人工",
  ).length;
  const autopilotProfile = getRevenueAutopilotProfile(selectedTenant);

  const summary = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      count: run.steps.filter((step) => step.status === status).length,
    }));
  }, [run.steps]);

  const completedCount = run.steps.filter(
    (step) => step.status === "done" || step.status === "needs_review",
  ).length;
  const progress = Math.round((completedCount / run.steps.length) * 100);

  async function loadWorkflowFromServer() {
    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command, tenantId: selectedTenantId }),
      });

      if (!response.ok) {
        throw new Error(`Workflow API returned ${response.status}`);
      }

      return (await response.json()) as WorkflowRun;
    } catch {
      return createWorkflow(command);
    }
  }

  async function startWorkflow() {
    if (isRunning) return;

    const initialRun = createTenantWorkflow(command, selectedTenant);
    setRun(initialRun);
    setApproved(false);
    setSelectedAgentId("brain");
    setActiveStepId("step-01");
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(true);

    const nextRun = await loadWorkflowFromServer();
    let workingSteps: WorkflowStep[] = nextRun.steps.map((step) => ({
      ...step,
      status: "waiting" as const,
    }));
    setRun({ ...nextRun, steps: workingSteps });

    for (const step of nextRun.steps) {
      while (pauseRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      setSelectedAgentId(step.agentId);
      setActiveStepId(step.id);
      workingSteps = updateStep(workingSteps, step.id, { status: "running" });
      setRun((previous) => ({ ...previous, steps: workingSteps }));

      await new Promise((resolve) => window.setTimeout(resolve, 520));

      while (pauseRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      const completedStep = {
        ...step,
        status:
          step.status === "blocked"
            ? ("blocked" as const)
            : agentById[step.agentId].requiresHumanApproval
              ? ("needs_review" as const)
              : ("done" as const),
      };

      workingSteps = updateStep(workingSteps, step.id, completedStep);
      setRun((previous) => ({ ...previous, steps: workingSteps }));

      if (completedStep.status === "blocked") {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }

    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(false);
  }

  function toggleWorkflowPause() {
    if (!isRunning) return;
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  }

  function resetWorkflow() {
    const nextRun = createTenantWorkflow(command, selectedTenant);
    setRun(nextRun);
    setSelectedAgentId("brain");
    setActiveStepId("step-01");
    setApproved(false);
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(false);
  }

  function approveOutbound() {
    setApproved(true);
    setRun((previous) => ({
      ...previous,
      steps: previous.steps.map((step) =>
        step.status === "needs_review" ? { ...step, status: "done" } : step,
      ),
    }));
  }

  return (
    <main className="dashboard-shell">
      <RevenueAutopilotCenter
        tenantName={selectedTenant.name}
        riskLevel={industryTemplate.riskLevel}
        profile={autopilotProfile}
        isRunning={isRunning}
        isPaused={isPaused}
        onRun={startWorkflow}
        onTogglePause={toggleWorkflowPause}
      />

      <TodayWorkspace
        tenantName={selectedTenant.name}
        readyContentCount={readyContentCount}
        reviewVideoCount={reviewVideoCount}
        highIntentCount={highIntentCount}
        paidOrderCount={selectedTenant.funnel.paidOrders}
        industryName={industryTemplate.name}
      />

      <section id="commander" className="commander-card" aria-label="AI 指挥官输入区">
        <div>
          <label htmlFor="command">指挥官任务</label>
          <textarea
            id="command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={`输入一句话任务，例如：${sampleCommands[0]}`}
          />
          <div className="sample-row" aria-label="示例任务">
            {sampleCommands.map((sample) => (
              <button
                key={sample}
                type="button"
                className="sample-button"
                onClick={() => setCommand(sample)}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
        <div className="commander-actions">
          <button className="primary-button" onClick={startWorkflow} disabled={isRunning}>
            {isRunning ? "正在调度 AI 员工..." : "开始执行全流程"}
          </button>
          <button className="secondary-button" onClick={resetWorkflow} disabled={isRunning}>
            重置流程
          </button>
        </div>
      </section>

      <div id="foundation" className="anchor-section">
        <FoundationPanel
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.name}
          knowledgeAccess={knowledgeAccess}
          videoAccess={videoAccess}
        />
      </div>

      <section className="capability-grid" aria-label="四大能力">
        {customerFeatureCards.map(({ feature, title, description }) => {
          const access = getFeatureAccess(selectedTenant, feature);
          return (
          <article key={title} className={`capability-card ${access.allowed ? "" : "locked-card"}`}>
            <span className={`mini-status ${access.allowed ? "ready" : "blocked"}`}>
              {access.allowed ? "已开通" : "未开通"}
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            {!access.allowed && <small>{access.reason}</small>}
          </article>
          );
        })}
      </section>

      <section className="flow-strip" aria-label="客户运营流程">
        {workflowStages.map((stage, index) => {
          const access = getFeatureAccess(selectedTenant, stage.feature);
          return (
            <div key={stage.label} className={access.allowed ? "enabled" : "locked"}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <span>{stage.label}</span>
              <small>{stage.detail}</small>
            </div>
          );
        })}
      </section>

      <section id="analytics" className="saas-grid workspace-summary-grid" aria-label="客户工作区运营模块">
        <article className="saas-panel entitlement-panel">
          <div className="panel-heading compact">
            <span>我的授权与功能</span>
            <small>
              {entitlement.plan.name} · {entitlement.plan.priceText}
            </small>
          </div>
          <div className="entitlement-summary">
            <div>
              <span>席位</span>
              <strong>
                {selectedTenant.usage.seats} / {entitlement.plan.seatsLimit}
              </strong>
            </div>
            <div>
              <span>AI 执行</span>
              <strong>
                {formatNumber(selectedTenant.usage.aiRuns)} /{" "}
                {formatNumber(entitlement.plan.aiRunsLimit)}
              </strong>
            </div>
            <div>
              <span>视频任务</span>
              <strong>
                {formatNumber(selectedTenant.usage.videoJobs)} /{" "}
                {formatNumber(entitlement.plan.videoJobsLimit)}
              </strong>
            </div>
            <div>
              <span>行业模板</span>
              <strong>{industryTemplate.name}</strong>
            </div>
          </div>
          <div className="feature-token-grid">
            {(Object.keys(featureLabels) as FeatureKey[]).map((feature) => {
              const enabled = entitlement.enabledFeatures.includes(feature);
              return (
                <span
                  key={feature}
                  className={`feature-token ${enabled ? "enabled" : "locked"}`}
                  title={featureDescriptions[feature]}
                >
                  {enabled ? "✓" : "锁"} {featureLabels[feature]}
                </span>
              );
            })}
          </div>
        </article>

        <article className="saas-panel">
          <div className="panel-heading compact">
            <span>我的套餐与用量</span>
            <small>{selectedTenant.plan} · 到期 {selectedTenant.renewalDate}</small>
          </div>
          <div className="usage-list">
            {[
              ["线索容量", selectedTenant.usage.contacts, entitlement.plan.contactsLimit],
              ["AI 执行", selectedTenant.usage.aiRuns, entitlement.plan.aiRunsLimit],
              ["视频任务", selectedTenant.usage.videoJobs, entitlement.plan.videoJobsLimit],
              ["成员席位", selectedTenant.usage.seats, entitlement.plan.seatsLimit],
              ["资料存储", selectedTenant.usage.storageMb, entitlement.plan.storageLimitMb],
            ].map(([label, value, limit]) => {
              const current = Number(value);
              const max = Number(limit);
              return (
                <div key={String(label)} className="usage-row">
                  <div>
                    <span>{label}</span>
                    <strong>
                      {formatNumber(current)} / {formatNumber(max)}
                    </strong>
                  </div>
                  <em>
                    <i style={{ width: `${usagePercent(current, max)}%` }} />
                  </em>
                </div>
              );
            })}
          </div>
        </article>

        <article className="saas-panel">
          <div className="panel-heading compact">
            <span>我的私域转化漏斗</span>
            <small>当前工作区样例数据</small>
          </div>
          <div className="funnel-list">
            {[
              ["线索", selectedTenant.funnel.leads],
              ["加私域", selectedTenant.funnel.addedPrivate],
              ["进群", selectedTenant.funnel.groupJoined],
              ["试听预约", selectedTenant.funnel.bookedTrial],
              ["成交", selectedTenant.funnel.paidOrders],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{formatNumber(Number(value))}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="saas-panel">
          <div className="panel-heading compact">
            <span>我的渠道连接状态</span>
            <small>客户授权后的连接情况</small>
          </div>
          <div className="status-list">
            {selectedTenant.channels.map((channel) => (
              <div key={channel.name} className={`status-item ${channel.status}`}>
                <strong>{channel.name}</strong>
                <span>{channel.description}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="saas-panel">
          <div className="panel-heading compact">
            <span>我的知识库</span>
            <small>AI 员工回答依据</small>
          </div>
          <div className="status-list">
            {selectedTenant.knowledgeBase.map((item) => (
              <div key={item.title} className={`status-item ${item.status}`}>
                <strong>{item.title}</strong>
                <span>{item.type}</span>
              </div>
            ))}
          </div>
        </article>

      </section>

      <section id="operations" className="ops-overview" aria-label="行业自动化运营中心">
        <div className="section-heading-row">
          <div>
            <div className="section-kicker">第二版 SaaS 能力</div>
            <h2>行业内容与私域运营中心</h2>
          </div>
          <p>
            当前工作区使用「{industryTemplate.name}」行业模板。
            系统会根据客户知识库生成内容、视频适配、发布计划和私域回复建议；高风险动作保持人工确认。
          </p>
        </div>

        <div className="ops-kpi-row">
          {[
            ["行业模板", industryTemplate.name, industryTemplate.riskLevel],
            ["可发布内容", `${readyContentCount}`, "草稿已过初筛"],
            ["待审视频", `${reviewVideoCount}`, "发布前人工确认"],
            ["重点会话", `${highIntentCount}`, "高意向或需人工"],
          ].map(([label, value, description]) => (
            <article key={label} className="ops-kpi-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{description}</small>
            </article>
          ))}
        </div>

        <div className="ops-grid">
          <article className="ops-panel industry-panel">
            <div className="panel-heading compact">
              <span>行业模板与风控规则</span>
              <small>{industryTemplate.reviewMode}</small>
            </div>
            <p className="panel-copy">{industryTemplate.description}</p>
            <div className="rule-columns">
              <div>
                <strong>允许内容</strong>
                <ul>
                  {industryTemplate.allowedTopics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>禁止表达</strong>
                <ul>
                  {industryTemplate.prohibitedClaims.map((claim) => (
                    <li key={claim}>{claim}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="disclaimer-row">
              {industryTemplate.requiredDisclaimers.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>

          <article className={`ops-panel ${contentAccess.allowed ? "" : "locked-panel"}`}>
            <div className="panel-heading compact">
              <span>AI 内容工厂</span>
              <small>选题 / 脚本 / 标题 / 引流钩子</small>
            </div>
            {!contentAccess.allowed && <div className="locked-note">{contentAccess.reason}</div>}
            <div className="content-brief-list">
              {tenantOperations.contentBriefs.map((brief) => (
                <div key={brief.id} className="content-brief-card">
                  <div>
                    <strong>{brief.title}</strong>
                    <span>{brief.platformGoal} · {brief.format}</span>
                  </div>
                  <em className={`tag ${brief.status}`}>
                    {brief.status === "ready"
                      ? "可用"
                      : brief.status === "review"
                        ? "待审核"
                        : "已阻断"}
                  </em>
                  <p>知识来源：{brief.source}</p>
                  <small>{brief.riskNote}</small>
                </div>
              ))}
            </div>
          </article>

          <article className={`ops-panel wide ${videoAccess.allowed ? "" : "locked-panel"}`}>
            <div className="panel-heading compact">
              <span>视频剪辑与平台适配</span>
              <small>尺寸 / 时长 / 字幕 / 风控检查</small>
            </div>
            {!videoAccess.allowed && <div className="locked-note">{videoAccess.reason}</div>}
            <div className="video-job-list">
              {tenantOperations.videoJobs.map((job) => (
                <div key={job.id} className="video-job-card">
                  <div className="video-frame">
                    <span>{job.aspectRatio}</span>
                    <strong>{job.duration}</strong>
                  </div>
                  <div>
                    <div className="video-job-header">
                      <strong>{job.title}</strong>
                      <em className={`tag ${job.status}`}>
                        {job.status === "scheduled"
                          ? "已排期"
                          : job.status === "review"
                            ? "待审核"
                            : "草稿"}
                      </em>
                    </div>
                    <p>原始素材：{job.sourceClip}</p>
                    <p>{job.subtitle}</p>
                    <div className="platform-chip-row">
                      {job.targetPlatforms.map((platform) => (
                        <span key={platform}>{platform}</span>
                      ))}
                    </div>
                    <ul className="safety-list">
                      {job.safetyChecklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={`ops-panel ${publishAccess.allowed ? "" : "locked-panel"}`}>
            <div className="panel-heading compact">
              <span>多平台发布中心</span>
              <small>官方 API 优先，受限平台做素材包</small>
            </div>
            {!publishAccess.allowed && <div className="locked-note">{publishAccess.reason}</div>}
            <div className="publish-plan-list">
              {tenantOperations.publishPlans.map((plan) => (
                <div key={`${plan.platform}-${plan.mode}`} className="publish-plan-card">
                  <div>
                    <strong>{plan.platform}</strong>
                    <span>{plan.mode}</span>
                  </div>
                  <em className={`tag ${plan.status}`}>
                    {plan.status === "connected"
                      ? "已连接"
                      : plan.status === "pending"
                        ? "待授权"
                        : "人工发布"}
                  </em>
                  <p>{plan.requirement}</p>
                  <small>{plan.nextAction}</small>
                </div>
              ))}
            </div>
          </article>

          <article className={`ops-panel ${conversationAccess.allowed ? "" : "locked-panel"}`}>
            <div className="panel-heading compact">
              <span>私域会话中心</span>
              <small>评论 / 私信 / 企微 / Telegram</small>
            </div>
            {!conversationAccess.allowed && (
              <div className="locked-note">{conversationAccess.reason}</div>
            )}
            <div className="conversation-list">
              {tenantOperations.conversations.map((conversation) => (
                <div key={conversation.id} className="conversation-card">
                  <div className="conversation-head">
                    <strong>{conversation.visitor}</strong>
                    <em className="tag review">{conversation.intent}</em>
                  </div>
                  <span>{conversation.channel}</span>
                  <p>客户问题：{conversation.question}</p>
                  <p>AI建议：{conversation.aiReply}</p>
                  <small>下一步：{conversation.nextStep}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="ops-panel automation-panel">
            <div className="panel-heading compact">
              <span>自动化边界</span>
              <small>保护客户账号和平台合规</small>
            </div>
            <ol>
              {tenantOperations.automationBoundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ol>
          </article>

          <article className="ops-panel connector-panel wide">
            <div className="panel-heading compact">
              <span>平台连接策略</span>
              <small>客户授权后才能自动化</small>
            </div>
            <div className="connector-playbook">
              {platformPlaybook.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.platforms}</span>
                  <p>{item.mode}</p>
                  <small>{item.boundary}</small>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section id="team" className="workspace-grid">
        <aside className="agent-sidebar" aria-label="AI 员工列表">
          <div className="panel-heading">
            <span>AI 员工团队</span>
            <small>点击查看职责</small>
          </div>
          <div className="agent-list">
            {agents.map((agent) => {
              const agentSteps = run.steps.filter((step) => step.agentId === agent.id);
              const currentStatus = agentSteps.some((step) => step.status === "running")
                ? "running"
                : agentSteps.some((step) => step.status === "blocked")
                  ? "blocked"
                  : agentSteps.some((step) => step.status === "needs_review")
                    ? "needs_review"
                    : agentSteps.every((step) => step.status === "done") && agentSteps.length > 0
                      ? "done"
                      : "waiting";

              return (
                <button
                  key={agent.id}
                  type="button"
                  className={`agent-item ${selectedAgentId === agent.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    if (agentSteps[0]) setActiveStepId(agentSteps[0].id);
                  }}
                >
                  <span className="agent-icon">{agent.icon}</span>
                  <span>
                    <strong>
                      {agent.index} {agent.name}
                    </strong>
                    <small>{agent.shortName}</small>
                  </span>
                  <em className={`status-dot ${currentStatus}`} aria-label={statusLabels[currentStatus]} />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="workflow-panel" aria-label="任务流转">
          <div className="panel-heading">
            <span>自动流转任务链</span>
            <small>指挥官将任务拆给多个 AI 员工</small>
          </div>
          <div className="progress-bar" aria-label={`流程进度 ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="status-summary">
            {summary.map((item) => (
              <div key={item.status}>
                <strong>{item.count}</strong>
                <span>{statusLabels[item.status]}</span>
              </div>
            ))}
          </div>
          <div className="run-log" aria-label="执行模式日志">
            {run.runLog.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="workflow-list">
            {run.steps.map((step, index) => {
              const agent = agentById[step.agentId];
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`workflow-step ${activeStep?.id === step.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedAgentId(step.agentId);
                    setActiveStepId(step.id);
                  }}
                >
                  <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="step-main">
                    <strong>{step.title}</strong>
                    <small>
                      {agent.icon} {agent.name} · {step.objective}
                    </small>
                  </span>
                  <span className={`status-pill ${step.status}`}>{statusLabels[step.status]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="detail-panel" aria-label="执行详情">
          <div className="panel-heading">
            <span>执行详情</span>
            <small>{selectedAgent.name}</small>
          </div>
          <article className="agent-profile">
            <div className="large-icon">{selectedAgent.icon}</div>
            <div>
              <h2>{selectedAgent.index}号员工 · {selectedAgent.name}</h2>
              <p>{selectedAgent.role}</p>
            </div>
          </article>
          <div className="profile-grid">
            <div>
              <span>能力</span>
              <strong>{selectedAgent.tone}</strong>
            </div>
            <div>
              <span>风险等级</span>
              <strong>{selectedAgent.riskLevel}</strong>
            </div>
            <div>
              <span>人工确认</span>
              <strong>{selectedAgent.requiresHumanApproval ? "需要" : "不需要"}</strong>
            </div>
          </div>
          <article className="output-card">
            <div className="output-header">
              <h3>{activeStep.title}</h3>
              <span className={`status-pill ${activeStep.status}`}>
                {statusLabels[activeStep.status]}
              </span>
            </div>
            <p className="objective">{activeStep.objective}</p>
            <div className="io-block">
              <span>输入</span>
              <p>{activeStep.input}</p>
            </div>
            <div className="io-block output">
              <span>输出</span>
              <pre>
                {activeStep.status === "waiting"
                  ? "等待 AI 员工执行后生成结果..."
                  : activeStep.status === "running"
                    ? "正在执行中，指挥官正在等待该 AI 员工返回结果..."
                    : activeStep.output || "该步骤暂无输出。"}
              </pre>
            </div>
            {activeStep.compliance && (
              <div className="compliance-box">
                <strong>合规审核：{activeStep.compliance.summary}</strong>
                <span>合规分：{activeStep.compliance.score}/100</span>
                {activeStep.compliance.hits.length > 0 ? (
                  <ul>
                    {activeStep.compliance.hits.map((hit) => (
                      <li key={hit.keyword}>
                        {hit.keyword}：{hit.reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>未发现高风险表达。</p>
                )}
              </div>
            )}
            <div className="handoff">
              <span>下一步流转</span>
              <p>{activeStep.handoff}</p>
            </div>
          </article>
          <article className="customer-card">
            <h3>当前租户与客户画像</h3>
            <dl>
              <div>
                <dt>租户</dt>
                <dd>{selectedTenant.name}</dd>
              </div>
              <div>
                <dt>套餐</dt>
                <dd>{selectedTenant.plan}</dd>
              </div>
              <div>
                <dt>产品</dt>
                <dd>{run.customerProfile.product}</dd>
              </div>
              <div>
                <dt>人群</dt>
                <dd>{run.customerProfile.segment}</dd>
              </div>
              <div>
                <dt>痛点</dt>
                <dd>{run.customerProfile.painPoint}</dd>
              </div>
              <div>
                <dt>阶段</dt>
                <dd>{run.customerProfile.stage}</dd>
              </div>
            </dl>
          </article>
          <button
            type="button"
            className="review-button"
            onClick={approveOutbound}
            disabled={
              isRunning ||
              approved ||
              !run.steps.some((step) => step.status === "needs_review")
            }
          >
            {approved ? "已人工确认对外动作" : "人工确认通过审核内容"}
          </button>
        </aside>
      </section>
    </main>
  );
}
