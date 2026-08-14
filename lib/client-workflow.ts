import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canAccessTenant, canWriteTenantData, type DemoUser } from "./auth";
import { getContentDraftById, type ContentDraftRecord } from "./content-drafts";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";
import { getLocalDataRoot } from "./local-data-path";
import { findTenantById } from "./saas";

export type WorkflowVideoStage = "脚本" | "剪辑" | "字幕" | "审核" | "待发布";

export type WorkflowVideoJob = {
  id: string;
  tenantId: string;
  contentDraftId?: string;
  title: string;
  sourceTitle: string;
  script: string;
  stage: WorkflowVideoStage;
  platformVersions: Array<{
    platform: string;
    ratio: string;
    duration: string;
    status: string;
  }>;
  safetyNotes: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishPlanRecord = {
  id: string;
  tenantId: string;
  videoJobId?: string;
  platform: string;
  mode: "官方API" | "素材包" | "人工确认";
  title: string;
  status: "素材包就绪" | "待审核" | "已排期";
  scheduledAt?: string;
  packageChecklist: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationActionKind = "confirm_send" | "transfer_human" | "add_followup";

export type ConversationActionEvent = {
  id: string;
  tenantId: string;
  conversationId: string;
  action: ConversationActionKind;
  note: string;
  status: "logged";
  createdBy: string;
  createdAt: string;
};

type ClientWorkflowSnapshot = {
  videoJobs: WorkflowVideoJob[];
  publishPlans: PublishPlanRecord[];
  conversationActions: ConversationActionEvent[];
};

const emptySnapshot: ClientWorkflowSnapshot = {
  videoJobs: [],
  publishPlans: [],
  conversationActions: [],
};

function workflowPath() {
  return path.join(getLocalDataRoot(), "client-workflow.json");
}

async function readLocalWorkflow(): Promise<ClientWorkflowSnapshot> {
  try {
    const raw = await readFile(workflowPath(), "utf8");
    return { ...emptySnapshot, ...JSON.parse(raw) } as ClientWorkflowSnapshot;
  } catch {
    return { ...emptySnapshot };
  }
}

async function writeLocalWorkflow(snapshot: ClientWorkflowSnapshot) {
  await mkdir(path.dirname(workflowPath()), { recursive: true });
  await writeFile(workflowPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function parsePlatformVersions(value: unknown): WorkflowVideoJob["platformVersions"] {
  if (Array.isArray(value)) return value as WorkflowVideoJob["platformVersions"];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as WorkflowVideoJob["platformVersions"]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseStringArray(value: unknown): string[] {
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

function ensureTenantAccess(user: DemoUser, tenantId: string, write = false) {
  if (!findTenantById(tenantId)) throw new Error("客户工作区不存在。");
  if (write ? !canWriteTenantData(user, tenantId) : !canAccessTenant(user, tenantId)) {
    throw new Error(write ? "当前角色没有操作该客户工作区权限。" : "没有权限查看该客户工作区。");
  }
}

function createVideoJobPayload(user: DemoUser, tenantId: string, draft: ContentDraftRecord) {
  const now = new Date().toISOString();
  const sourceTitle = draft.citations[0]?.sourceTitle ?? "行业默认知识库";
  const title = draft.title.replace("引流脚本", "短视频任务");
  return {
    id: randomUUID(),
    tenantId,
    contentDraftId: draft.id,
    title,
    sourceTitle,
    script: draft.body,
    stage: "脚本" as const,
    platformVersions: [
      { platform: "抖音 / TikTok / 快手", ratio: "9:16", duration: "30-60 秒", status: "生成素材包" },
      { platform: "小红书", ratio: "1:1 / 4:5", duration: "图文+短视频", status: "人工发布" },
      { platform: "YouTube Shorts / 视频号", ratio: "9:16", duration: "60 秒内", status: "待审核" },
    ],
    safetyNotes: [
      "发布前人工审核。",
      "不承诺收益、疗效、效果或确定性结果。",
      "评论/私信引导必须使用官方能力或人工确认。",
    ],
    createdBy: user.email,
    createdAt: now,
    updatedAt: now,
  } satisfies WorkflowVideoJob;
}

export async function listWorkflowVideoJobs(tenantId: string, user: DemoUser) {
  ensureTenantAccess(user, tenantId);

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      content_draft_id: string | null;
      title: string;
      source_title: string;
      script: string;
      stage: WorkflowVideoStage;
      platform_versions: unknown;
      safety_notes: unknown;
      created_by: string;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, tenant_id, content_draft_id, title, source_title, script,
              stage, platform_versions, safety_notes, created_by, created_at, updated_at
         FROM app_video_workflow_jobs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [tenantId],
    );

    return {
      storageMode: getStorageMode(),
      videoJobs: rows.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        contentDraftId: row.content_draft_id ?? undefined,
        title: row.title,
        sourceTitle: row.source_title,
        script: row.script,
        stage: row.stage,
        platformVersions: parsePlatformVersions(row.platform_versions),
        safetyNotes: parseStringArray(row.safety_notes),
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
        updatedAt: isoString(row.updated_at),
      })),
    };
  }

  const snapshot = await readLocalWorkflow();
  return {
    storageMode: getStorageMode(),
    videoJobs: snapshot.videoJobs.filter((job) => job.tenantId === tenantId).slice(0, 100),
  };
}

export async function createVideoJobFromDraft(
  user: DemoUser,
  tenantId: string,
  contentDraftId: string,
) {
  ensureTenantAccess(user, tenantId, true);
  const draft = await getContentDraftById(tenantId, contentDraftId, user);
  if (!draft) throw new Error("内容草稿不存在。");
  if (draft.status !== "approved" && draft.status !== "video_queued") {
    throw new Error("内容草稿必须先审核通过，才能进入视频任务。");
  }

  const existingJobs = await listWorkflowVideoJobs(tenantId, user);
  const existingJob = existingJobs.videoJobs.find((job) => job.contentDraftId === draft.id);
  if (existingJob) return existingJob;

  const record = createVideoJobPayload(user, tenantId, draft);

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_video_workflow_jobs (
        id, tenant_id, content_draft_id, title, source_title, script, stage,
        platform_versions, safety_notes, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12)`,
      [
        record.id,
        record.tenantId,
        record.contentDraftId ?? null,
        record.title,
        record.sourceTitle,
        record.script,
        record.stage,
        JSON.stringify(record.platformVersions),
        JSON.stringify(record.safetyNotes),
        record.createdBy,
        record.createdAt,
        record.updatedAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalWorkflow();
  snapshot.videoJobs.unshift(record);
  await writeLocalWorkflow(snapshot);
  return record;
}

export async function listPublishPlans(tenantId: string, user: DemoUser) {
  ensureTenantAccess(user, tenantId);

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      video_job_id: string | null;
      platform: string;
      mode: PublishPlanRecord["mode"];
      title: string;
      status: PublishPlanRecord["status"];
      scheduled_at: Date | string | null;
      package_checklist: unknown;
      created_by: string;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, tenant_id, video_job_id, platform, mode, title, status,
              scheduled_at, package_checklist, created_by, created_at, updated_at
         FROM app_publish_plan_records
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [tenantId],
    );

    return {
      storageMode: getStorageMode(),
      publishPlans: rows.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        videoJobId: row.video_job_id ?? undefined,
        platform: row.platform,
        mode: row.mode,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduled_at ? isoString(row.scheduled_at) : undefined,
        packageChecklist: parseStringArray(row.package_checklist),
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
        updatedAt: isoString(row.updated_at),
      })),
    };
  }

  const snapshot = await readLocalWorkflow();
  return {
    storageMode: getStorageMode(),
    publishPlans: snapshot.publishPlans.filter((plan) => plan.tenantId === tenantId).slice(0, 100),
  };
}

export async function createPublishPlanFromVideo(
  user: DemoUser,
  tenantId: string,
  videoJobId: string,
  platform = "短视频平台",
) {
  ensureTenantAccess(user, tenantId, true);
  const videos = await listWorkflowVideoJobs(tenantId, user);
  const video = videos.videoJobs.find((job) => job.id === videoJobId);
  if (!video) throw new Error("视频任务不存在。");

  const existingPlans = await listPublishPlans(tenantId, user);
  const existingPlan = existingPlans.publishPlans.find(
    (plan) => plan.videoJobId === video.id && plan.platform === platform,
  );
  if (existingPlan) return existingPlan;

  const isOfficial = /YouTube|Telegram|企业微信|微信客服/i.test(platform);
  const now = new Date().toISOString();
  const record: PublishPlanRecord = {
    id: randomUUID(),
    tenantId,
    videoJobId: video.id,
    platform,
    mode: isOfficial ? "官方API" : "素材包",
    title: video.title,
    status: isOfficial ? "待审核" : "素材包就绪",
    scheduledAt: isOfficial ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
    packageChecklist: [
      "视频标题",
      "封面标题",
      "字幕文件",
      "发布文案",
      "评论区资料引导",
      "合规免责声明",
      "人工确认记录",
    ],
    createdBy: user.email,
    createdAt: now,
    updatedAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_publish_plan_records (
        id, tenant_id, video_job_id, platform, mode, title, status,
        scheduled_at, package_checklist, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
      [
        record.id,
        record.tenantId,
        record.videoJobId ?? null,
        record.platform,
        record.mode,
        record.title,
        record.status,
        record.scheduledAt ?? null,
        JSON.stringify(record.packageChecklist),
        record.createdBy,
        record.createdAt,
        record.updatedAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalWorkflow();
  snapshot.publishPlans.unshift(record);
  await writeLocalWorkflow(snapshot);
  return record;
}

export async function listConversationActions(tenantId: string, user: DemoUser) {
  ensureTenantAccess(user, tenantId);

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      conversation_id: string;
      action: ConversationActionKind;
      note: string;
      status: "logged";
      created_by: string;
      created_at: Date | string;
    }>(
      `SELECT id, tenant_id, conversation_id, action, note, status, created_by, created_at
         FROM app_conversation_action_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [tenantId],
    );

    return {
      storageMode: getStorageMode(),
      conversationActions: rows.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        conversationId: row.conversation_id,
        action: row.action,
        note: row.note,
        status: row.status,
        createdBy: row.created_by,
        createdAt: isoString(row.created_at),
      })),
    };
  }

  const snapshot = await readLocalWorkflow();
  return {
    storageMode: getStorageMode(),
    conversationActions: snapshot.conversationActions
      .filter((event) => event.tenantId === tenantId)
      .slice(0, 200),
  };
}

export async function createConversationAction(
  user: DemoUser,
  tenantId: string,
  conversationId: string,
  action: ConversationActionKind,
  note: string,
) {
  ensureTenantAccess(user, tenantId, true);
  if (!conversationId.trim()) throw new Error("conversationId is required.");

  const existingActions = await listConversationActions(tenantId, user);
  const existingAction = existingActions.conversationActions.find(
    (event) => event.conversationId === conversationId && event.action === action,
  );
  if (existingAction) return existingAction;

  const now = new Date().toISOString();
  const record: ConversationActionEvent = {
    id: randomUUID(),
    tenantId,
    conversationId,
    action,
    note: note.trim() || "客户工作台记录了一次私域动作。",
    status: "logged",
    createdBy: user.email,
    createdAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_conversation_action_events (
        id, tenant_id, conversation_id, action, note, status, created_by, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        record.id,
        record.tenantId,
        record.conversationId,
        record.action,
        record.note,
        record.status,
        record.createdBy,
        record.createdAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalWorkflow();
  snapshot.conversationActions.unshift(record);
  await writeLocalWorkflow(snapshot);
  return record;
}
