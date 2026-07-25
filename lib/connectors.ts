export type ConnectorId =
  | "telegram"
  | "wecom_app"
  | "wechat_kf"
  | "youtube"
  | "tiktok"
  | "douyin"
  | "kuaishou"
  | "xiaohongshu"
  | "wechat_channels"
  | "asset_pack";

export type ConnectorStatus = "ready" | "needs_credentials" | "manual_only" | "not_supported";

export type ConnectorDefinition = {
  id: ConnectorId;
  name: string;
  category: "private_domain" | "video_publish" | "manual_distribution";
  status: ConnectorStatus;
  automationLevel: "official_api" | "official_webhook" | "asset_pack" | "blocked";
  requiredEnv: string[];
  missingEnv: string[];
  note: string;
};

function missingEnv(keys: string[]) {
  return keys.filter((key) => !process.env[key]?.trim());
}

function officialConnector(
  id: ConnectorId,
  name: string,
  category: ConnectorDefinition["category"],
  automationLevel: ConnectorDefinition["automationLevel"],
  requiredEnv: string[],
  note: string,
): ConnectorDefinition {
  const missing = missingEnv(requiredEnv);
  return {
    id,
    name,
    category,
    automationLevel,
    requiredEnv,
    missingEnv: missing,
    status: missing.length === 0 ? "ready" : "needs_credentials",
    note,
  };
}

export function getConnectorDefinitions(): ConnectorDefinition[] {
  return [
    officialConnector(
      "telegram",
      "Telegram Bot",
      "private_domain",
      "official_webhook",
      ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
      "用户主动联系 Bot 或群内消息可进入会话中心。",
    ),
    officialConnector(
      "wecom_app",
      "企业微信应用",
      "private_domain",
      "official_webhook",
      ["WECOM_CORP_ID", "WECOM_AGENT_ID", "WECOM_SECRET", "WECOM_TOKEN"],
      "使用企业微信官方应用、客户联系和回调能力。",
    ),
    officialConnector(
      "wechat_kf",
      "微信客服 / 公众号客服",
      "private_domain",
      "official_webhook",
      ["WECHAT_KF_CORP_ID", "WECHAT_KF_SECRET", "WECHAT_KF_TOKEN"],
      "承接客户主动咨询，不控制个人微信外挂。",
    ),
    officialConnector(
      "youtube",
      "YouTube",
      "video_publish",
      "official_api",
      ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"],
      "客户 OAuth 授权后发布视频，发布前保留审核。",
    ),
    officialConnector(
      "tiktok",
      "TikTok",
      "video_publish",
      "official_api",
      ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
      "需要 TikTok Content Posting API 权限和客户授权。",
    ),
    {
      id: "douyin",
      name: "抖音",
      category: "manual_distribution",
      automationLevel: "asset_pack",
      requiredEnv: [],
      missingEnv: [],
      status: "manual_only",
      note: "无官方发布权限前只生成素材包、标题、封面、标签和人工发布清单。",
    },
    {
      id: "kuaishou",
      name: "快手",
      category: "manual_distribution",
      automationLevel: "asset_pack",
      requiredEnv: [],
      missingEnv: [],
      status: "manual_only",
      note: "根据开放平台权限逐步自动化；默认人工确认发布。",
    },
    {
      id: "xiaohongshu",
      name: "小红书",
      category: "manual_distribution",
      automationLevel: "asset_pack",
      requiredEnv: [],
      missingEnv: [],
      status: "manual_only",
      note: "当前以笔记包、视频素材包和人工审核为主。",
    },
    {
      id: "wechat_channels",
      name: "微信视频号",
      category: "manual_distribution",
      automationLevel: "asset_pack",
      requiredEnv: [],
      missingEnv: [],
      status: "manual_only",
      note: "优先生成素材包和发布清单，不做模拟点击。",
    },
    {
      id: "asset_pack",
      name: "素材包导出",
      category: "manual_distribution",
      automationLevel: "asset_pack",
      requiredEnv: [],
      missingEnv: [],
      status: "ready",
      note: "始终可用，用于受限平台人工发布。",
    },
  ];
}

export function summarizeConnectorStatus() {
  const connectors = getConnectorDefinitions();
  return {
    total: connectors.length,
    ready: connectors.filter((connector) => connector.status === "ready").length,
    needsCredentials: connectors.filter((connector) => connector.status === "needs_credentials").length,
    manualOnly: connectors.filter((connector) => connector.status === "manual_only").length,
    blocked: connectors.filter((connector) => connector.status === "not_supported").length,
    connectors,
  };
}
