export type AgentId =
  | "brain"
  | "creator"
  | "leadGen"
  | "publicToPrivate"
  | "ipResearch"
  | "accountOps"
  | "accountCare"
  | "advisor"
  | "sales"
  | "compliance"
  | "analytics";

export type Agent = {
  id: AgentId;
  index: string;
  name: string;
  shortName: string;
  role: string;
  icon: string;
  tone: string;
  allowedTools: string[];
  riskLevel: "low" | "medium" | "high";
  requiresHumanApproval: boolean;
};

export const agents: Agent[] = [
  {
    id: "brain",
    index: "01",
    name: "AI大脑",
    shortName: "任务理解",
    role: "理解指挥官目标，拆解可执行的行业私域运营流程。",
    icon: "🧠",
    tone: "战略拆解、目标定义、流程编排",
    allowedTools: ["任务拆解", "客户画像", "流程设计"],
    riskLevel: "medium",
    requiresHumanApproval: false,
  },
  {
    id: "creator",
    index: "02",
    name: "AI创作",
    shortName: "内容生产",
    role: "生成短视频脚本、图文选题、直播预热内容和产品教育素材。",
    icon: "✍️",
    tone: "内容选题、脚本、素材清单",
    allowedTools: ["脚本生成", "标题生成", "内容日历"],
    riskLevel: "medium",
    requiresHumanApproval: true,
  },
  {
    id: "leadGen",
    index: "03",
    name: "AI获客",
    shortName: "获客路径",
    role: "设计线索来源、评论区引流、表单承接和渠道触点。",
    icon: "🎯",
    tone: "渠道计划、线索评分、触点设计",
    allowedTools: ["渠道规划", "线索评分", "表单设计"],
    riskLevel: "medium",
    requiresHumanApproval: false,
  },
  {
    id: "publicToPrivate",
    index: "04",
    name: "公转私",
    shortName: "引流承接",
    role: "把公域互动转成企微、社群、直播预约或资料领取。",
    icon: "🔁",
    tone: "评论回复、私信草稿、入群引导",
    allowedTools: ["私信草稿", "入群路径", "资料包设计"],
    riskLevel: "high",
    requiresHumanApproval: true,
  },
  {
    id: "ipResearch",
    index: "05",
    name: "IP拆解",
    shortName: "同行分析",
    role: "拆解当前行业同行 IP 的内容结构、表达方式和转化路径。",
    icon: "🧩",
    tone: "账号定位、内容结构、差异化策略",
    allowedTools: ["竞品拆解", "选题归类", "定位建议"],
    riskLevel: "low",
    requiresHumanApproval: false,
  },
  {
    id: "accountOps",
    index: "06",
    name: "账号运营",
    shortName: "发布计划",
    role: "安排账号矩阵发布节奏、素材复用、互动节奏和账号任务。",
    icon: "📅",
    tone: "排期、矩阵协同、账号节奏",
    allowedTools: ["发布计划", "矩阵排期", "互动清单"],
    riskLevel: "medium",
    requiresHumanApproval: false,
  },
  {
    id: "accountCare",
    index: "07",
    name: "养号管理",
    shortName: "账号健康",
    role: "管理账号健康、频率、互动比例和异常提醒。",
    icon: "🛡️",
    tone: "账号安全、节奏控制、异常提示",
    allowedTools: ["健康检查", "频率建议", "异常提醒"],
    riskLevel: "low",
    requiresHumanApproval: false,
  },
  {
    id: "advisor",
    index: "08",
    name: "AI锦囊",
    shortName: "下一步建议",
    role: "给运营和销售人员生成下一步动作建议。",
    icon: "💡",
    tone: "优先级、动作建议、风险提示",
    allowedTools: ["行动建议", "跟进提醒", "优先级排序"],
    riskLevel: "medium",
    requiresHumanApproval: false,
  },
  {
    id: "sales",
    index: "09",
    name: "AI成交",
    shortName: "成交辅助",
    role: "生成产品介绍、异议处理、咨询邀约和成交跟进话术。",
    icon: "🏆",
    tone: "产品价值、异议处理、成交辅助",
    allowedTools: ["销售话术", "异议处理", "咨询邀约"],
    riskLevel: "high",
    requiresHumanApproval: true,
  },
  {
    id: "compliance",
    index: "10",
    name: "合规风控",
    shortName: "风险审核",
    role: "根据当前行业规则检查承诺、诊疗、价格和对外触达风险。",
    icon: "⚖️",
    tone: "合规审核、风险等级、修改建议",
    allowedTools: ["敏感词检测", "风险分级", "合规改写"],
    riskLevel: "high",
    requiresHumanApproval: true,
  },
  {
    id: "analytics",
    index: "11",
    name: "数据复盘",
    shortName: "指标反馈",
    role: "生成线索、私域、预约、订单与归因收入的运营日报和优化建议。",
    icon: "📊",
    tone: "数据指标、漏斗复盘、优化策略",
    allowedTools: ["漏斗分析", "日报生成", "策略优化"],
    riskLevel: "low",
    requiresHumanApproval: false,
  },
];

export const agentById = Object.fromEntries(
  agents.map((agent) => [agent.id, agent]),
) as Record<AgentId, Agent>;
