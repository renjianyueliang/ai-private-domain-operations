import { getTenantById } from "./saas";

export type ConversationPlatform =
  | "抖音评论"
  | "抖音私信"
  | "小红书私信"
  | "视频号评论"
  | "YouTube评论"
  | "TikTok私信"
  | "企业微信"
  | "微信客服"
  | "Telegram";

export type ConversationRisk = "low" | "medium" | "high";

export type ConversationStatus =
  | "ai_drafting"
  | "human_required"
  | "ready_to_send"
  | "follow_up"
  | "closed";

export type ConversationMessage = {
  id: string;
  sender: "customer" | "ai" | "human" | "system";
  body: string;
  time: string;
};

export type UnifiedConversation = {
  id: string;
  tenantId: string;
  platform: ConversationPlatform;
  customerName: string;
  avatar: string;
  sourceContent: string;
  intent: "低意向" | "中意向" | "高意向" | "需人工";
  status: ConversationStatus;
  risk: ConversationRisk;
  lastActive: string;
  tags: string[];
  question: string;
  aiSuggestion: string;
  nextAction: string;
  owner: string;
  leadProfile: {
    stage: "新线索" | "已加私域" | "预约中" | "成交跟进";
    need: string;
    value: string;
    privateDomain: string;
    complianceNote: string;
  };
  messages: ConversationMessage[];
};

type IndustryConversationTemplate = Omit<UnifiedConversation, "id" | "tenantId">[];

const conversationTemplates: Record<string, IndustryConversationTemplate> = {
  交易教学: [
    {
      platform: "抖音评论",
      customerName: "想学黄金的新手",
      avatar: "交",
      sourceContent: "新手为什么先学风控",
      intent: "高意向",
      status: "ready_to_send",
      risk: "medium",
      lastActive: "2 分钟前",
      tags: ["新手课", "领取资料", "需风控提示"],
      question: "老师有入门课吗？能不能带着做？",
      aiSuggestion: "可以先发你一份入门学习路线图。我们只做交易教学和复盘训练，不提供喊单或跟单服务。",
      nextAction: "发送资料领取入口；客户主动添加后分配给课程顾问。",
      owner: "08 私域销售员工",
      leadProfile: {
        stage: "新线索",
        need: "想学习黄金交易基础和复盘方法",
        value: "¥1,999-¥6,999 课程咨询",
        privateDomain: "Telegram Bot / 企业微信",
        complianceNote: "不能承诺收益，不能说带做或跟单。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "老师有入门课吗？能不能带着做？", time: "09:42" },
        { id: "m2", sender: "ai", body: "已生成安全回复，等待确认发送。", time: "09:43" },
      ],
    },
    {
      platform: "Telegram",
      customerName: "复盘学习者",
      avatar: "复",
      sourceContent: "7天交易学习路线图",
      intent: "高意向",
      status: "follow_up",
      risk: "low",
      lastActive: "18 分钟前",
      tags: ["已加私域", "课程大纲", "可跟进"],
      question: "课程是不是每天有作业？有没有复盘模板？",
      aiSuggestion: "课程会提供复盘模板和作业反馈，重点是训练交易纪律与复盘流程，不提供具体买卖点。",
      nextAction: "发送课程大纲；若询问价格，转人工顾问。",
      owner: "10 成交转化员工",
      leadProfile: {
        stage: "已加私域",
        need: "需要复盘模板和学习监督",
        value: "中高意向，适合邀约试听",
        privateDomain: "Telegram",
        complianceNote: "价格和成交承诺由人工确认。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "课程是不是每天有作业？", time: "09:18" },
        { id: "m2", sender: "ai", body: "有学习任务和复盘模板，但不会提供喊单或跟单。", time: "09:19" },
        { id: "m3", sender: "customer", body: "那可以发我课程大纲吗？", time: "09:24" },
      ],
    },
    {
      platform: "YouTube评论",
      customerName: "海外观众",
      avatar: "Y",
      sourceContent: "交易纪律三句话 Shorts",
      intent: "需人工",
      status: "human_required",
      risk: "high",
      lastActive: "31 分钟前",
      tags: ["收益承诺问题", "必须人工", "公开评论"],
      question: "跟你学能不能稳定盈利？",
      aiSuggestion: "不能承诺稳定盈利。内容仅作交易学习交流，交易有风险，学习目标是建立风控和复盘能力。",
      nextAction: "不要引导成交；由人工审核后公开回复。",
      owner: "03 合规员工",
      leadProfile: {
        stage: "新线索",
        need: "对收益预期强，风险较高",
        value: "需教育后再判断",
        privateDomain: "暂不引导",
        complianceNote: "收益承诺问题必须由人工确认。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "跟你学能不能稳定盈利？", time: "08:58" },
        { id: "m2", sender: "system", body: "命中高风险意图：收益承诺。已暂停自动发送。", time: "08:58" },
      ],
    },
  ],
  金融: [
    {
      platform: "YouTube评论",
      customerName: "资产配置咨询者",
      avatar: "财",
      sourceContent: "家庭资产配置三个误区",
      intent: "需人工",
      status: "human_required",
      risk: "high",
      lastActive: "4 分钟前",
      tags: ["保本保息", "高风险", "顾问接管"],
      question: "有没有稳赚不亏的产品可以推荐？",
      aiSuggestion: "我不能推荐具体产品或承诺收益。可以先了解你的风险承受能力，再由合规顾问做进一步沟通。",
      nextAction: "转人工顾问；只发送风险测评表单。",
      owner: "03 合规员工",
      leadProfile: {
        stage: "新线索",
        need: "寻找理财产品和风险测评",
        value: "需合规顾问判断",
        privateDomain: "企业微信顾问",
        complianceNote: "不能推荐具体产品，不能承诺收益。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "有没有稳赚不亏的产品可以推荐？", time: "10:02" },
        { id: "m2", sender: "system", body: "命中保本保息类风险，已暂停自动发送。", time: "10:02" },
      ],
    },
    {
      platform: "Telegram",
      customerName: "预算管理学习者",
      avatar: "预",
      sourceContent: "预算管理清单",
      intent: "中意向",
      status: "ready_to_send",
      risk: "medium",
      lastActive: "16 分钟前",
      tags: ["资料领取", "风险测评", "可自动建议"],
      question: "我想先学基础，不想买产品。",
      aiSuggestion: "可以先从预算管理和风险认知开始。这里有一份基础清单，内容只做知识科普，不涉及具体产品推荐。",
      nextAction: "发送资料；后续由顾问判断是否进入咨询。",
      owner: "08 私域销售员工",
      leadProfile: {
        stage: "已加私域",
        need: "财商基础学习",
        value: "适合长期培育",
        privateDomain: "Telegram",
        complianceNote: "不做产品推荐。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "我想先学基础，不想买产品。", time: "09:51" },
        { id: "m2", sender: "ai", body: "已生成资料承接回复。", time: "09:52" },
      ],
    },
  ],
  医美: [
    {
      platform: "小红书私信",
      customerName: "面诊咨询者",
      avatar: "美",
      sourceContent: "做项目前为什么要面诊",
      intent: "高意向",
      status: "ready_to_send",
      risk: "medium",
      lastActive: "5 分钟前",
      tags: ["面诊预约", "效果咨询", "需免责声明"],
      question: "这个项目能维持多久？我适合做吗？",
      aiSuggestion: "维持时间和是否适合会因个体情况不同，需要医生面诊评估后判断。可以先帮你预约初步咨询。",
      nextAction: "引导预约；不要给出诊疗判断。",
      owner: "08 私域销售员工",
      leadProfile: {
        stage: "新线索",
        need: "了解项目适应性和维持时间",
        value: "预约面诊潜力高",
        privateDomain: "企业微信预约",
        complianceNote: "不能承诺效果，不能替代医生面诊。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "这个项目能维持多久？我适合做吗？", time: "10:12" },
        { id: "m2", sender: "ai", body: "已生成预约引导回复，等待确认。", time: "10:13" },
      ],
    },
    {
      platform: "抖音私信",
      customerName: "恢复期用户",
      avatar: "护",
      sourceContent: "恢复期护理三件事",
      intent: "需人工",
      status: "human_required",
      risk: "high",
      lastActive: "22 分钟前",
      tags: ["医疗问题", "医生接管", "高风险"],
      question: "我现在有点红肿，是不是正常？要不要吃药？",
      aiSuggestion: "不建议在私信中判断或用药。请联系医生或到院复查，若有明显不适应及时就医。",
      nextAction: "转医生/咨询师，不自动回复诊疗建议。",
      owner: "03 合规员工",
      leadProfile: {
        stage: "预约中",
        need: "恢复期医疗咨询",
        value: "需要专业人员立即接管",
        privateDomain: "企业微信咨询师",
        complianceNote: "症状、用药、诊疗建议必须人工。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "我现在有点红肿，是不是正常？要不要吃药？", time: "09:40" },
        { id: "m2", sender: "system", body: "命中医疗诊疗风险，已暂停自动发送。", time: "09:40" },
      ],
    },
  ],
  中医: [
    {
      platform: "视频号评论",
      customerName: "养生咨询者",
      avatar: "中",
      sourceContent: "节气养生作息建议",
      intent: "需人工",
      status: "human_required",
      risk: "high",
      lastActive: "7 分钟前",
      tags: ["症状咨询", "不能诊断", "门店预约"],
      question: "我这个症状吃什么能根治？",
      aiSuggestion: "具体症状需要线下辨证或正规就医，不能仅凭评论判断。可以先帮你预约门店咨询。",
      nextAction: "转人工；只引导预约，不给诊疗方案。",
      owner: "03 合规员工",
      leadProfile: {
        stage: "新线索",
        need: "症状咨询和门店预约",
        value: "高意向但高风险",
        privateDomain: "企业微信门店二维码",
        complianceNote: "不能远程诊断、不能开方、不能承诺根治。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "我这个症状吃什么能根治？", time: "10:22" },
        { id: "m2", sender: "system", body: "命中诊疗和根治承诺风险，已暂停自动发送。", time: "10:22" },
      ],
    },
    {
      platform: "企业微信",
      customerName: "门店预约客户",
      avatar: "门",
      sourceContent: "夏季调理直播切片",
      intent: "高意向",
      status: "follow_up",
      risk: "medium",
      lastActive: "35 分钟前",
      tags: ["已加私域", "预约到店", "可跟进"],
      question: "周末可以过去咨询吗？",
      aiSuggestion: "可以帮你登记预约意向。具体时间和医生排班需要门店同事确认后回复。",
      nextAction: "进入预约池，分配门店员工。",
      owner: "10 成交转化员工",
      leadProfile: {
        stage: "预约中",
        need: "周末到店咨询",
        value: "预约转化潜力高",
        privateDomain: "企业微信",
        complianceNote: "排班和服务价格由人工确认。",
      },
      messages: [
        { id: "m1", sender: "customer", body: "周末可以过去咨询吗？", time: "09:47" },
        { id: "m2", sender: "ai", body: "可以帮你登记预约意向。", time: "09:49" },
      ],
    },
  ],
};

const fallbackConversations = conversationTemplates["交易教学"];

export function getConversationsForTenant(tenantId?: string) {
  const tenant = getTenantById(tenantId);
  const templates = conversationTemplates[tenant.industryTemplate] ?? fallbackConversations;

  return templates.map((conversation, index) => ({
    ...conversation,
    id: `${tenant.id}-conversation-${index + 1}`,
    tenantId: tenant.id,
  }));
}

export function getConversationSummary(tenantId?: string) {
  const conversations = getConversationsForTenant(tenantId);

  return {
    total: conversations.length,
    highIntent: conversations.filter(
      (conversation) => conversation.intent === "高意向" || conversation.intent === "需人工",
    ).length,
    humanRequired: conversations.filter((conversation) => conversation.status === "human_required").length,
    readyToSend: conversations.filter((conversation) => conversation.status === "ready_to_send").length,
    privateDomain: conversations.filter(
      (conversation) =>
        conversation.leadProfile.stage === "已加私域" ||
        conversation.leadProfile.stage === "预约中" ||
        conversation.leadProfile.stage === "成交跟进",
    ).length,
  };
}
