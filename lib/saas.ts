export type TenantStatus = "trial" | "active" | "paused";

export type SaasTenant = {
  id: string;
  name: string;
  workspace: string;
  owner: string;
  industryTemplate: string;
  planId: "trial" | "basic_yearly" | "growth_yearly" | "enterprise_yearly";
  plan: "试用版" | "基础版" | "增长版" | "企业版";
  status: TenantStatus;
  renewalDate: string;
  defaultCommand: string;
  complianceProfile: string;
  featureOverrides?: Partial<
    Record<
      | "knowledge_upload"
      | "content_factory"
      | "video_factory"
      | "publish_center"
      | "conversation_center"
      | "wecom_connector"
      | "wechat_service_connector"
      | "telegram_connector"
      | "youtube_connector"
      | "tiktok_connector"
      | "manual_asset_pack"
      | "advanced_compliance"
      | "team_members"
      | "analytics_dashboard",
      boolean
    >
  >;
  usage: {
    contacts: number;
    contactsLimit: number;
    aiRuns: number;
    aiRunsLimit: number;
    videoJobs: number;
    videoJobsLimit: number;
    seats: number;
    seatsLimit: number;
    storageMb: number;
    storageLimitMb: number;
  };
  funnel: {
    leads: number;
    addedPrivate: number;
    groupJoined: number;
    bookedTrial: number;
    paidOrders: number;
  };
  channels: Array<{
    name: string;
    status: "connected" | "mock" | "pending" | "disabled";
    description: string;
  }>;
  knowledgeBase: Array<{
    title: string;
    type: string;
    status: "ready" | "review" | "missing";
  }>;
};

export const saasTenants: SaasTenant[] = [
  {
    id: "tenant-gold-academy",
    name: "金石交易学院",
    workspace: "gold-academy",
    owner: "运营负责人 A",
    industryTemplate: "交易教学",
    planId: "growth_yearly",
    plan: "增长版",
    status: "active",
    renewalDate: "2026-08-31",
    defaultCommand: "帮我设计黄金交易新手课的7天私域转化流程",
    complianceProfile: "交易教学：禁止收益承诺、喊单、荐股荐币、诱导高杠杆",
    usage: {
      contacts: 1264,
      contactsLimit: 3000,
      aiRuns: 218,
      aiRunsLimit: 1000,
      videoJobs: 16,
      videoJobsLimit: 80,
      seats: 4,
      seatsLimit: 8,
      storageMb: 420,
      storageLimitMb: 2048,
    },
    funnel: {
      leads: 1264,
      addedPrivate: 392,
      groupJoined: 245,
      bookedTrial: 86,
      paidOrders: 18,
    },
    channels: [
      { name: "表单线索", status: "mock", description: "已用演示数据模拟导入" },
      { name: "企业微信", status: "pending", description: "待服务器和企微应用配置" },
      { name: "短信平台", status: "disabled", description: "正式上线前不自动发送" },
      { name: "OpenAI", status: "mock", description: "无 API Key 时自动回退 mock" },
    ],
    knowledgeBase: [
      { title: "黄金交易新手课大纲", type: "课程资料", status: "ready" },
      { title: "风险提示与禁用话术", type: "合规规则", status: "ready" },
      { title: "价格方案与售后政策", type: "销售资料", status: "review" },
      { title: "历史直播切片素材", type: "内容素材", status: "missing" },
    ],
  },
  {
    id: "tenant-futures-club",
    name: "期货复盘训练营",
    workspace: "futures-review",
    owner: "销售主管 B",
    industryTemplate: "交易教学",
    planId: "basic_yearly",
    plan: "基础版",
    status: "active",
    renewalDate: "2026-07-20",
    defaultCommand: "帮我为交易复盘训练营设计短视频获客和社群转化流程",
    complianceProfile: "交易教学：只允许方法论、复盘和风险教育",
    featureOverrides: {
      video_factory: false,
      publish_center: false,
      telegram_connector: false,
    },
    usage: {
      contacts: 386,
      contactsLimit: 1200,
      aiRuns: 72,
      aiRunsLimit: 300,
      videoJobs: 20,
      videoJobsLimit: 20,
      seats: 2,
      seatsLimit: 3,
      storageMb: 118,
      storageLimitMb: 1024,
    },
    funnel: {
      leads: 386,
      addedPrivate: 118,
      groupJoined: 76,
      bookedTrial: 19,
      paidOrders: 4,
    },
    channels: [
      { name: "表单线索", status: "mock", description: "已用演示数据模拟导入" },
      { name: "企业微信", status: "pending", description: "待客户提供企微主体" },
      { name: "短信平台", status: "disabled", description: "基础版不开启短信" },
      { name: "OpenAI", status: "mock", description: "待配置项目 API Key" },
    ],
    knowledgeBase: [
      { title: "复盘训练营课程说明", type: "课程资料", status: "ready" },
      { title: "模拟盘训练说明", type: "教学资料", status: "ready" },
      { title: "成交问答 FAQ", type: "销售资料", status: "review" },
      { title: "客户成功案例库", type: "案例资料", status: "missing" },
    ],
  },
  {
    id: "tenant-finance-advisory",
    name: "稳策财商顾问",
    workspace: "finance-advisory",
    owner: "金融内容负责人 C",
    industryTemplate: "金融",
    planId: "enterprise_yearly",
    plan: "企业版",
    status: "active",
    renewalDate: "2026-09-30",
    defaultCommand: "帮我基于金融知识库生成一套不承诺收益的财商短视频获客流程",
    complianceProfile: "金融：禁止保本保息、具体投资建议、代客投资、收益承诺",
    usage: {
      contacts: 2480,
      contactsLimit: 10000,
      aiRuns: 680,
      aiRunsLimit: 3000,
      videoJobs: 58,
      videoJobsLimit: 240,
      seats: 9,
      seatsLimit: 20,
      storageMb: 1260,
      storageLimitMb: 8192,
    },
    funnel: {
      leads: 2480,
      addedPrivate: 742,
      groupJoined: 438,
      bookedTrial: 126,
      paidOrders: 31,
    },
    channels: [
      { name: "YouTube", status: "connected", description: "已授权官方上传接口演示状态" },
      { name: "TikTok", status: "pending", description: "待申请 Content Posting API 权限" },
      { name: "小红书", status: "disabled", description: "先生成素材包，人工发布" },
      { name: "Telegram", status: "connected", description: "用户主动联系 Bot 后可自动承接" },
    ],
    knowledgeBase: [
      { title: "家庭资产配置科普手册", type: "知识库", status: "ready" },
      { title: "金融合规禁用话术", type: "合规规则", status: "ready" },
      { title: "顾问咨询流程", type: "销售流程", status: "review" },
      { title: "产品资质材料", type: "资质证明", status: "missing" },
    ],
  },
  {
    id: "tenant-aesthetic-clinic",
    name: "曜美医美咨询",
    workspace: "aesthetic-clinic",
    owner: "医美运营负责人 D",
    industryTemplate: "医美",
    planId: "growth_yearly",
    plan: "增长版",
    status: "trial",
    renewalDate: "2026-08-18",
    defaultCommand: "帮我根据医美知识库生成合规的项目科普短视频和咨询承接流程",
    complianceProfile: "医美：禁止夸大效果、虚假案例、永久有效、无风险承诺",
    usage: {
      contacts: 920,
      contactsLimit: 3000,
      aiRuns: 186,
      aiRunsLimit: 1000,
      videoJobs: 26,
      videoJobsLimit: 80,
      seats: 5,
      seatsLimit: 8,
      storageMb: 860,
      storageLimitMb: 2048,
    },
    funnel: {
      leads: 920,
      addedPrivate: 286,
      groupJoined: 0,
      bookedTrial: 74,
      paidOrders: 12,
    },
    channels: [
      { name: "小红书", status: "disabled", description: "先生成笔记和视频素材包" },
      { name: "抖音", status: "pending", description: "待企业主体和行业资质审核" },
      { name: "视频号", status: "disabled", description: "先人工确认后发布" },
      { name: "企业微信", status: "pending", description: "待配置联系我二维码和员工标签" },
    ],
    knowledgeBase: [
      { title: "面诊流程说明", type: "服务流程", status: "ready" },
      { title: "术后护理手册", type: "知识库", status: "review" },
      { title: "医生资质材料", type: "资质证明", status: "ready" },
      { title: "案例授权库", type: "素材授权", status: "missing" },
    ],
  },
  {
    id: "tenant-tcm-clinic",
    name: "杏林中医调理馆",
    workspace: "tcm-clinic",
    owner: "门店负责人 E",
    industryTemplate: "中医",
    planId: "growth_yearly",
    plan: "增长版",
    status: "active",
    renewalDate: "2026-09-12",
    defaultCommand: "帮我根据中医知识库生成健康科普短视频和门店咨询转化流程",
    complianceProfile: "中医：禁止包治根治、替代就医、无证诊疗、自动开方",
    usage: {
      contacts: 1536,
      contactsLimit: 3000,
      aiRuns: 342,
      aiRunsLimit: 1000,
      videoJobs: 32,
      videoJobsLimit: 80,
      seats: 6,
      seatsLimit: 8,
      storageMb: 540,
      storageLimitMb: 2048,
    },
    funnel: {
      leads: 1536,
      addedPrivate: 512,
      groupJoined: 168,
      bookedTrial: 142,
      paidOrders: 36,
    },
    channels: [
      { name: "视频号", status: "disabled", description: "先生成素材包，人工发布" },
      { name: "快手", status: "pending", description: "待开放平台发布能力和客户授权" },
      { name: "抖音", status: "pending", description: "待企业主体和健康类内容审核" },
      { name: "企业微信", status: "pending", description: "待配置门店咨询二维码" },
    ],
    knowledgeBase: [
      { title: "节气养生内容库", type: "知识库", status: "ready" },
      { title: "门店咨询FAQ", type: "销售资料", status: "review" },
      { title: "健康科普免责声明", type: "合规规则", status: "ready" },
      { title: "医生坐诊排班", type: "运营资料", status: "missing" },
    ],
  },
];

export function getTenantById(id?: string) {
  return saasTenants.find((tenant) => tenant.id === id) ?? saasTenants[0];
}

export function findTenantById(id?: string) {
  return saasTenants.find((tenant) => tenant.id === id);
}

export function usagePercent(value: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((value / limit) * 100));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export const saasReadiness = [
  {
    title: "多租户 Workspace",
    status: "已做演示层",
    description: "不同客户可切换独立工作区，后续接数据库实现真实隔离。",
  },
  {
    title: "套餐与授权",
    status: "已接授权模型",
    description: "已定义试用版/基础版/增长版/企业版、价格、到期、席位、功能开关和接口拦截。",
  },
  {
    title: "用量统计",
    status: "已接套餐额度",
    description: "已按套餐展示线索、AI执行、视频任务、席位和存储额度。",
  },
  {
    title: "渠道接入",
    status: "待服务器",
    description: "企业微信、微信客服、Telegram、YouTube、TikTok 等需要服务器、官方授权和回调。",
  },
  {
    title: "行业模板",
    status: "已做演示层",
    description: "已加入交易教学、金融、医美、中医的内容和合规模板。",
  },
  {
    title: "视频工厂",
    status: "已接额度拦截",
    description: "已展示视频切片、尺寸适配、字幕、发布计划，并在上传接口检查视频任务额度。",
  },
  {
    title: "私域会话中心",
    status: "已做演示层",
    description: "已展示评论/私信进入线索池、AI回复建议和转人工规则。",
  },
  {
    title: "真实文件上传",
    status: "本地可用",
    description: "已支持知识库和视频文件上传到本地 .local-data，并生成任务记录。",
  },
  {
    title: "任务队列",
    status: "本地演示层",
    description: "已支持知识库解析、视频转码、字幕生成和合规审核任务入队。",
  },
  {
    title: "登录权限",
    status: "演示角色层",
    description: "已加入平台管理员、客户管理员、运营员工、只读观察员的权限演示。",
  },
  {
    title: "数据库表结构",
    status: "已出草案",
    description: "PostgreSQL schema 覆盖租户、用户、套餐、功能开关、知识库、视频、任务、发布和会话。",
  },
  {
    title: "数据持久化",
    status: "待数据库",
    description: "正式 SaaS 建议使用 PostgreSQL 存储客户、任务、日志和知识库。",
  },
  {
    title: "计费收款",
    status: "待确认",
    description: "后续根据你选择的支付/授权方式接入。",
  },
];
