import { formatNumber } from "./saas";

export type IndustryTemplate = {
  id: string;
  name: string;
  riskLevel: "中风险" | "高风险" | "极高风险";
  description: string;
  allowedTopics: string[];
  prohibitedClaims: string[];
  requiredDisclaimers: string[];
  reviewMode: string;
};

export type ContentBrief = {
  id: string;
  title: string;
  platformGoal: string;
  format: string;
  source: string;
  status: "ready" | "review" | "blocked";
  riskNote: string;
};

export type VideoJob = {
  id: string;
  title: string;
  sourceClip: string;
  targetPlatforms: string[];
  aspectRatio: string;
  duration: string;
  subtitle: string;
  status: "draft" | "review" | "scheduled";
  safetyChecklist: string[];
};

export type PublishPlan = {
  platform: string;
  mode: "官方API" | "半自动" | "素材包";
  status: "connected" | "pending" | "manual";
  requirement: string;
  nextAction: string;
};

export type ConversationLead = {
  id: string;
  channel: string;
  visitor: string;
  intent: "低意向" | "中意向" | "高意向" | "需人工";
  question: string;
  aiReply: string;
  nextStep: string;
};

export type TenantOperations = {
  tenantId: string;
  industryTemplateId: string;
  contentBriefs: ContentBrief[];
  videoJobs: VideoJob[];
  publishPlans: PublishPlan[];
  conversations: ConversationLead[];
  automationBoundaries: string[];
};

export const industryTemplates: IndustryTemplate[] = [
  {
    id: "trading-education",
    name: "交易教学",
    riskLevel: "高风险",
    description: "适合金融教育、交易课程、复盘训练营，核心是方法论、风险教育和人工成交。",
    allowedTopics: ["交易基础教学", "风控意识", "复盘方法", "模拟训练", "课程学习路径"],
    prohibitedClaims: ["保证收益", "喊单跟单", "荐股荐币", "稳赚不赔", "诱导高杠杆"],
    requiredDisclaimers: ["仅作教学交流", "不构成投资建议", "历史案例不代表未来结果"],
    reviewMode: "所有对外触达与成交话术进入人工确认",
  },
  {
    id: "finance",
    name: "金融",
    riskLevel: "极高风险",
    description: "适合理财教育、保险咨询、财商内容，必须避免具体收益承诺和投资建议。",
    allowedTopics: ["风险认知", "资产配置常识", "保险科普", "预算管理", "长期主义教育"],
    prohibitedClaims: ["保本保息", "固定收益承诺", "代客投资", "内幕消息", "诱导借贷投资"],
    requiredDisclaimers: ["内容仅为金融知识科普", "不构成具体投资建议", "决策需结合自身风险承受能力"],
    reviewMode: "高风险行业，默认人工审核后发布",
  },
  {
    id: "medical-beauty",
    name: "医美",
    riskLevel: "极高风险",
    description: "适合医美机构做项目科普、术前术后注意事项和咨询承接，必须避免夸大疗效。",
    allowedTopics: ["项目原理科普", "术前评估提醒", "恢复期护理", "医生资质展示", "真实咨询流程"],
    prohibitedClaims: ["永久有效", "无风险", "百分百变美", "最低价诱导", "虚假案例对比"],
    requiredDisclaimers: ["具体方案需面诊评估", "效果因个体情况不同", "选择正规机构和合规医生"],
    reviewMode: "内容、案例、销售话术全部需人工确认",
  },
  {
    id: "tcm",
    name: "中医",
    riskLevel: "高风险",
    description: "适合中医馆、养生调理、非处方健康科普，必须避免诊断承诺和治疗保证。",
    allowedTopics: ["体质科普", "日常调理", "作息饮食建议", "节气养生", "门店咨询流程"],
    prohibitedClaims: ["包治", "根治", "替代医院治疗", "神奇疗效", "无证诊疗"],
    requiredDisclaimers: ["内容仅为健康科普", "具体情况需线下辨证或正规就医", "不替代医生诊断"],
    reviewMode: "健康建议可草稿自动生成，诊疗相关必须转人工",
  },
];

const defaultOperations: TenantOperations = {
  tenantId: "default",
  industryTemplateId: "trading-education",
  contentBriefs: [
    {
      id: "content-default-1",
      title: "新手为什么先学风险而不是买卖点",
      platformGoal: "短视频引流",
      format: "45秒口播 + 评论区资料钩子",
      source: "风险提示与禁用话术",
      status: "ready",
      riskNote: "已加入不构成投资建议提示。",
    },
    {
      id: "content-default-2",
      title: "7天交易学习路线图",
      platformGoal: "资料领取",
      format: "图文轮播 + 私信关键词",
      source: "课程大纲",
      status: "review",
      riskNote: "涉及课程转化，需要人工确认。",
    },
  ],
  videoJobs: [
    {
      id: "video-default-1",
      title: "直播课切片：交易纪律三句话",
      sourceClip: "2026-07-直播回放-片段03",
      targetPlatforms: ["抖音", "视频号", "YouTube Shorts"],
      aspectRatio: "9:16",
      duration: "42秒",
      subtitle: "已生成双行字幕，保留风险提示结尾",
      status: "review",
      safetyChecklist: ["去除收益暗示", "统一水印位置", "评论区不引导喊单"],
    },
  ],
  publishPlans: [
    {
      platform: "抖音",
      mode: "官方API",
      status: "pending",
      requirement: "需要客户授权抖音开放平台并申请内容发布权限",
      nextAction: "先生成待发布素材，授权后再自动分发",
    },
    {
      platform: "小红书",
      mode: "素材包",
      status: "manual",
      requirement: "直接自动发布需服务市场能力或平台审核",
      nextAction: "生成标题、封面、正文和视频文件，人工发布",
    },
  ],
  conversations: [
    {
      id: "lead-default-1",
      channel: "抖音评论",
      visitor: "想学交易的新手",
      intent: "高意向",
      question: "老师有入门课吗？能不能带着做？",
      aiReply: "可以先发你一份入门学习表。我们只做交易教学和复盘训练，不提供喊单或跟单。",
      nextStep: "引导领取资料，进入企业微信人工跟进",
    },
  ],
  automationBoundaries: [
    "AI 可自动生成内容草稿，但对外发布前需要确认。",
    "AI 可自动生成评论/私信回复建议，涉及成交、诊疗、投资时转人工。",
    "不使用个人号外挂，不模拟点击，不绕过平台风控。",
  ],
};

export const tenantOperations: TenantOperations[] = [
  {
    tenantId: "tenant-gold-academy",
    industryTemplateId: "trading-education",
    contentBriefs: defaultOperations.contentBriefs,
    videoJobs: defaultOperations.videoJobs,
    publishPlans: [
      ...defaultOperations.publishPlans,
      {
        platform: "YouTube",
        mode: "官方API",
        status: "connected",
        requirement: "客户授权 Google/YouTube 后可上传公开视频或 Shorts",
        nextAction: "可进入排期发布队列",
      },
      {
        platform: "Telegram",
        mode: "官方API",
        status: "connected",
        requirement: "用户先联系 Bot 或加入群后才能自动回复",
        nextAction: "可承接海外社群问答",
      },
    ],
    conversations: defaultOperations.conversations,
    automationBoundaries: defaultOperations.automationBoundaries,
  },
  {
    tenantId: "tenant-futures-club",
    industryTemplateId: "trading-education",
    contentBriefs: [
      {
        id: "content-futures-1",
        title: "一次错误交易复盘要看哪三件事",
        platformGoal: "训练营预约",
        format: "60秒复盘口播",
        source: "复盘训练营课程说明",
        status: "ready",
        riskNote: "只讲复盘方法，不输出买卖点。",
      },
      {
        id: "content-futures-2",
        title: "模拟盘为什么不是浪费时间",
        platformGoal: "社群转化",
        format: "30秒短视频 + 社群引导",
        source: "模拟盘训练说明",
        status: "review",
        riskNote: "引导进群需人工确认。",
      },
    ],
    videoJobs: [
      {
        id: "video-futures-1",
        title: "复盘模板拆解短视频",
        sourceClip: "训练营公开课-复盘模板片段",
        targetPlatforms: ["抖音", "快手", "视频号"],
        aspectRatio: "9:16",
        duration: "55秒",
        subtitle: "已生成重点词字幕",
        status: "scheduled",
        safetyChecklist: ["无喊单", "无收益暗示", "已加学习边界"],
      },
    ],
    publishPlans: defaultOperations.publishPlans,
    conversations: [
      {
        id: "lead-futures-1",
        channel: "快手评论",
        visitor: "复盘训练营咨询者",
        intent: "中意向",
        question: "课程会教具体点位吗？",
        aiReply: "课程重点是复盘框架、风控和交易纪律，不提供具体点位或跟单服务。",
        nextStep: "发送课程大纲，若继续咨询价格则转人工",
      },
    ],
    automationBoundaries: defaultOperations.automationBoundaries,
  },
  {
    tenantId: "tenant-finance-advisory",
    industryTemplateId: "finance",
    contentBriefs: [
      {
        id: "content-finance-1",
        title: "普通家庭做资产配置前先问自己三个问题",
        platformGoal: "财商内容引流",
        format: "45秒口播 + 图文清单",
        source: "家庭资产配置科普手册",
        status: "review",
        riskNote: "涉及金融建议，必须人工审核。",
      },
      {
        id: "content-finance-2",
        title: "保本保息为什么不能随便承诺",
        platformGoal: "风险教育",
        format: "60秒知识科普",
        source: "金融合规禁用话术",
        status: "ready",
        riskNote: "仅做风险科普，不推荐产品。",
      },
    ],
    videoJobs: [
      {
        id: "video-finance-1",
        title: "风险承受能力测试讲解切片",
        sourceClip: "财商直播-风险测试片段",
        targetPlatforms: ["YouTube Shorts", "TikTok", "小红书"],
        aspectRatio: "9:16 / 1:1 双版本",
        duration: "38秒",
        subtitle: "已加入金融科普免责声明",
        status: "review",
        safetyChecklist: ["无收益承诺", "无具体标的", "无代客投资暗示"],
      },
    ],
    publishPlans: [
      {
        platform: "YouTube",
        mode: "官方API",
        status: "connected",
        requirement: "授权 YouTube Data API",
        nextAction: "可自动上传但保留审核按钮",
      },
      {
        platform: "TikTok",
        mode: "官方API",
        status: "pending",
        requirement: "需要 Content Posting API 审核和账号授权",
        nextAction: "先生成待发布任务",
      },
      {
        platform: "小红书",
        mode: "素材包",
        status: "manual",
        requirement: "金融内容平台审核较严",
        nextAction: "生成合规笔记包，人工发布",
      },
    ],
    conversations: [
      {
        id: "lead-finance-1",
        channel: "YouTube评论",
        visitor: "资产配置咨询者",
        intent: "需人工",
        question: "你能推荐一个稳赚的产品吗？",
        aiReply: "我不能推荐具体产品或承诺收益。可以先帮你了解风险承受能力和基础配置原则。",
        nextStep: "标记高风险咨询，转人工合规顾问",
      },
    ],
    automationBoundaries: [
      "不承诺收益，不推荐具体标的，不代客投资。",
      "涉及产品、收益、风险等级的问题必须人工确认。",
      "AI 只做金融知识科普和资料收集。",
    ],
  },
  {
    tenantId: "tenant-aesthetic-clinic",
    industryTemplateId: "medical-beauty",
    contentBriefs: [
      {
        id: "content-beauty-1",
        title: "做项目前为什么要先面诊评估",
        platformGoal: "医美咨询引流",
        format: "30秒医生口播",
        source: "面诊流程说明",
        status: "ready",
        riskNote: "强调个体差异，不承诺效果。",
      },
      {
        id: "content-beauty-2",
        title: "恢复期护理容易忽略的三件事",
        platformGoal: "咨询留资",
        format: "小红书图文 + 短视频",
        source: "术后护理手册",
        status: "review",
        riskNote: "涉及护理建议，需医生审核。",
      },
    ],
    videoJobs: [
      {
        id: "video-beauty-1",
        title: "医生讲面诊评估切片",
        sourceClip: "医生访谈-面诊评估片段",
        targetPlatforms: ["小红书", "抖音", "视频号"],
        aspectRatio: "9:16 / 1:1",
        duration: "35秒",
        subtitle: "已生成术语解释字幕",
        status: "review",
        safetyChecklist: ["无前后夸大对比", "无永久有效", "无低价诱导"],
      },
    ],
    publishPlans: [
      {
        platform: "抖音",
        mode: "官方API",
        status: "pending",
        requirement: "需要企业主体、行业资质和发布权限",
        nextAction: "先进入审核素材池",
      },
      {
        platform: "小红书",
        mode: "素材包",
        status: "manual",
        requirement: "医美内容建议人工复核后发布",
        nextAction: "生成封面、标题、正文和视频包",
      },
      {
        platform: "企业微信",
        mode: "官方API",
        status: "pending",
        requirement: "客户主动扫码后进入咨询承接",
        nextAction: "生成合规联系我二维码",
      },
    ],
    conversations: [
      {
        id: "lead-beauty-1",
        channel: "小红书私信",
        visitor: "医美项目咨询者",
        intent: "高意向",
        question: "这个项目能维持多久？一定有效吗？",
        aiReply: "效果和维持时间会因个体情况不同，需要医生面诊评估后给出建议。",
        nextStep: "引导预约面诊，医生/咨询师人工接手",
      },
    ],
    automationBoundaries: [
      "不承诺效果，不使用夸大前后对比，不自动给医疗方案。",
      "涉及项目适应症、价格、恢复期问题进入人工确认。",
      "AI 只做科普、预约引导和资料收集。",
    ],
  },
  {
    tenantId: "tenant-tcm-clinic",
    industryTemplateId: "tcm",
    contentBriefs: [
      {
        id: "content-tcm-1",
        title: "夏季调理先看作息，不要只盯补品",
        platformGoal: "养生科普引流",
        format: "45秒口播",
        source: "节气养生内容库",
        status: "ready",
        riskNote: "只讲日常科普，不替代诊断。",
      },
      {
        id: "content-tcm-2",
        title: "体质调理为什么不能照搬别人的方子",
        platformGoal: "门店咨询",
        format: "短视频 + 咨询引导",
        source: "门店咨询FAQ",
        status: "review",
        riskNote: "涉及体质辨析，需要人工确认。",
      },
    ],
    videoJobs: [
      {
        id: "video-tcm-1",
        title: "节气养生直播切片",
        sourceClip: "中医馆直播-夏季调理片段",
        targetPlatforms: ["视频号", "抖音", "快手"],
        aspectRatio: "9:16",
        duration: "52秒",
        subtitle: "已加入健康科普提示",
        status: "scheduled",
        safetyChecklist: ["无包治根治", "无替代就医", "无处方建议"],
      },
    ],
    publishPlans: [
      {
        platform: "视频号",
        mode: "素材包",
        status: "manual",
        requirement: "先以人工确认发布为主",
        nextAction: "生成视频号素材包和标题",
      },
      {
        platform: "快手",
        mode: "官方API",
        status: "pending",
        requirement: "需要开放平台发布能力和客户授权",
        nextAction: "准备发布参数模板",
      },
      {
        platform: "企业微信",
        mode: "官方API",
        status: "pending",
        requirement: "客户主动扫码后可进入咨询承接",
        nextAction: "配置联系我二维码和标签",
      },
    ],
    conversations: [
      {
        id: "lead-tcm-1",
        channel: "视频号评论",
        visitor: "养生咨询者",
        intent: "需人工",
        question: "我这个症状吃什么能根治？",
        aiReply: "具体症状需要线下辨证或正规就医，不能仅凭评论判断。可以先帮你预约咨询。",
        nextStep: "转人工，记录症状但不自动给诊疗方案",
      },
    ],
    automationBoundaries: [
      "不做远程诊断，不承诺包治根治，不替代正规就医。",
      "涉及症状、用药、处方自动转人工。",
      "AI 只做健康科普、预约引导和常见问题答复。",
    ],
  },
];

export function getIndustryTemplateById(id?: string) {
  return (
    industryTemplates.find((template) => template.id === id) ??
    industryTemplates[0]
  );
}

export function getTenantOperations(tenantId?: string) {
  return (
    tenantOperations.find((operations) => operations.tenantId === tenantId) ??
    defaultOperations
  );
}

export function countOperationStatus<T extends { status: string }>(
  items: T[],
  status: T["status"],
) {
  return items.filter((item) => item.status === status).length;
}

export function summarizeOperations() {
  const contentCount = tenantOperations.reduce(
    (sum, operations) => sum + operations.contentBriefs.length,
    0,
  );
  const videoCount = tenantOperations.reduce(
    (sum, operations) => sum + operations.videoJobs.length,
    0,
  );
  const conversationCount = tenantOperations.reduce(
    (sum, operations) => sum + operations.conversations.length,
    0,
  );
  const publishCount = tenantOperations.reduce(
    (sum, operations) => sum + operations.publishPlans.length,
    0,
  );

  return {
    contentCount,
    videoCount,
    conversationCount,
    publishCount,
    readableSummary: `${formatNumber(contentCount)} 个内容任务 / ${formatNumber(videoCount)} 个视频任务 / ${formatNumber(conversationCount)} 条会话样例`,
  };
}
