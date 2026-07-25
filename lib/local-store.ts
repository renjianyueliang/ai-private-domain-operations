import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canAccessTenant, canWriteTenantData, DemoUser } from "./auth";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";
import { saveObject } from "./object-storage";
import { enqueueWorkerJob } from "./queue-driver";
import { findTenantById } from "./saas";

export type UploadKind = "knowledge" | "video";

export type StoredUpload = {
  id: string;
  tenantId: string;
  kind: UploadKind;
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  size: number;
  status: "uploaded" | "queued" | "processed" | "blocked";
  uploadedBy: string;
  createdAt: string;
};

export type QueueJobKind =
  | "knowledge_ingest"
  | "video_transcode"
  | "subtitle_generation"
  | "compliance_review";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type QueueJob = {
  id: string;
  tenantId: string;
  uploadId?: string;
  kind: QueueJobKind;
  title: string;
  status: "queued" | "running" | "needs_review" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  payload: Record<string, JsonValue>;
  logs: string[];
};

export type AuditLog = {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  targetId?: string;
  createdAt: string;
};

export type LocalSnapshot = {
  uploads: StoredUpload[];
  jobs: QueueJob[];
  auditLogs: AuditLog[];
};

const emptySnapshot: LocalSnapshot = {
  uploads: [],
  jobs: [],
  auditLogs: [],
};

function cloneEmptySnapshot(): LocalSnapshot {
  return {
    uploads: [],
    jobs: [],
    auditLogs: [],
  };
}

function localDataRoot() {
  return path.join(process.cwd(), ".local-data");
}

function recordsPath() {
  return path.join(localDataRoot(), "records.json");
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

function parsePayload(value: unknown): QueueJob["payload"] {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as QueueJob["payload"];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as QueueJob["payload"];
      }
    } catch {
      return {};
    }
  }

  return {};
}

async function readPostgresSnapshot(): Promise<LocalSnapshot> {
  const [uploadRows, jobRows, auditRows] = await Promise.all([
    dbQuery<{
      id: string;
      tenant_id: string;
      kind: UploadKind;
      original_name: string;
      stored_name: string;
      relative_path: string;
      mime_type: string;
      size_bytes: string | number;
      status: StoredUpload["status"];
      uploaded_by: string;
      created_at: Date | string;
    }>(
      `SELECT id, tenant_id, kind, original_name, stored_name, relative_path,
              mime_type, size_bytes, status, uploaded_by, created_at
         FROM app_uploads
        ORDER BY created_at DESC
        LIMIT 500`,
    ),
    dbQuery<{
      id: string;
      tenant_id: string;
      upload_id: string | null;
      kind: QueueJobKind;
      title: string;
      status: QueueJob["status"];
      created_at: Date | string;
      updated_at: Date | string;
      created_by: string;
      payload: unknown;
      logs: unknown;
    }>(
      `SELECT id, tenant_id, upload_id, kind, title, status, created_at,
              updated_at, created_by, payload, logs
         FROM app_queue_jobs
        ORDER BY created_at DESC
        LIMIT 500`,
    ),
    dbQuery<{
      id: string;
      tenant_id: string;
      actor: string;
      action: string;
      target_id: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, tenant_id, actor, action, target_id, created_at
         FROM app_audit_logs
        ORDER BY created_at DESC
        LIMIT 500`,
    ),
  ]);

  return {
    uploads: uploadRows.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      kind: row.kind,
      originalName: row.original_name,
      storedName: row.stored_name,
      relativePath: row.relative_path,
      mimeType: row.mime_type,
      size: Number(row.size_bytes),
      status: row.status,
      uploadedBy: row.uploaded_by,
      createdAt: isoString(row.created_at),
    })),
    jobs: jobRows.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      uploadId: row.upload_id ?? undefined,
      kind: row.kind,
      title: row.title,
      status: row.status,
      createdAt: isoString(row.created_at),
      updatedAt: isoString(row.updated_at),
      createdBy: row.created_by,
      payload: parsePayload(row.payload),
      logs: parseJsonArray(row.logs),
    })),
    auditLogs: auditRows.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      actor: row.actor,
      action: row.action,
      targetId: row.target_id ?? undefined,
      createdAt: isoString(row.created_at),
    })),
  };
}

function sanitizeName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^\w.-]+/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "upload";
}

async function ensureLocalDataRoot() {
  await mkdir(localDataRoot(), { recursive: true });
}

export async function readSnapshot(): Promise<LocalSnapshot> {
  if (isPostgresConfigured()) {
    return readPostgresSnapshot();
  }

  await ensureLocalDataRoot();

  try {
    const raw = await readFile(recordsPath(), "utf8");
    return { ...cloneEmptySnapshot(), ...JSON.parse(raw) } as LocalSnapshot;
  } catch {
    return cloneEmptySnapshot();
  }
}

async function writeSnapshot(snapshot: LocalSnapshot) {
  if (isPostgresConfigured()) {
    throw new Error("writeSnapshot is only available in local storage mode.");
  }

  await ensureLocalDataRoot();
  await writeFile(recordsPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

async function persistUploadWithAudit(upload: StoredUpload, auditLog: AuditLog) {
  if (isPostgresConfigured()) {
    await Promise.all([
      dbQuery(
        `INSERT INTO app_uploads (
          id, tenant_id, kind, original_name, stored_name, relative_path,
          mime_type, size_bytes, status, uploaded_by, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          upload.id,
          upload.tenantId,
          upload.kind,
          upload.originalName,
          upload.storedName,
          upload.relativePath,
          upload.mimeType,
          upload.size,
          upload.status,
          upload.uploadedBy,
          upload.createdAt,
        ],
      ),
      dbQuery(
        `INSERT INTO app_audit_logs (id, tenant_id, actor, action, target_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          auditLog.id,
          auditLog.tenantId,
          auditLog.actor,
          auditLog.action,
          auditLog.targetId ?? null,
          auditLog.createdAt,
        ],
      ),
    ]);
    return;
  }

  const snapshot = await readSnapshot();
  snapshot.uploads.unshift(upload);
  snapshot.auditLogs.push(auditLog);
  await writeSnapshot(snapshot);
}

async function persistJobWithAudit(job: QueueJob, auditLog: AuditLog) {
  if (isPostgresConfigured()) {
    await Promise.all([
      dbQuery(
        `INSERT INTO app_queue_jobs (
          id, tenant_id, upload_id, kind, title, status, created_at, updated_at,
          created_by, payload, logs
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
        [
          job.id,
          job.tenantId,
          job.uploadId ?? null,
          job.kind,
          job.title,
          job.status,
          job.createdAt,
          job.updatedAt,
          job.createdBy,
          JSON.stringify(job.payload),
          JSON.stringify(job.logs),
        ],
      ),
      dbQuery(
        `INSERT INTO app_audit_logs (id, tenant_id, actor, action, target_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          auditLog.id,
          auditLog.tenantId,
          auditLog.actor,
          auditLog.action,
          auditLog.targetId ?? null,
          auditLog.createdAt,
        ],
      ),
    ]);
    return;
  }

  const snapshot = await readSnapshot();
  snapshot.jobs.unshift(job);
  snapshot.auditLogs.push(auditLog);
  await writeSnapshot(snapshot);
}

export async function listTenantState(tenantId: string, user: DemoUser) {
  if (!findTenantById(tenantId)) {
    throw new Error("客户工作区不存在。");
  }

  if (!canAccessTenant(user, tenantId)) {
    throw new Error("没有权限查看该客户工作区。");
  }

  const snapshot = await readSnapshot();
  return {
    storageMode: getStorageMode(),
    uploads: snapshot.uploads.filter((upload) => upload.tenantId === tenantId),
    jobs: snapshot.jobs.filter((job) => job.tenantId === tenantId),
    auditLogs: snapshot.auditLogs
      .filter((log) => log.tenantId === tenantId)
      .slice(-20)
      .reverse(),
  };
}

export async function saveUpload(
  tenantId: string,
  kind: UploadKind,
  file: File,
  user: DemoUser,
) {
  if (!findTenantById(tenantId)) {
    throw new Error("客户工作区不存在。");
  }

  if (!canWriteTenantData(user, tenantId)) {
    throw new Error("当前角色没有上传权限。");
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const safeOriginal = sanitizeName(file.name);
  const storedName = `${id}-${safeOriginal}`;
  const relativePath = path.join("uploads", tenantId, kind, storedName);
  const storedObject = await saveObject(relativePath, file);

  const upload: StoredUpload = {
    id,
    tenantId,
    kind,
    originalName: file.name,
    storedName,
    relativePath: storedObject.relativePath,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    status: "queued",
    uploadedBy: user.email,
    createdAt: now,
  };

  await persistUploadWithAudit(upload, {
    id: randomUUID(),
    tenantId,
    actor: user.email,
    action: kind === "knowledge" ? "上传知识库文件" : "上传视频素材",
    targetId: upload.id,
    createdAt: now,
  });

  return upload;
}

export async function createJob(
  tenantId: string,
  kind: QueueJobKind,
  title: string,
  user: DemoUser,
  payload: QueueJob["payload"] = {},
  uploadId?: string,
) {
  if (!findTenantById(tenantId)) {
    throw new Error("客户工作区不存在。");
  }

  if (!canWriteTenantData(user, tenantId)) {
    throw new Error("当前角色没有创建任务权限。");
  }

  const now = new Date().toISOString();
  const job: QueueJob = {
    id: randomUUID(),
    tenantId,
    uploadId,
    kind,
    title,
    status: kind === "compliance_review" ? "needs_review" : "queued",
    createdAt: now,
    updatedAt: now,
    createdBy: user.email,
    payload,
    logs: [
      "任务已进入本地演示队列。",
      kind === "knowledge_ingest"
        ? "生产环境会解析文件、抽取文本、切分段落并写入向量索引。"
        : "生产环境会进入视频转码、字幕生成和多平台导出流水线。",
    ],
  };

  await persistJobWithAudit(job, {
    id: randomUUID(),
    tenantId,
    actor: user.email,
    action: `创建任务：${title}`,
    targetId: job.id,
    createdAt: now,
  });

  const queueResult = await enqueueWorkerJob({ tenantId, jobId: job.id });
  if (queueResult.enqueued) {
    await updateJob(tenantId, job.id, {
      logs: [...job.logs, `已进入 BullMQ 队列：${queueResult.jobId}`],
    });
  }

  return job;
}

export async function updateJob(
  tenantId: string,
  jobId: string,
  patch: Partial<Pick<QueueJob, "status" | "logs" | "payload">>,
) {
  const now = new Date().toISOString();

  if (isPostgresConfigured()) {
    const current = await dbQuery<{
      logs: unknown;
      payload: unknown;
    }>(
      `SELECT logs, payload FROM app_queue_jobs
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, jobId],
    );

    if (current.rowCount === 0) {
      throw new Error("任务不存在。");
    }

    const nextLogs = patch.logs ?? parseJsonArray(current.rows[0].logs);
    const nextPayload = patch.payload ?? parsePayload(current.rows[0].payload);

    await dbQuery(
      `UPDATE app_queue_jobs
          SET status = COALESCE($3, status),
              logs = $4::jsonb,
              payload = $5::jsonb,
              updated_at = $6
        WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        jobId,
        patch.status ?? null,
        JSON.stringify(nextLogs),
        JSON.stringify(nextPayload),
        now,
      ],
    );
    return;
  }

  const snapshot = await readSnapshot();
  const job = snapshot.jobs.find((item) => item.tenantId === tenantId && item.id === jobId);

  if (!job) {
    throw new Error("任务不存在。");
  }

  Object.assign(job, patch, { updatedAt: now });
  await writeSnapshot(snapshot);
}

export async function createVideoPipelineJobs(
  tenantId: string,
  upload: StoredUpload,
  user: DemoUser,
) {
  const basePayload = {
    uploadId: upload.id,
    fileName: upload.originalName,
    targetRatios: "9:16,16:9,1:1",
  };

  const transcode = await createJob(
    tenantId,
    "video_transcode",
    "生成多平台视频规格",
    user,
    basePayload,
    upload.id,
  );
  const subtitle = await createJob(
    tenantId,
    "subtitle_generation",
    "生成字幕和标题候选",
    user,
    basePayload,
    upload.id,
  );
  const review = await createJob(
    tenantId,
    "compliance_review",
    "发布前合规审核",
    user,
    basePayload,
    upload.id,
  );

  return [transcode, subtitle, review];
}
