import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const plans = [
  ["trial", "试用版", 0, "用于客户体验核心流程，保留人工发布和有限上传额度。", "售前演示、单门店试跑、客户试用", 2, 500, 120, 10, 512, 1],
  ["basic_yearly", "基础版", 10000, "面向轻量客户，重点解决内容生产、素材包、基础私域承接。", "个人 IP、小团队、单行业单账号运营", 3, 1200, 300, 20, 1024, 1],
  ["growth_yearly", "增长版", 30000, "面向需要持续获客的客户，开放视频工厂、团队协作和部分官方渠道。", "教育机构、诊所门店、财商团队、中医馆", 8, 3000, 1000, 80, 2048, 1],
  ["enterprise_yearly", "企业版", 80000, "面向多账号、多行业、多团队客户，开放全部能力并支持私有化/专属部署。", "集团客户、多门店、多品牌、多国家渠道", 20, 10000, 3000, 240, 8192, null],
];

const featureLabels = {
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

const planFeatures = {
  trial: ["knowledge_upload", "content_factory", "manual_asset_pack", "advanced_compliance", "analytics_dashboard"],
  basic_yearly: ["knowledge_upload", "content_factory", "manual_asset_pack", "conversation_center", "advanced_compliance", "analytics_dashboard"],
  growth_yearly: ["knowledge_upload", "content_factory", "video_factory", "publish_center", "conversation_center", "wecom_connector", "wechat_service_connector", "telegram_connector", "manual_asset_pack", "advanced_compliance", "team_members", "analytics_dashboard"],
  enterprise_yearly: Object.keys(featureLabels),
};

const tenants = [
  ["gold-academy", "金石交易学院", "运营负责人 A", "active", "增长版", "growth_yearly", "2026-08-31"],
  ["futures-review", "期货复盘训练营", "销售主管 B", "active", "基础版", "basic_yearly", "2026-07-20"],
  ["finance-advisory", "稳策财商顾问", "金融内容负责人 C", "active", "企业版", "enterprise_yearly", "2026-09-30"],
  ["aesthetic-clinic", "曜美医美咨询", "医美运营负责人 D", "trial", "增长版", "growth_yearly", "2026-08-18"],
  ["tcm-clinic", "杏林中医调理馆", "门店负责人 E", "active", "增长版", "growth_yearly", "2026-09-12"],
];

try {
  for (const plan of plans) {
    await pool.query(
      `INSERT INTO plans (
        code, name, annual_price_cny, description, recommended_for,
        seats_limit, contacts_limit, ai_runs_limit, video_jobs_limit,
        storage_limit_mb, industry_limit, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        annual_price_cny = EXCLUDED.annual_price_cny,
        description = EXCLUDED.description,
        recommended_for = EXCLUDED.recommended_for,
        seats_limit = EXCLUDED.seats_limit,
        contacts_limit = EXCLUDED.contacts_limit,
        ai_runs_limit = EXCLUDED.ai_runs_limit,
        video_jobs_limit = EXCLUDED.video_jobs_limit,
        storage_limit_mb = EXCLUDED.storage_limit_mb,
        industry_limit = EXCLUDED.industry_limit,
        updated_at = now()`,
      plan,
    );
  }

  for (const [planCode, features] of Object.entries(planFeatures)) {
    for (const feature of features) {
      await pool.query(
        `INSERT INTO plan_features (plan_code, feature_key, feature_label, enabled)
         VALUES ($1,$2,$3,true)
         ON CONFLICT (plan_code, feature_key) DO UPDATE SET
           feature_label = EXCLUDED.feature_label,
           enabled = true`,
        [planCode, feature, featureLabels[feature]],
      );
    }
  }

  for (const tenant of tenants) {
    await pool.query(
      `INSERT INTO tenants (slug, name, owner_name, status, plan_name, plan_code, renewal_date, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         owner_name = EXCLUDED.owner_name,
         status = EXCLUDED.status,
         plan_name = EXCLUDED.plan_name,
         plan_code = EXCLUDED.plan_code,
         renewal_date = EXCLUDED.renewal_date,
         updated_at = now()`,
      tenant,
    );
  }

  console.log(JSON.stringify({ seeded: true, plans: plans.length, tenants: tenants.length }, null, 2));
} finally {
  await pool.end();
}
