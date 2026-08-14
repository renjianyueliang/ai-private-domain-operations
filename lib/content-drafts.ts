import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { canAccessTenant, canWriteTenantData, type DemoUser } from "./auth";
import { dbQuery, getStorageMode, isPostgresConfigured } from "./database";
import { getLocalDataRoot } from "./local-data-path";
import { listKnowledgeSources, type KnowledgeSource } from "./local-store";
import { findTenantById } from "./saas";

export type DraftCitation = {
  sourceTitle: string;
  chunkTitle: string;
  text: string;
};

export type ContentDraftInput = {
  tenantId: string;
  product: string;
  customer: string;
  hook: string;
  platform?: string;
};

export type ContentDraftStatus = "needs_review" | "approved" | "rejected" | "video_queued";

export type ContentDraftRecord = {
  id: string;
  tenantId: string;
  title: string;
  hook: string;
  body: string;
  citations: DraftCitation[];
  status: ContentDraftStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

type ContentDraftSnapshot = {
  contentDrafts: ContentDraftRecord[];
};

function contentPath() {
  return path.join(getLocalDataRoot(), "content-drafts.json");
}

async function readLocalContentDrafts(): Promise<ContentDraftSnapshot> {
  try {
    const raw = await readFile(contentPath(), "utf8");
    return { contentDrafts: [], ...JSON.parse(raw) } as ContentDraftSnapshot;
  } catch {
    return { contentDrafts: [] };
  }
}

async function writeLocalContentDrafts(snapshot: ContentDraftSnapshot) {
  await mkdir(path.dirname(contentPath()), { recursive: true });
  await writeFile(contentPath(), JSON.stringify(snapshot, null, 2), "utf8");
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function parseCitations(value: unknown): DraftCitation[] {
  if (Array.isArray(value)) return value as DraftCitation[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as DraftCitation[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStatus(status: unknown): ContentDraftStatus {
  return status === "approved" ||
    status === "rejected" ||
    status === "video_queued" ||
    status === "needs_review"
    ? status
    : "needs_review";
}

function mapContentDraftRow(row: {
  id: string;
  tenant_id: string;
  title: string;
  hook: string;
  body: string;
  citations: unknown;
  status: unknown;
  created_by: string;
  created_at: Date | string;
  reviewed_by?: string | null;
  reviewed_at?: Date | string | null;
  review_note?: string | null;
}): ContentDraftRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    hook: row.hook,
    body: row.body,
    citations: parseCitations(row.citations),
    status: normalizeStatus(row.status),
    createdBy: row.created_by,
    createdAt: isoString(row.created_at),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? isoString(row.reviewed_at) : undefined,
    reviewNote: row.review_note ?? undefined,
  };
}

function validateInput(input: ContentDraftInput) {
  if (!findTenantById(input.tenantId)) throw new Error("客户工作区不存在。");
  if (!input.product.trim()) throw new Error("产品/服务不能为空。");
  if (!input.customer.trim()) throw new Error("目标客户不能为空。");
  if (!input.hook.trim()) throw new Error("资料钩子不能为空。");
}

function pickCitations(sources: KnowledgeSource[]) {
  const citations: DraftCitation[] = [];

  sources
    .filter((source) => source.canUseForAi)
    .slice(0, 3)
    .forEach((source) => {
      const chunks = source.chunks.length > 0
        ? source.chunks.slice(0, 2)
        : source.extractedPreview
          ? [{ id: "preview", title: "文本预览", text: source.extractedPreview }]
          : [];

      chunks.forEach((chunk) => {
        citations.push({
          sourceTitle: source.title,
          chunkTitle: chunk.title,
          text: chunk.text,
        });
      });
    });

  return citations.slice(0, 4);
}

function buildDraft(input: ContentDraftInput, citations: DraftCitation[]) {
  const citationLine =
    citations.length > 0
      ? `本草稿引用了 ${citations.map((item) => `《${item.sourceTitle}》`).filter((value, index, array) => array.indexOf(value) === index).join("、")}。`
      : "当前没有可引用知识库，草稿基于行业默认边界生成。";
  const platform = input.platform || "短视频";
  const title = `${input.product}：给${input.customer}的${platform}引流脚本`;
  const hook = `如果你是${input.customer}，先不要急着做选择，先拿到这份「${input.hook}」。`;
  const citationEvidence = citations[0]?.text
    ? `资料依据：${citations[0].text}`
    : "资料依据：请先上传客户知识库，系统会把具体内容放入这里。";

  return {
    title,
    hook,
    body: [
      `开场：${hook}`,
      `主体：围绕「${input.product}」解释一个常见误区，用客户能听懂的语言说明判断标准。`,
      citationEvidence,
      `引导：评论或私信关键词「${input.hook}」，由私域员工发送资料并进入 CRM 跟进。`,
      `合规边界：不承诺收益、疗效、效果或确定性结果；涉及价格、合同、诊疗、投资判断时转人工。`,
      citationLine,
    ].join("\n"),
  };
}

export async function listContentDrafts(tenantId: string, user: DemoUser) {
  if (!findTenantById(tenantId)) throw new Error("客户工作区不存在。");
  if (!canAccessTenant(user, tenantId)) throw new Error("没有权限查看该客户工作区。");

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      title: string;
      hook: string;
      body: string;
      citations: unknown;
      status: string;
      created_by: string;
      created_at: Date | string;
      reviewed_by: string | null;
      reviewed_at: Date | string | null;
      review_note: string | null;
    }>(
      `SELECT id, tenant_id, title, hook, body, citations, status,
              created_by, created_at, reviewed_by, reviewed_at, review_note
         FROM app_content_drafts
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [tenantId],
    );

    return {
      storageMode: getStorageMode(),
      contentDrafts: rows.rows.map(mapContentDraftRow),
    };
  }

  const snapshot = await readLocalContentDrafts();
  return {
    storageMode: getStorageMode(),
    contentDrafts: snapshot.contentDrafts.filter((draft) => draft.tenantId === tenantId).slice(0, 100),
  };
}

export async function createContentDraft(user: DemoUser, input: ContentDraftInput) {
  validateInput(input);
  if (!canWriteTenantData(user, input.tenantId)) {
    throw new Error("当前角色没有生成内容草稿权限。");
  }

  const knowledge = await listKnowledgeSources(input.tenantId, user);
  const citations = pickCitations(knowledge.knowledgeSources);
  const draftText = buildDraft(input, citations);
  const now = new Date().toISOString();
  const record: ContentDraftRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    title: draftText.title,
    hook: draftText.hook,
    body: draftText.body,
    citations,
    status: "needs_review",
    createdBy: user.email,
    createdAt: now,
  };

  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_content_drafts (
        id, tenant_id, title, hook, body, citations, status, created_by, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
      [
        record.id,
        record.tenantId,
        record.title,
        record.hook,
        record.body,
        JSON.stringify(record.citations),
        record.status,
        record.createdBy,
        record.createdAt,
      ],
    );
    return record;
  }

  const snapshot = await readLocalContentDrafts();
  snapshot.contentDrafts.unshift(record);
  await writeLocalContentDrafts(snapshot);
  return record;
}

export async function getContentDraftById(
  tenantId: string,
  draftId: string,
  user: DemoUser,
) {
  if (!findTenantById(tenantId)) throw new Error("客户工作区不存在。");
  if (!canAccessTenant(user, tenantId)) throw new Error("没有权限查看该客户工作区。");
  if (!draftId.trim()) throw new Error("draftId is required.");

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      title: string;
      hook: string;
      body: string;
      citations: unknown;
      status: string;
      created_by: string;
      created_at: Date | string;
      reviewed_by: string | null;
      reviewed_at: Date | string | null;
      review_note: string | null;
    }>(
      `SELECT id, tenant_id, title, hook, body, citations, status,
              created_by, created_at, reviewed_by, reviewed_at, review_note
         FROM app_content_drafts
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, draftId],
    );

    return rows.rows[0] ? mapContentDraftRow(rows.rows[0]) : null;
  }

  const snapshot = await readLocalContentDrafts();
  return snapshot.contentDrafts.find(
    (draft) => draft.tenantId === tenantId && draft.id === draftId,
  ) ?? null;
}

export async function updateContentDraftStatus(
  user: DemoUser,
  tenantId: string,
  draftId: string,
  status: ContentDraftStatus,
  reviewNote?: string,
) {
  if (!findTenantById(tenantId)) throw new Error("客户工作区不存在。");
  if (!canWriteTenantData(user, tenantId)) {
    throw new Error("当前角色没有审核内容草稿权限。");
  }
  if (!draftId.trim()) throw new Error("draftId is required.");
  const nextStatus = normalizeStatus(status);
  const reviewedAt = new Date().toISOString();
  const note = reviewNote?.trim() || (
    nextStatus === "approved"
      ? "内容已审核通过。"
      : nextStatus === "rejected"
        ? "内容已驳回，需重新修改。"
        : nextStatus === "video_queued"
          ? "内容已进入视频任务。"
          : "内容回到待审核。"
  );

  if (isPostgresConfigured()) {
    const rows = await dbQuery<{
      id: string;
      tenant_id: string;
      title: string;
      hook: string;
      body: string;
      citations: unknown;
      status: string;
      created_by: string;
      created_at: Date | string;
      reviewed_by: string | null;
      reviewed_at: Date | string | null;
      review_note: string | null;
    }>(
      `UPDATE app_content_drafts
          SET status = $1,
              reviewed_by = $2,
              reviewed_at = $3,
              review_note = $4
        WHERE tenant_id = $5 AND id = $6
        RETURNING id, tenant_id, title, hook, body, citations, status,
                  created_by, created_at, reviewed_by, reviewed_at, review_note`,
      [nextStatus, user.email, reviewedAt, note, tenantId, draftId],
    );

    if (!rows.rows[0]) throw new Error("内容草稿不存在。");
    return mapContentDraftRow(rows.rows[0]);
  }

  const snapshot = await readLocalContentDrafts();
  const index = snapshot.contentDrafts.findIndex(
    (draft) => draft.tenantId === tenantId && draft.id === draftId,
  );
  if (index === -1) throw new Error("内容草稿不存在。");

  const updated: ContentDraftRecord = {
    ...snapshot.contentDrafts[index],
    status: nextStatus,
    reviewedBy: user.email,
    reviewedAt,
    reviewNote: note,
  };
  snapshot.contentDrafts[index] = updated;
  await writeLocalContentDrafts(snapshot);
  return updated;
}
