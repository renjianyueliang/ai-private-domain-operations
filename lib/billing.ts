import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canManagePlatform, type DemoUser } from "./auth";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";

export type BillingRecordKind = "contract" | "invoice" | "payment";
export type BillingRecordStatus = "draft" | "issued" | "paid" | "void";

export type BillingRecordInput = {
  tenantId: string;
  kind: BillingRecordKind;
  title: string;
  amountCny: number;
  status: BillingRecordStatus;
  dueDate?: string;
  note?: string;
};

export type BillingRecord = BillingRecordInput & {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type BillingSnapshot = {
  billingRecords: BillingRecord[];
};

function billingPath() {
  return path.join(process.cwd(), ".local-data", "billing.json");
}

async function readLocalBilling(): Promise<BillingSnapshot> {
  try {
    const raw = await readFile(billingPath(), "utf8");
    return { billingRecords: [], ...JSON.parse(raw) } as BillingSnapshot;
  } catch {
    return { billingRecords: [] };
  }
}

async function writeLocalBilling(snapshot: BillingSnapshot) {
  await mkdir(path.dirname(billingPath()), { recursive: true });
  await writeFile(billingPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function validateBillingInput(input: BillingRecordInput) {
  if (!input.tenantId.trim()) throw new Error("tenantId is required.");
  if (!input.title.trim()) throw new Error("标题不能为空。");
  if (!Number.isFinite(input.amountCny) || input.amountCny < 0) {
    throw new Error("金额必须是非负数字。");
  }
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new Error("到期日期格式不正确。");
  }
}

export async function listBillingRecords() {
  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      kind: BillingRecordKind;
      title: string;
      amount_cny: string | number;
      status: BillingRecordStatus;
      due_date: string | Date | null;
      note: string | null;
      created_by: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, tenant_id, kind, title, amount_cny, status, due_date,
              note, created_by, created_at, updated_at
         FROM app_billing_records
        ORDER BY created_at DESC
        LIMIT 200`,
    );

    return {
      storageMode: getStorageMode(),
      billingRecords: rows.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        kind: row.kind,
        title: row.title,
        amountCny: Number(row.amount_cny),
        status: row.status,
        dueDate: row.due_date ? isoString(row.due_date).slice(0, 10) : undefined,
        note: row.note ?? undefined,
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
        updatedAt: isoString(row.updated_at),
      })),
    };
  }

  return {
    storageMode: getStorageMode(),
    ...(await readLocalBilling()),
  };
}

export async function createBillingRecord(user: DemoUser, input: BillingRecordInput) {
  if (!canManagePlatform(user)) {
    throw new Error("只有平台管理员可以管理合同、发票和收款记录。");
  }

  validateBillingInput(input);

  const now = new Date().toISOString();
  const record: BillingRecord = {
    ...input,
    id: randomUUID(),
    createdBy: user.email,
    createdAt: now,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_billing_records (
        id, tenant_id, kind, title, amount_cny, status, due_date,
        note, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        record.id,
        record.tenantId,
        record.kind,
        record.title,
        record.amountCny,
        record.status,
        record.dueDate ?? null,
        record.note ?? null,
        record.createdBy,
        record.createdAt,
        record.updatedAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalBilling();
  snapshot.billingRecords.unshift(record);
  await writeLocalBilling(snapshot);
  return record;
}
