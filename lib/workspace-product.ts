import { getTenantById } from "./saas";

export type PlatformAccount = {
  id: string;
  tenantId: string;
  platform: string;
  accountName: string;
  positioning: string;
  authStatus: "connected" | "pending" | "manual";
  healthScore: number;
  dailyPublishLimit: string;
  lastAction: string;
  riskNote: string;
};

export type RadarOpportunity = {
  id: string;
  tenantId: string;
  platform: string;
  keyword: string;
  region: string;
  source: string;
  signal: string;
  intentScore: number;
  suggestedAction: string;
  riskLevel: "低" | "中" | "高";
};

export type VideoProductionJob = {
  id: string;
  tenantId: string;
  title: string;
  source: string;
  stage: "脚本" | "剪辑" | "字幕" | "审核" | "待发布";
  duration: string;
  versions: Array<{ platform: string; ratio: string; duration: string; status: string }>;
  scriptHook: string;
  coverTitle: string;
  subtitleStatus: string;
  safetyNotes: string[];
};

export type ReplyRule = {
  id: string;
  tenantId: string;
  name: string;
  trigger: string;
  reply: string;
  destination: string;
  enabled: boolean;
  riskMode: "自动建议" | "确认后发送" | "必须人工";
};

export type SalesStage = {
  id: string;
  tenantId: string;
  name: string;
  objective: string;
  aiSupport: string;
  humanGate: string;
  template: string;
};

function industryTone(industry: string) {
  if (industry === "金融") {
    return {
      product: "家庭资产配置科普咨询",
      hook: "免费领取《风险承受能力自测表》",
      customer: "希望学习财商知识但害怕踩坑的家庭用户",
      disclaimer: "仅做金融知识科普，不构成投资建议。",
      prohibited: "保本保息、固定收益、具体产品推荐",
      privateTarget: "企业微信顾问 / Telegram Bot",
    };
  }

  if (industry === "医美") {
    return {
      product: "面诊预约与项目科普",
      hook: "领取《面诊前准备清单》",
      customer: "想了解项目适合度、恢复期和预约流程的咨询客户",
      disclaimer: "具体方案需正规面诊评估，效果因个体不同。",
      prohibited: "永久有效、无风险、一定变美、低价诱导",
      privateTarget: "企业微信预约咨询",
    };
  }

  if (industry === "中医") {
    return {
      product: "门店调理咨询与健康科普",
      hook: "领取《节气养生自查表》",
      customer: "关注睡眠、作息、调理和门店咨询的本地客户",
      disclaimer: "内容仅为健康科普，不替代诊断和治疗。",
      prohibited: "包治根治、自动开方、替代就医",
      privateTarget: "企业微信门店咨询",
    };
  }

  return {
    product: "黄金交易新手课",
    hook: "领取《7天交易学习路线图》",
    customer: "想系统学习交易基础、风控和复盘的新手",
    disclaimer: "仅作教学交流，不构成投资建议。",
    prohibited: "保证收益、喊单跟单、荐股荐币、稳赚不赔",
    privateTarget: "Telegram Bot / 企业微信",
  };
}

export function getPlanDraftForTenant(tenantId?: string) {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return {
    tenant,
    ...tone,
    objective: "7 天内验证一条可复制的内容获客到私域成交链路",
    dailyLeadTarget: tenant.industryTemplate === "医美" ? 40 : 30,
    dailyContentTarget: tenant.industryTemplate === "金融" ? 5 : 8,
    channels: tenant.channels.map((channel) => channel.name),
    milestones: [
      "第 1 天：确认知识库、禁用话术和资料钩子。",
      "第 2-3 天：生成 20 个选题和 6 条短视频脚本。",
      "第 4 天：导出多平台素材包并进入发布审核。",
      "第 5-6 天：承接评论/私信，沉淀 CRM 线索。",
      "第 7 天：复盘曝光、私信、加私域、预约和成交。",
    ],
  };
}

export function getAccountsForTenant(tenantId?: string): PlatformAccount[] {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return [
    {
      id: `${tenant.id}-douyin`,
      tenantId: tenant.id,
      platform: "抖音",
      accountName: `${tenant.name}官方号`,
      positioning: `${tone.product}短视频科普`,
      authStatus: "pending",
      healthScore: 74,
      dailyPublishLimit: "1-2 条/天",
      lastAction: "已生成发布素材包，等待企业号授权",
      riskNote: `避免：${tone.prohibited}`,
    },
    {
      id: `${tenant.id}-xhs`,
      tenantId: tenant.id,
      platform: "小红书",
      accountName: `${tenant.name}内容号`,
      positioning: "图文种草、案例科普、资料领取",
      authStatus: "manual",
      healthScore: 68,
      dailyPublishLimit: "1 条/天",
      lastAction: "已准备封面、标题和正文",
      riskNote: "当前按素材包人工发布处理。",
    },
    {
      id: `${tenant.id}-youtube`,
      tenantId: tenant.id,
      platform: "YouTube",
      accountName: `${tenant.name}海外号`,
      positioning: "长视频切片与 Shorts 引流",
      authStatus: tenant.channels.some((channel) => channel.name === "YouTube" && channel.status === "connected")
        ? "connected"
        : "pending",
      healthScore: 82,
      dailyPublishLimit: "2-3 条/周",
      lastAction: "可生成公开视频/Shorts 发布任务",
      riskNote: "发布前保留人工审核。",
    },
    {
      id: `${tenant.id}-private`,
      tenantId: tenant.id,
      platform: tone.privateTarget,
      accountName: "私域承接入口",
      positioning: "资料领取、预约、销售跟进",
      authStatus: tenant.channels.some((channel) => channel.status === "connected") ? "connected" : "pending",
      healthScore: 79,
      dailyPublishLimit: "客户主动咨询后回复",
      lastAction: "等待客户完成官方授权或二维码配置",
      riskNote: "不做个人号外挂和批量骚扰触达。",
    },
  ];
}

export function getRadarOpportunitiesForTenant(tenantId?: string): RadarOpportunity[] {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return [
    {
      id: `${tenant.id}-radar-1`,
      tenantId: tenant.id,
      platform: "抖音评论",
      keyword: tone.product,
      region: tenant.industryTemplate === "医美" || tenant.industryTemplate === "中医" ? "同城 15km" : "全国",
      source: "同行热门视频评论区",
      signal: `用户反复询问“怎么开始 / 适不适合 / 有没有资料”。`,
      intentScore: 86,
      suggestedAction: `生成一条评论回复建议，引导领取：${tone.hook}`,
      riskLevel: "中",
    },
    {
      id: `${tenant.id}-radar-2`,
      tenantId: tenant.id,
      platform: "小红书",
      keyword: "新手避坑",
      region: "全国",
      source: "近期高收藏笔记",
      signal: "收藏高、评论问答密集，适合生成同主题安全版内容。",
      intentScore: 78,
      suggestedAction: "生成 3 个差异化选题和封面文案，不直接搬运对方内容。",
      riskLevel: "低",
    },
    {
      id: `${tenant.id}-radar-3`,
      tenantId: tenant.id,
      platform: "视频号",
      keyword: tenant.industryTemplate,
      region: "同城/兴趣",
      source: "行业账号互动区",
      signal: "出现价格、效果、收益或诊疗类高风险提问。",
      intentScore: 72,
      suggestedAction: `只生成安全回复草稿，加入免责声明：${tone.disclaimer}`,
      riskLevel: "高",
    },
  ];
}

export function getVideoJobsForTenant(tenantId?: string): VideoProductionJob[] {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return [
    {
      id: `${tenant.id}-video-1`,
      tenantId: tenant.id,
      title: `${tone.product}：新手最容易忽略的 3 件事`,
      source: "直播回放/课程素材/医生口播",
      stage: "字幕",
      duration: "42 秒",
      scriptHook: `如果你正在考虑${tone.product}，先别急着下决定，先看这 3 个判断标准。`,
      coverTitle: "新手先看这 3 点",
      subtitleStatus: "已生成双行字幕，待人工校对",
      versions: [
        { platform: "抖音", ratio: "9:16", duration: "42秒", status: "待审核" },
        { platform: "小红书", ratio: "1:1", duration: "42秒", status: "素材包" },
        { platform: "YouTube Shorts", ratio: "9:16", duration: "42秒", status: "可排期" },
      ],
      safetyNotes: [tone.disclaimer, `已过滤：${tone.prohibited}`, "引流动作需要使用官方组件或人工确认。"],
    },
    {
      id: `${tenant.id}-video-2`,
      tenantId: tenant.id,
      title: `${tone.hook} 的 30 秒引导视频`,
      source: "AI 生成脚本 + 素材库",
      stage: "审核",
      duration: "30 秒",
      scriptHook: `我整理了一份资料，适合想系统了解${tone.product}的人先自查。`,
      coverTitle: "免费资料领取",
      subtitleStatus: "字幕完成，等待风险审核",
      versions: [
        { platform: "视频号", ratio: "9:16", duration: "30秒", status: "人工发布" },
        { platform: "快手", ratio: "9:16", duration: "30秒", status: "待授权" },
        { platform: "Telegram", ratio: "16:9", duration: "30秒", status: "可入群" },
      ],
      safetyNotes: ["不承诺效果或收益。", "资料领取入口不自动私信骚扰。", "高风险咨询转人工。"],
    },
  ];
}

export function getReplyRulesForTenant(tenantId?: string): ReplyRule[] {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return [
    {
      id: `${tenant.id}-reply-1`,
      tenantId: tenant.id,
      name: "资料领取",
      trigger: "资料 / 学习计划 / 清单 / 预约",
      reply: `可以，先发你一份${tone.hook.replace("领取", "")}。${tone.disclaimer}`,
      destination: tone.privateTarget,
      enabled: true,
      riskMode: "确认后发送",
    },
    {
      id: `${tenant.id}-reply-2`,
      tenantId: tenant.id,
      name: "高风险承诺拦截",
      trigger: tone.prohibited,
      reply: `这类问题不能在评论或私信中直接承诺。${tone.disclaimer} 可以先帮你记录需求，再由人工接管。`,
      destination: "人工审核队列",
      enabled: true,
      riskMode: "必须人工",
    },
    {
      id: `${tenant.id}-reply-3`,
      tenantId: tenant.id,
      name: "预约/试听跟进",
      trigger: "价格 / 预约 / 试听 / 到店 / 咨询",
      reply: "可以先帮你登记意向，具体安排和报价由人工同事确认后回复。",
      destination: "线索 CRM",
      enabled: true,
      riskMode: "确认后发送",
    },
  ];
}

export function getSalesStagesForTenant(tenantId?: string): SalesStage[] {
  const tenant = getTenantById(tenantId);
  const tone = industryTone(tenant.industryTemplate);

  return [
    {
      id: `${tenant.id}-sop-1`,
      tenantId: tenant.id,
      name: "新线索识别",
      objective: "判断客户需求、来源内容和风险等级。",
      aiSupport: "自动总结客户问题、意向标签和推荐回复。",
      humanGate: "高风险词、价格、效果、收益、诊疗建议必须人工确认。",
      template: `先确认客户是否需要${tone.hook}，再提醒：${tone.disclaimer}`,
    },
    {
      id: `${tenant.id}-sop-2`,
      tenantId: tenant.id,
      name: "资料交付",
      objective: "通过合规资料建立信任，并引导客户进入私域。",
      aiSupport: "自动发送资料说明草稿和下一步问题。",
      humanGate: "不自动添加好友；客户主动进入官方承接入口后继续。",
      template: `资料已准备好，适合${tone.customer}。如果你愿意，可以通过${tone.privateTarget}继续咨询。`,
    },
    {
      id: `${tenant.id}-sop-3`,
      tenantId: tenant.id,
      name: "预约/成交跟进",
      objective: "记录预算、需求、时间和成交阻力。",
      aiSupport: "生成异议处理建议、跟进提醒和 CRM 记录。",
      humanGate: "报价、合同、付款、医疗/金融判断由人工完成。",
      template: "我先帮你整理需求，后续由负责同事确认具体安排。",
    },
  ];
}
