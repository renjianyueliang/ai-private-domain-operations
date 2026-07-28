import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  canAccessTenant,
  canManagePlatform,
  canWriteTenantData,
  type DemoUser,
} from "./auth";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";
import { featureLabels, getTenantEntitlement, type FeatureKey } from "./entitlements";
import { findTenantById, saasTenants } from "./saas";
import { getReplyRulesForTenant, type ReplyRule } from "./workspace-product";

export type FeatureMatrixRecord = {
  tenantId: string;
  features: Record<FeatureKey, boolean>;
  updatedBy: string;
  updatedAt: string;
};

export type RiskEventStatus = "open" | "reviewed";

export type RiskEvent = {
  id: string;
  tenantId: string;
  type: string;
  level: "low" | "medium" | "high";
  action: string;
  owner: string;
  status: RiskEventStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AcquisitionPlanInput = {
  tenantId: string;
  industry: string;
  product: string;
  customer: string;
  hook: string;
  dailyLeadTarget: number;
  riskMode: string;
  channels: string[];
};

export type AcquisitionPlanRecord = AcquisitionPlanInput & {
  id: string;
  createdBy: string;
  createdAt: string;
};

export type ReplyStrategyRecord = {
  id: string;
  tenantId: string;
  rules: ReplyRule[];
  testMessage?: string;
  updatedBy: string;
  updatedAt: string;
};

type ControlSnapshot = {
  featureMatrix: FeatureMatrixRecord[];
  riskEvents: RiskEvent[];
  acquisitionPlans: AcquisitionPlanRecord[];
  replyStrategies: ReplyStrategyRecord[];
};

const emptyControlSnapshot: ControlSnapshot = {
  featureMatrix: [],
  riskEvents: [],
  acquisitionPlans: [],
  replyStrategies: [],
};

function controlPath() {
  return path.join(process.cwd(), ".local-data", "control.json");
}

async function readLocalControl(): Promise<ControlSnapshot> {
  try {
    const raw = await readFile(controlPath(), "utf8");
    return { ...emptyControlSnapshot, ...JSON.parse(raw) } as ControlSnapshot;
  } catch {
    return { ...emptyControlSnapshot };
  }
}

async function writeLocalControl(snapshot: ControlSnapshot) {
  await mkdir(path.dirname(controlPath()), { recursive: true });
  await writeFile(controlPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseReplyRules(value: unknown): ReplyRule[] {
  if (Array.isArray(value)) return value as ReplyRule[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as ReplyRule[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function defaultFeatureRecord(tenantId: string): FeatureMatrixRecord {
  const tenant = findTenantById(tenantId) ?? saasTenants[0];
  const entitlement = getTenantEntitlement(tenant);
  const features = (Object.keys(featureLabels) as FeatureKey[]).reduce(
    (current, feature) => ({
      ...current,
      [feature]: entitlement.enabledFeatures.includes(feature),
    }),
    {} as Record<FeatureKey, boolean>,
  );

  return {
    tenantId,
    features,
    updatedBy: "system",
    updatedAt: new Date().toISOString(),
  };
}

function getSeedRiskEvents(): RiskEvent[] {
  const now = new Date();
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  return [
    {
      id: "audit-001",
      tenantId: "tenant-finance-advisory",
      type: "金融高风险回复",
      level: "high",
      action: "客户询问保本保息，AI 已阻断自动发送并转人工。",
      owner: "08 私域成交员工",
      status: "open",
      createdAt: at(18),
      updatedAt: at(18),
    },
    {
      id: "audit-002",
      tenantId: "tenant-aesthetic-clinic",
      type: "医美内容审核",
      level: "high",
      action: "脚本出现“一定有效”表达，合规员工已生成安全改写。",
      owner: "06 视频合规员工",
      status: "open",
      createdAt: at(32),
      updatedAt: at(32),
    },
    {
      id: "audit-003",
      tenantId: "tenant-gold-academy",
      type: "发布前确认",
      level: "medium",
      action: "YouTube Shorts 发布计划等待运营确认。",
      owner: "11 发布员工",
      status: "open",
      createdAt: at(50),
      updatedAt: at(50),
    },
    {
      id: "audit-004",
      tenantId: "tenant-tcm-clinic",
      type: "健康咨询边界",
      level: "high",
      action: "用户询问具体症状和用药，AI 已转门店人工。",
      owner: "08 私域成交员工",
      status: "open",
      createdAt: at(74),
      updatedAt: at(74),
    },
  ];
}

function mergeSeedRiskEvents(events: RiskEvent[]) {
  const byId = new Map<string, RiskEvent>();
  getSeedRiskEvents().forEach((event) => byId.set(event.id, event));
  events.forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function ensureTenant(tenantId: string) {
  const tenant = findTenantById(tenantId);
  if (!tenant) throw new Error("客户工作区不存在。");
  return tenant;
}

function validateFeaturePayload(features: Record<string, unknown>) {
  const normalized = {} as Record<FeatureKey, boolean>;

  for (const feature of Object.keys(featureLabels) as FeatureKey[]) {
    normalized[feature] = Boolean(features[feature]);
  }

  return normalized;
}

function validateAcquisitionPlan(input: AcquisitionPlanInput) {
  ensureTenant(input.tenantId);
  if (!input.industry.trim()) throw new Error("行业不能为空。");
  if (!input.product.trim()) throw new Error("产品/服务不能为空。");
  if (!input.customer.trim()) throw new Error("目标客户不能为空。");
  if (!input.hook.trim()) throw new Error("资料钩子不能为空。");
  if (!Number.isInteger(input.dailyLeadTarget) || input.dailyLeadTarget < 1 || input.dailyLeadTarget > 5000) {
    throw new Error("每日线索目标必须是 1 到 5000 之间的整数。");
  }
}

export async function listFeatureMatrix(user: DemoUser) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以查看功能授权矩阵。");
  }

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      tenant_id: string;
      feature_key: FeatureKey;
      enabled: boolean;
      updated_by: string;
      updated_at: Date | string;
    }>(
      `SELECT tenant_id, feature_key, enabled, updated_by, updated_at
         FROM app_tenant_feature_overrides`,
    );

    const records = new Map<string, FeatureMatrixRecord>();
    for (const tenant of saasTenants) {
      records.set(tenant.id, defaultFeatureRecord(tenant.id));
    }

    rows.rows.forEach((row) => {
      const current = records.get(row.tenant_id) ?? defaultFeatureRecord(row.tenant_id);
      current.features[row.feature_key] = row.enabled;
      current.updatedBy = row.updated_by;
      current.updatedAt = isoString(row.updated_at);
      records.set(row.tenant_id, current);
    });

    return { storageMode: getStorageMode(), featureMatrix: Array.from(records.values()) };
  }

  const snapshot = await readLocalControl();
  const records = new Map<string, FeatureMatrixRecord>();
  for (const tenant of saasTenants) {
    records.set(tenant.id, defaultFeatureRecord(tenant.id));
  }
  snapshot.featureMatrix.forEach((record) => records.set(record.tenantId, record));
  return { storageMode: getStorageMode(), featureMatrix: Array.from(records.values()) };
}

export async function saveTenantFeatureMatrix(
  user: DemoUser,
  tenantId: string,
  features: Record<string, unknown>,
) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以保存功能授权矩阵。");
  }
  ensureTenant(tenantId);

  const now = new Date().toISOString();
  const record: FeatureMatrixRecord = {
    tenantId,
    features: validateFeaturePayload(features),
    updatedBy: user.email,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await Promise.all(
      (Object.keys(record.features) as FeatureKey[]).map((feature) =>
        dbQuery(
          `INSERT INTO app_tenant_feature_overrides (
            tenant_id, feature_key, enabled, updated_by, updated_at
          ) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (tenant_id, feature_key)
          DO UPDATE SET enabled = EXCLUDED.enabled,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = EXCLUDED.updated_at`,
          [tenantId, feature, record.features[feature], record.updatedBy, record.updatedAt],
        ),
      ),
    );
    return record;
  }

  const snapshot = await readLocalControl();
  snapshot.featureMatrix = [
    record,
    ...snapshot.featureMatrix.filter((item) => item.tenantId !== tenantId),
  ];
  await writeLocalControl(snapshot);
  return record;
}

export async function listRiskEvents(user: DemoUser) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以查看审计事件。");
  }

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      type: string;
      level: RiskEvent["level"];
      action: string;
      owner: string;
      status: RiskEventStatus;
      reviewed_by: string | null;
      reviewed_at: Date | string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, tenant_id, type, level, action, owner, status,
              reviewed_by, reviewed_at, created_at, updated_at
         FROM app_risk_events
        ORDER BY created_at DESC
        LIMIT 300`,
    );

    return {
      storageMode: getStorageMode(),
      riskEvents: mergeSeedRiskEvents(
        rows.rows.map((row) => ({
          id: row.id,
          tenantId: row.tenant_id,
          type: row.type,
          level: row.level,
          action: row.action,
          owner: row.owner,
          status: row.status,
          reviewedBy: row.reviewed_by ?? undefined,
          reviewedAt: row.reviewed_at ? isoString(row.reviewed_at) : undefined,
          createdAt: isoString(row.created_at),
          updatedAt: isoString(row.updated_at),
        })),
      ),
    };
  }

  const snapshot = await readLocalControl();
  return {
    storageMode: getStorageMode(),
    riskEvents: mergeSeedRiskEvents(snapshot.riskEvents),
  };
}

export async function setRiskEventReviewed(
  user: DemoUser,
  eventId: string,
  reviewed: boolean,
) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以复核审计事件。");
  }

  const now = new Date().toISOString();
  const allEvents = mergeSeedRiskEvents(
    isPostgresConfigured() ? (await listRiskEvents(user)).riskEvents : (await readLocalControl()).riskEvents,
  );
  const existing = allEvents.find((event) => event.id === eventId);
  if (!existing) throw new Error("审计事件不存在。");

  const nextEvent: RiskEvent = {
    ...existing,
    status: reviewed ? "reviewed" : "open",
    reviewedBy: reviewed ? user.email : undefined,
    reviewedAt: reviewed ? now : undefined,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_risk_events (
        id, tenant_id, type, level, action, owner, status,
        reviewed_by, reviewed_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id)
      DO UPDATE SET status = EXCLUDED.status,
                    reviewed_by = EXCLUDED.reviewed_by,
                    reviewed_at = EXCLUDED.reviewed_at,
                    updated_at = EXCLUDED.updated_at`,
      [
        nextEvent.id,
        nextEvent.tenantId,
        nextEvent.type,
        nextEvent.level,
        nextEvent.action,
        nextEvent.owner,
        nextEvent.status,
        nextEvent.reviewedBy ?? null,
        nextEvent.reviewedAt ?? null,
        nextEvent.createdAt,
        nextEvent.updatedAt,
      ],
    );
    return nextEvent;
  }

  const snapshot = await readLocalControl();
  snapshot.riskEvents = [
    nextEvent,
    ...snapshot.riskEvents.filter((event) => event.id !== nextEvent.id),
  ];
  await writeLocalControl(snapshot);
  return nextEvent;
}

export async function listAcquisitionPlans(tenantId: string, user: DemoUser) {
  ensureTenant(tenantId);
  if (!canAccessTenant(user, tenantId)) {
    throw new Error("没有权限查看该客户工作区。");
  }

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      industry: string;
      product: string;
      customer_profile: string;
      hook: string;
      daily_lead_target: number;
      risk_mode: string;
      channels: unknown;
      created_by: string;
      created_at: Date | string;
    }>(
      `SELECT id, tenant_id, industry, product, customer_profile, hook,
              daily_lead_target, risk_mode, channels, created_by, created_at
         FROM app_acquisition_plans
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [tenantId],
    );

    return {
      storageMode: getStorageMode(),
      acquisitionPlans: rows.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        industry: row.industry,
        product: row.product,
        customer: row.customer_profile,
        hook: row.hook,
        dailyLeadTarget: row.daily_lead_target,
        riskMode: row.risk_mode,
        channels: parseJsonArray(row.channels),
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
      })),
    };
  }

  const snapshot = await readLocalControl();
  return {
    storageMode: getStorageMode(),
    acquisitionPlans: snapshot.acquisitionPlans
      .filter((plan) => plan.tenantId === tenantId)
      .slice(0, 50),
  };
}

export async function createAcquisitionPlan(user: DemoUser, input: AcquisitionPlanInput) {
  validateAcquisitionPlan(input);
  if (!canWriteTenantData(user, input.tenantId)) {
    throw new Error("当前角色没有保存获客计划权限。");
  }

  const now = new Date().toISOString();
  const record: AcquisitionPlanRecord = {
    ...input,
    industry: input.industry.trim(),
    product: input.product.trim(),
    customer: input.customer.trim(),
    hook: input.hook.trim(),
    channels: input.channels.map(String).filter(Boolean),
    id: randomUUID(),
    createdBy: user.email,
    createdAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_acquisition_plans (
        id, tenant_id, industry, product, customer_profile, hook,
        daily_lead_target, risk_mode, channels, created_by, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [
        record.id,
        record.tenantId,
        record.industry,
        record.product,
        record.customer,
        record.hook,
        record.dailyLeadTarget,
        record.riskMode,
        JSON.stringify(record.channels),
        record.createdBy,
        record.createdAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalControl();
  snapshot.acquisitionPlans.unshift(record);
  await writeLocalControl(snapshot);
  return record;
}

export async function getLatestReplyStrategy(tenantId: string, user: DemoUser) {
  ensureTenant(tenantId);
  if (!canAccessTenant(user, tenantId)) {
    throw new Error("没有权限查看该客户工作区。");
  }

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      rules: unknown;
      test_message: string | null;
      updated_by: string;
      updated_at: Date | string;
    }>(
      `SELECT id, tenant_id, rules, test_message, updated_by, updated_at
         FROM app_reply_strategy_snapshots
        WHERE tenant_id = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [tenantId],
    );

    const record = rows.rows[0];
    return {
      storageMode: getStorageMode(),
      replyStrategy: record
        ? {
            id: record.id,
            tenantId: record.tenant_id,
            rules: parseReplyRules(record.rules),
            testMessage: record.test_message ?? undefined,
            updatedBy: record.updated_by,
            updatedAt: isoString(record.updated_at),
          }
        : {
            id: "default",
            tenantId,
            rules: getReplyRulesForTenant(tenantId),
            updatedBy: "system",
            updatedAt: new Date().toISOString(),
          },
    };
  }

  const snapshot = await readLocalControl();
  return {
    storageMode: getStorageMode(),
    replyStrategy:
      snapshot.replyStrategies.find((strategy) => strategy.tenantId === tenantId) ?? {
        id: "default",
        tenantId,
        rules: getReplyRulesForTenant(tenantId),
        updatedBy: "system",
        updatedAt: new Date().toISOString(),
      },
  };
}

export async function saveReplyStrategy(
  user: DemoUser,
  tenantId: string,
  rules: ReplyRule[],
  testMessage?: string,
) {
  ensureTenant(tenantId);
  if (!canWriteTenantData(user, tenantId)) {
    throw new Error("当前角色没有保存回复策略权限。");
  }

  const now = new Date().toISOString();
  const record: ReplyStrategyRecord = {
    id: randomUUID(),
    tenantId,
    rules,
    testMessage,
    updatedBy: user.email,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_reply_strategy_snapshots (
        id, tenant_id, rules, test_message, updated_by, updated_at
      ) VALUES ($1,$2,$3::jsonb,$4,$5,$6)`,
      [
        record.id,
        record.tenantId,
        JSON.stringify(record.rules),
        record.testMessage ?? null,
        record.updatedBy,
        record.updatedAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalControl();
  snapshot.replyStrategies = [
    record,
    ...snapshot.replyStrategies.filter((strategy) => strategy.tenantId !== tenantId),
  ];
  await writeLocalControl(snapshot);
  return record;
}
