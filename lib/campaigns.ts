import { getTenantById } from "./saas";

export type CampaignStatus = "planning" | "producing" | "review" | "running" | "paused";

export type CampaignStageStatus = "done" | "running" | "waiting" | "blocked";

export type CampaignTask = {
  id: string;
  owner: string;
  title: string;
  status: CampaignStageStatus;
  eta: string;
  output: string;
};

export type AcquisitionCampaign = {
  id: string;
  tenantId: string;
  name: string;
  industry: string;
  objective: string;
  audience: string;
  offer: string;
  sourceKnowledge: string[];
  platforms: string[];
  privateDomainTarget: string;
  status: CampaignStatus;
  riskMode: "低风险自动" | "中风险审核" | "高风险人工确认";
  dailyTarget: {
    contentPieces: number;
    videoVersions: number;
    expectedLeads: number;
    manualReviews: number;
  };
  stages: Array<{
    name: string;
    description: string;
    status: CampaignStageStatus;
  }>;
  tasks: CampaignTask[];
  safeguards: string[];
};

type IndustryCampaignTemplate = Omit<AcquisitionCampaign, "id" | "tenantId" | "industry">;

const industryTemplates: Record<string, IndustryCampaignTemplate> = {
  交易教学: {
    name: "黄金交易新手课 7 天获客",
    objective: "通过风险教育短视频吸引新手领取学习路线图，并导入 Telegram / 企业微信做课程咨询。",
    audience: "有黄金、期货或外汇学习兴趣，但缺少交易纪律和复盘方法的新手。",
    offer: "免费领取《7天交易学习路线图》和一次人工课程咨询。",
    sourceKnowledge: ["黄金交易新手课大纲", "风险提示与禁用话术", "价格方案与售后政策"],
    platforms: ["YouTube Shorts", "抖音素材包", "小红书图文", "Telegram Bot"],
    privateDomainTarget: "Telegram Bot + 企业微信联系我二维码",
    status: "running",
    riskMode: "高风险人工确认",
    dailyTarget: {
      contentPieces: 8,
      videoVersions: 18,
      expectedLeads: 36,
      manualReviews: 5,
    },
    stages: [
      { name: "目标配置", description: "明确产品、客户画像、资料钩子与禁用承诺", status: "done" },
      { name: "内容生成", description: "生成选题、脚本、标题、评论引导和私信话术", status: "running" },
      { name: "视频适配", description: "拆成 9:16、16:9、1:1 版本并加免责声明", status: "running" },
      { name: "发布分发", description: "官方接口自动排期；受限平台导出素材包", status: "waiting" },
      { name: "私域承接", description: "评论/私信进入聚合中心，高风险转人工", status: "waiting" },
    ],
    tasks: [
      {
        id: "trading-task-1",
        owner: "02 内容策略员工",
        title: "生成 10 个不承诺收益的交易教学选题",
        status: "done",
        eta: "已完成",
        output: "已过滤“稳赚、带单、翻倍”等高风险词。",
      },
      {
        id: "trading-task-2",
        owner: "05 视频创作员工",
        title: "把直播切片拆成 Shorts / 抖音 / 视频号版本",
        status: "running",
        eta: "约 14 分钟",
        output: "正在生成字幕和平台尺寸清单。",
      },
      {
        id: "trading-task-3",
        owner: "08 私域销售员工",
        title: "生成 Telegram 首轮承接话术",
        status: "waiting",
        eta: "视频审核后开始",
        output: "涉及课程价格和收益边界，默认进入人工审核。",
      },
    ],
    safeguards: [
      "投资、交易、课程成交话术必须加入风险提示。",
      "任何收益、带单、荐股荐币、保证通过类表达自动阻断。",
      "平台私信只引导客户主动领取资料，不批量骚扰触达。",
    ],
  },
  金融: {
    name: "家庭资产配置科普获客",
    objective: "通过财商科普内容获取风险测评线索，并转交持牌顾问人工咨询。",
    audience: "想了解资产配置、保险或预算管理的家庭用户。",
    offer: "免费领取《家庭风险认知清单》和顾问初步咨询。",
    sourceKnowledge: ["家庭资产配置科普手册", "金融合规禁用话术", "顾问咨询流程"],
    platforms: ["YouTube", "TikTok 待授权", "小红书素材包", "Telegram Bot"],
    privateDomainTarget: "企业微信顾问 + Telegram Bot",
    status: "review",
    riskMode: "高风险人工确认",
    dailyTarget: {
      contentPieces: 6,
      videoVersions: 12,
      expectedLeads: 28,
      manualReviews: 8,
    },
    stages: [
      { name: "目标配置", description: "限定科普范围和适当性边界", status: "done" },
      { name: "内容生成", description: "围绕风险认知和预算管理生成脚本", status: "running" },
      { name: "视频适配", description: "生成带免责声明的平台版本", status: "waiting" },
      { name: "发布分发", description: "YouTube 可排期，其余平台先导出素材包", status: "waiting" },
      { name: "私域承接", description: "具体产品和收益问题转顾问", status: "blocked" },
    ],
    tasks: [
      {
        id: "finance-task-1",
        owner: "03 合规员工",
        title: "审核家庭资产配置脚本中的收益暗示",
        status: "running",
        eta: "约 6 分钟",
        output: "发现 2 处“稳健收益”表达，正在改写。",
      },
      {
        id: "finance-task-2",
        owner: "07 线索员工",
        title: "设计风险测评表单字段",
        status: "done",
        eta: "已完成",
        output: "已包含风险偏好、家庭阶段、预算范围。",
      },
      {
        id: "finance-task-3",
        owner: "10 销售员工",
        title: "配置顾问接管规则",
        status: "waiting",
        eta: "待企业微信授权",
        output: "需客户提供企业微信主体。",
      },
    ],
    safeguards: [
      "AI 只做金融知识科普，不推荐具体标的或产品。",
      "保本保息、固定收益、代客投资类问题自动转人工。",
      "客户画像和测评结果不能被包装成确定性投资建议。",
    ],
  },
  医美: {
    name: "面诊预约短视频获客",
    objective: "通过项目科普和护理知识内容，引导客户预约合规面诊。",
    audience: "对轻医美项目、术前评估或恢复护理有咨询需求的人群。",
    offer: "领取《面诊前准备清单》并预约咨询师初筛。",
    sourceKnowledge: ["面诊流程说明", "术后护理手册", "医生资质材料"],
    platforms: ["小红书素材包", "抖音企业号待授权", "视频号素材包", "企业微信"],
    privateDomainTarget: "企业微信预约承接",
    status: "producing",
    riskMode: "高风险人工确认",
    dailyTarget: {
      contentPieces: 7,
      videoVersions: 15,
      expectedLeads: 42,
      manualReviews: 7,
    },
    stages: [
      { name: "目标配置", description: "配置项目范围、医生资质和案例授权", status: "done" },
      { name: "内容生成", description: "生成项目科普和术前提醒脚本", status: "running" },
      { name: "视频适配", description: "去除夸大对比和低价诱导", status: "running" },
      { name: "发布分发", description: "生成小红书/视频号素材包，抖音待授权", status: "waiting" },
      { name: "私域承接", description: "引导预约，不自动给医疗方案", status: "waiting" },
    ],
    tasks: [
      {
        id: "beauty-task-1",
        owner: "02 内容策略员工",
        title: "生成 6 条面诊评估科普脚本",
        status: "done",
        eta: "已完成",
        output: "全部加入“效果因人而异”提示。",
      },
      {
        id: "beauty-task-2",
        owner: "05 视频创作员工",
        title: "生成小红书 1:1 与抖音 9:16 版本",
        status: "running",
        eta: "约 18 分钟",
        output: "正在处理字幕和封面标题。",
      },
      {
        id: "beauty-task-3",
        owner: "03 合规员工",
        title: "检查案例图文授权和效果表述",
        status: "waiting",
        eta: "视频生成后",
        output: "未授权案例禁止进入发布队列。",
      },
    ],
    safeguards: [
      "不承诺效果、永久有效、无风险，不做价格低价诱导。",
      "医疗项目、适应症、恢复期和疗效问题必须人工确认。",
      "案例素材必须有客户授权记录后才能使用。",
    ],
  },
  中医: {
    name: "节气养生门店预约获客",
    objective: "通过健康科普内容引导客户主动预约门店咨询，不做线上诊疗。",
    audience: "关注调理、养生、睡眠和亚健康改善的本地客户。",
    offer: "领取《节气养生日常清单》并预约到店咨询。",
    sourceKnowledge: ["节气养生内容库", "门店咨询FAQ", "健康科普免责声明"],
    platforms: ["视频号素材包", "抖音待授权", "快手待授权", "企业微信"],
    privateDomainTarget: "企业微信门店咨询二维码",
    status: "running",
    riskMode: "高风险人工确认",
    dailyTarget: {
      contentPieces: 5,
      videoVersions: 10,
      expectedLeads: 30,
      manualReviews: 6,
    },
    stages: [
      { name: "目标配置", description: "限制为健康科普和门店预约", status: "done" },
      { name: "内容生成", description: "生成节气养生脚本和图文", status: "running" },
      { name: "视频适配", description: "加入不替代诊断提示", status: "running" },
      { name: "发布分发", description: "生成多平台素材包", status: "waiting" },
      { name: "私域承接", description: "症状、处方、诊断类问题转人工", status: "waiting" },
    ],
    tasks: [
      {
        id: "tcm-task-1",
        owner: "02 内容策略员工",
        title: "生成节气养生短视频选题",
        status: "done",
        eta: "已完成",
        output: "已避开诊断、处方和根治承诺。",
      },
      {
        id: "tcm-task-2",
        owner: "05 视频创作员工",
        title: "生成视频号和快手版本",
        status: "running",
        eta: "约 11 分钟",
        output: "正在生成字幕与结尾免责声明。",
      },
      {
        id: "tcm-task-3",
        owner: "08 私域销售员工",
        title: "生成门店预约承接话术",
        status: "waiting",
        eta: "待审核",
        output: "症状描述只记录，不自动诊断。",
      },
    ],
    safeguards: [
      "不远程诊断，不自动开方，不承诺包治根治。",
      "症状、用药、处方、疗效问题默认转人工。",
      "AI 回复必须提醒线下辨证或正规就医。",
    ],
  },
};

const fallbackTemplate = industryTemplates["交易教学"];

export function getCampaignsForTenant(tenantId?: string) {
  const tenant = getTenantById(tenantId);
  const template = industryTemplates[tenant.industryTemplate] ?? fallbackTemplate;

  const primaryCampaign: AcquisitionCampaign = {
    ...template,
    id: `${tenant.id}-campaign-primary`,
    tenantId: tenant.id,
    industry: tenant.industryTemplate,
  };

  const evergreenCampaign: AcquisitionCampaign = {
    ...template,
    id: `${tenant.id}-campaign-evergreen`,
    tenantId: tenant.id,
    industry: tenant.industryTemplate,
    name: `${template.name} · 常青复投`,
    objective: "将表现最好的内容沉淀为常青素材，每周自动复盘并生成下一批变体。",
    status: "planning",
    dailyTarget: {
      contentPieces: Math.max(3, Math.round(template.dailyTarget.contentPieces * 0.6)),
      videoVersions: Math.max(6, Math.round(template.dailyTarget.videoVersions * 0.55)),
      expectedLeads: Math.max(12, Math.round(template.dailyTarget.expectedLeads * 0.45)),
      manualReviews: Math.max(2, Math.round(template.dailyTarget.manualReviews * 0.5)),
    },
    stages: template.stages.map((stage, index) => ({
      ...stage,
      status: index === 0 ? "running" : "waiting",
    })),
    tasks: template.tasks.map((task, index) => ({
      ...task,
      id: `${tenant.id}-evergreen-task-${index + 1}`,
      status: index === 0 ? "running" : "waiting",
      eta: index === 0 ? "约 9 分钟" : "等待上一步",
    })),
  };

  return [primaryCampaign, evergreenCampaign];
}

export function getAcquisitionSummary(tenantId?: string) {
  const campaigns = getCampaignsForTenant(tenantId);

  return {
    campaigns: campaigns.length,
    running: campaigns.filter((campaign) => campaign.status === "running").length,
    producing: campaigns.filter((campaign) => campaign.status === "producing").length,
    expectedLeads: campaigns.reduce((sum, campaign) => sum + campaign.dailyTarget.expectedLeads, 0),
    contentPieces: campaigns.reduce((sum, campaign) => sum + campaign.dailyTarget.contentPieces, 0),
    videoVersions: campaigns.reduce((sum, campaign) => sum + campaign.dailyTarget.videoVersions, 0),
    manualReviews: campaigns.reduce((sum, campaign) => sum + campaign.dailyTarget.manualReviews, 0),
  };
}
