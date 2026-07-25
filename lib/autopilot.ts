import type { SaasTenant } from "./saas";

export type AutopilotMode = "assist" | "review" | "guarded" | "managed";

export type AutopilotModeDefinition = {
  id: AutopilotMode;
  name: string;
  description: string;
};

export type AutopilotException = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: string;
};

export type AutopilotActivity = {
  id: string;
  title: string;
  detail: string;
  status: "running" | "queued" | "review" | "done";
  owner: string;
};

export type RevenueAutopilotProfile = {
  mode: AutopilotMode;
  goalName: string;
  targetRevenue: number;
  attributedRevenue: number;
  pipelineValue: number;
  operatingCost: number;
  grossMarginRate: number;
  progressPercent: number;
  attributedRoi: number;
  activities: AutopilotActivity[];
  exceptions: AutopilotException[];
};

export const autopilotModes: AutopilotModeDefinition[] = [
  {
    id: "assist",
    name: "建议模式",
    description: "AI 只给出策略和草稿，所有动作由人工执行。",
  },
  {
    id: "review",
    name: "审核模式",
    description: "AI 自动推进内部任务，对外发布和成交动作等待批准。",
  },
  {
    id: "guarded",
    name: "规则自动",
    description: "已批准模板和低风险动作自动执行，异常立即暂停。",
  },
  {
    id: "managed",
    name: "托管模式",
    description: "系统持续运行和优化，仅上报高风险、预算和成交异常。",
  },
];

const industryEconomics: Record<
  string,
  { averageOrderValue: number; targetRevenue: number; grossMarginRate: number }
> = {
  交易教学: { averageOrderValue: 2800, targetRevenue: 100000, grossMarginRate: 0.78 },
  金融: { averageOrderValue: 6000, targetRevenue: 220000, grossMarginRate: 0.72 },
  医美: { averageOrderValue: 4200, targetRevenue: 180000, grossMarginRate: 0.58 },
  中医: { averageOrderValue: 680, targetRevenue: 80000, grossMarginRate: 0.62 },
};

function roundCurrency(value: number) {
  return Math.max(0, Math.round(value / 10) * 10);
}

export function getRevenueAutopilotProfile(tenant: SaasTenant): RevenueAutopilotProfile {
  const economics = industryEconomics[tenant.industryTemplate] ?? {
    averageOrderValue: 1200,
    targetRevenue: 100000,
    grossMarginRate: 0.6,
  };
  const attributedRevenue = roundCurrency(
    tenant.funnel.paidOrders * economics.averageOrderValue,
  );
  const openOpportunities = Math.max(
    tenant.funnel.bookedTrial - tenant.funnel.paidOrders,
    0,
  );
  const pipelineValue = roundCurrency(
    openOpportunities * economics.averageOrderValue * 0.46,
  );
  const operatingCost = roundCurrency(
    tenant.usage.aiRuns * 0.18 +
      tenant.usage.videoJobs * 8.5 +
      tenant.funnel.leads * 0.42,
  );
  const progressPercent = Math.min(
    100,
    Math.round((attributedRevenue / economics.targetRevenue) * 100),
  );

  return {
    mode: "review",
    goalName: `${tenant.industryTemplate}月度增长目标`,
    targetRevenue: economics.targetRevenue,
    attributedRevenue,
    pipelineValue,
    operatingCost,
    grossMarginRate: economics.grossMarginRate,
    progressPercent,
    attributedRoi:
      operatingCost > 0 ? Number((attributedRevenue / operatingCost).toFixed(1)) : 0,
    activities: [
      {
        id: "activity-content",
        title: "生成本周高转化内容组",
        detail: "根据知识库、历史咨询和成交问题生成 7 条选题与脚本。",
        status: "running",
        owner: "AI创作 · 合规风控",
      },
      {
        id: "activity-publish",
        title: "适配并安排渠道发布",
        detail: "已生成竖屏、横屏和字幕版本，等待渠道授权与排期。",
        status: "review",
        owner: "账号运营 · 视频员工",
      },
      {
        id: "activity-leads",
        title: "承接评论与私信线索",
        detail: "低风险咨询自动回复，高意向与行业敏感问题转人工。",
        status: "queued",
        owner: "公转私 · AI成交",
      },
      {
        id: "activity-review",
        title: "复盘转化并优化下一轮",
        detail: "按线索质量、预约和成交结果调整选题、话术与发布时间。",
        status: "done",
        owner: "数据复盘 · AI大脑",
      },
    ],
    exceptions: [
      {
        id: "exception-channel",
        severity: "high",
        title: "2 个渠道尚未完成授权",
        detail: "系统已保留发布任务，不会重复提交或模拟登录。",
        action: "完成授权",
      },
      {
        id: "exception-claim",
        severity: "high",
        title: "1 条脚本包含高风险承诺",
        detail: "已自动阻断对外发布，并生成安全改写版本。",
        action: "查看审核",
      },
      {
        id: "exception-followup",
        severity: "medium",
        title: "2 位高意向客户等待接管",
        detail: "AI 已整理需求、预算和会话摘要，建议 30 分钟内跟进。",
        action: "进入会话",
      },
    ],
  };
}
