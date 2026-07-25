import { findTenantById, type SaasTenant } from "./saas";

export type FeatureKey =
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
  | "analytics_dashboard";

export type PlanId = "trial" | "basic_yearly" | "growth_yearly" | "enterprise_yearly";

export type SubscriptionComputedStatus = "trial" | "active" | "expired" | "paused";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceText: string;
  annualPriceCny: number;
  description: string;
  recommendedFor: string;
  seatsLimit: number;
  contactsLimit: number;
  aiRunsLimit: number;
  videoJobsLimit: number;
  storageLimitMb: number;
  industryLimit: number | "unlimited";
  includedFeatures: FeatureKey[];
};

export const featureLabels: Record<FeatureKey, string> = {
  knowledge_upload: "知识库上传",
  content_factory: "AI 内容工厂",
  video_factory: "视频工厂",
  publish_center: "多平台发布中心",
  conversation_center: "私域会话中心",
  wecom_connector: "企业微信承接",
  wechat_service_connector: "微信客服/公众号承接",
  telegram_connector: "Telegram Bot 承接",
  youtube_connector: "YouTube 发布",
  tiktok_connector: "TikTok 发布",
  manual_asset_pack: "平台素材包导出",
  advanced_compliance: "高级合规审核",
  team_members: "团队成员管理",
  analytics_dashboard: "数据看板",
};

export const featureDescriptions: Record<FeatureKey, string> = {
  knowledge_upload: "客户上传课程、话术、案例、资质、禁用词等资料，AI 只基于授权知识库生成内容。",
  content_factory: "生成选题、脚本、标题、封面文案、评论钩子和私信承接话术。",
  video_factory: "上传原始视频后生成剪辑、字幕、比例、时长和平台适配任务。",
  publish_center: "管理待发布素材、发布排期、平台状态和发布后结果回写。",
  conversation_center: "统一管理评论、私信、企微、Telegram 等会话，并按意向和风险分流。",
  wecom_connector: "通过企业微信官方能力承接客户，支持标签、员工分配和客户主动添加后的对话。",
  wechat_service_connector: "通过微信客服、公众号或小程序客服承接咨询，不控制个人微信外挂。",
  telegram_connector: "通过 Telegram Bot Webhook 承接主动咨询或群内消息。",
  youtube_connector: "通过 YouTube 官方接口上传和管理视频任务。",
  tiktok_connector: "通过 TikTok 官方内容发布能力；需要客户账号授权和平台审核。",
  manual_asset_pack: "对 API 受限平台生成标题、正文、封面、字幕和视频文件，由人工发布。",
  advanced_compliance: "按行业禁用表达、免责声明和人工审核规则检查内容、回复和发布任务。",
  team_members: "客户可创建管理员、运营、审核员、只读等成员角色。",
  analytics_dashboard: "查看线索、加私域、预约、成交、内容和渠道表现。",
};

export const planDefinitions: PlanDefinition[] = [
  {
    id: "trial",
    name: "试用版",
    priceText: "试用 / 7-14天",
    annualPriceCny: 0,
    description: "用于客户体验核心流程，保留人工发布和有限上传额度。",
    recommendedFor: "售前演示、单门店试跑、客户试用",
    seatsLimit: 2,
    contactsLimit: 500,
    aiRunsLimit: 120,
    videoJobsLimit: 10,
    storageLimitMb: 512,
    industryLimit: 1,
    includedFeatures: [
      "knowledge_upload",
      "content_factory",
      "manual_asset_pack",
      "advanced_compliance",
      "analytics_dashboard",
    ],
  },
  {
    id: "basic_yearly",
    name: "基础版",
    priceText: "¥10,000 / 年",
    annualPriceCny: 10000,
    description: "面向轻量客户，重点解决内容生产、素材包、基础私域承接。",
    recommendedFor: "个人 IP、小团队、单行业单账号运营",
    seatsLimit: 3,
    contactsLimit: 1200,
    aiRunsLimit: 300,
    videoJobsLimit: 20,
    storageLimitMb: 1024,
    industryLimit: 1,
    includedFeatures: [
      "knowledge_upload",
      "content_factory",
      "manual_asset_pack",
      "conversation_center",
      "advanced_compliance",
      "analytics_dashboard",
    ],
  },
  {
    id: "growth_yearly",
    name: "增长版",
    priceText: "¥30,000 / 年",
    annualPriceCny: 30000,
    description: "面向需要持续获客的客户，开放视频工厂、团队协作和部分官方渠道。",
    recommendedFor: "教育机构、诊所门店、财商团队、中医馆",
    seatsLimit: 8,
    contactsLimit: 3000,
    aiRunsLimit: 1000,
    videoJobsLimit: 80,
    storageLimitMb: 2048,
    industryLimit: 1,
    includedFeatures: [
      "knowledge_upload",
      "content_factory",
      "video_factory",
      "publish_center",
      "conversation_center",
      "wecom_connector",
      "wechat_service_connector",
      "telegram_connector",
      "manual_asset_pack",
      "advanced_compliance",
      "team_members",
      "analytics_dashboard",
    ],
  },
  {
    id: "enterprise_yearly",
    name: "企业版",
    priceText: "¥80,000+ / 年",
    annualPriceCny: 80000,
    description: "面向多账号、多行业、多团队客户，开放全部能力并支持私有化/专属部署。",
    recommendedFor: "集团客户、多门店、多品牌、多国家渠道",
    seatsLimit: 20,
    contactsLimit: 10000,
    aiRunsLimit: 3000,
    videoJobsLimit: 240,
    storageLimitMb: 8192,
    industryLimit: "unlimited",
    includedFeatures: [
      "knowledge_upload",
      "content_factory",
      "video_factory",
      "publish_center",
      "conversation_center",
      "wecom_connector",
      "wechat_service_connector",
      "telegram_connector",
      "youtube_connector",
      "tiktok_connector",
      "manual_asset_pack",
      "advanced_compliance",
      "team_members",
      "analytics_dashboard",
    ],
  },
];

export function getPlanById(id?: string) {
  return planDefinitions.find((plan) => plan.id === id) ?? planDefinitions[0];
}

function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function getSubscriptionStatus(
  tenant: SaasTenant,
  now = new Date(),
): SubscriptionComputedStatus {
  if (tenant.status === "paused") return "paused";
  if (tenant.renewalDate && tenant.renewalDate < todayIsoDate(now)) return "expired";
  if (tenant.status === "trial") return "trial";
  return "active";
}

export function getTenantEntitlement(tenant: SaasTenant) {
  const plan = getPlanById(tenant.planId);
  const subscriptionStatus = getSubscriptionStatus(tenant);
  const featureOverride = tenant.featureOverrides ?? {};
  const enabledFeatures = plan.includedFeatures.filter(
    (feature) => featureOverride[feature] !== false,
  );

  Object.entries(featureOverride).forEach(([feature, enabled]) => {
    if (enabled && !enabledFeatures.includes(feature as FeatureKey)) {
      enabledFeatures.push(feature as FeatureKey);
    }
  });

  const lockedFeatures = (Object.keys(featureLabels) as FeatureKey[]).filter(
    (feature) => !enabledFeatures.includes(feature),
  );

  return {
    plan,
    subscriptionStatus,
    isUsable: subscriptionStatus === "active" || subscriptionStatus === "trial",
    enabledFeatures,
    lockedFeatures,
  };
}

export function hasFeature(tenant: SaasTenant, feature: FeatureKey) {
  const entitlement = getTenantEntitlement(tenant);
  return entitlement.isUsable && entitlement.enabledFeatures.includes(feature);
}

export function getFeatureAccess(tenant: SaasTenant, feature: FeatureKey) {
  const entitlement = getTenantEntitlement(tenant);

  if (!entitlement.isUsable) {
    return {
      allowed: false,
      reason:
        entitlement.subscriptionStatus === "expired"
          ? "客户账号已到期，请在后台续费后继续使用。"
          : "客户账号已暂停，请在后台恢复后继续使用。",
    };
  }

  if (!entitlement.enabledFeatures.includes(feature)) {
    return {
      allowed: false,
      reason: `当前套餐未开通「${featureLabels[feature]}」。`,
    };
  }

  return { allowed: true, reason: "已开通" };
}

export function assertTenantFeature(tenantId: string, feature: FeatureKey) {
  const tenant = findTenantById(tenantId);

  if (!tenant) {
    throw new Error("客户工作区不存在。");
  }

  const access = getFeatureAccess(tenant, feature);

  if (!access.allowed) {
    throw new Error(access.reason);
  }

  return tenant;
}

export function assertStorageAvailable(tenant: SaasTenant, incomingBytes: number) {
  const incomingMb = incomingBytes / 1024 / 1024;
  const entitlement = getTenantEntitlement(tenant);
  const limitMb = entitlement.plan.storageLimitMb;
  const projected = tenant.usage.storageMb + incomingMb;

  if (projected > limitMb) {
    throw new Error(
      `资料存储额度不足：当前套餐限制 ${limitMb}MB，当前已用 ${tenant.usage.storageMb}MB。`,
    );
  }
}

export function assertVideoJobQuota(tenant: SaasTenant) {
  const entitlement = getTenantEntitlement(tenant);
  const limit = entitlement.plan.videoJobsLimit;

  if (tenant.usage.videoJobs >= limit) {
    throw new Error(`视频任务额度已用完：当前套餐限制 ${limit} 个视频任务。`);
  }
}

export function statusLabel(status: SubscriptionComputedStatus) {
  const labels: Record<SubscriptionComputedStatus, string> = {
    active: "有效",
    trial: "试用中",
    expired: "已到期",
    paused: "已暂停",
  };
  return labels[status];
}

export function statusTone(status: SubscriptionComputedStatus) {
  if (status === "active") return "ready";
  if (status === "trial") return "review";
  return "blocked";
}
