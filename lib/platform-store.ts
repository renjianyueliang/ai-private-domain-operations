import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canManagePlatform, type DemoUser } from "./auth";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";

export type TenantDraftInput = {
  company: string;
  industry: string;
  plan: string;
  renewalDate: string;
  seats: number;
};

export type TenantDraft = TenantDraftInput & {
  id: string;
  status: "draft_pending_setup";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type PlatformSnapshot = {
  tenantDrafts: TenantDraft[];
};

function platformPath() {
  return path.join(process.cwd(), ".local-data", "platform.json");
}

async function readLocalPlatformSnapshot(): Promise<PlatformSnapshot> {
  try {
    const raw = await readFile(platformPath(), "utf8");
    return { tenantDrafts: [], ...JSON.parse(raw) } as PlatformSnapshot;
  } catch {
    return { tenantDrafts: [] };
  }
}

async function writeLocalPlatformSnapshot(snapshot: PlatformSnapshot) {
  await mkdir(path.dirname(platformPath()), { recursive: true });
  await writeFile(platformPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function validateDraftInput(input: TenantDraftInput) {
  if (!input.company.trim()) throw new Error("客户名称不能为空。");
  if (!input.industry.trim()) throw new Error("行业模板不能为空。");
  if (!input.plan.trim()) throw new Error("套餐不能为空。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewalDate)) {
    throw new Error("到期日期格式不正确。");
  }
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 200) {
    throw new Error("席位必须是 1 到 200 之间的整数。");
  }
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

export async function listTenantDrafts() {
  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      company: string;
      industry: string;
      plan: string;
      renewal_date: string | Date;
      seats: number;
      status: TenantDraft["status"];
      created_by: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, company, industry, plan, renewal_date, seats, status,
              created_by, created_at, updated_at
         FROM app_tenant_drafts
        ORDER BY created_at DESC
        LIMIT 100`,
    );

    return {
      storageMode: getStorageMode(),
      tenantDrafts: rows.rows.map((row) => ({
        id: row.id,
        company: row.company,
        industry: row.industry,
        plan: row.plan,
        renewalDate: isoString(row.renewal_date).slice(0, 10),
        seats: row.seats,
        status: row.status,
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
        updatedAt: isoString(row.updated_at),
      })),
    };
  }

  return {
    storageMode: getStorageMode(),
    ...(await readLocalPlatformSnapshot()),
  };
}

export async function createTenantDraft(user: DemoUser, input: TenantDraftInput) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以创建客户工作区。");
  }

  validateDraftInput(input);

  const now = new Date().toISOString();
  const draft: TenantDraft = {
    ...input,
    company: input.company.trim(),
    industry: input.industry.trim(),
    plan: input.plan.trim(),
    id: randomUUID(),
    status: "draft_pending_setup",
    createdBy: user.email,
    createdAt: now,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_tenant_drafts (
        id, company, industry, plan, renewal_date, seats, status,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        draft.id,
        draft.company,
        draft.industry,
        draft.plan,
        draft.renewalDate,
        draft.seats,
        draft.status,
        draft.createdBy,
        draft.createdAt,
        draft.updatedAt,
      ],
    );
    return draft;
  }

  const snapshot = await readLocalPlatformSnapshot();
  snapshot.tenantDrafts.unshift(draft);
  await writeLocalPlatformSnapshot(snapshot);
  return draft;
}
