import { NextResponse } from "next/server";
import {
  assertStorageAvailable,
  assertTenantFeature,
} from "../../../../lib/entitlements";
import { createJob, saveUpload } from "../../../../lib/local-store";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

const maxKnowledgeBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const formData = await request.formData();
    const tenantId = String(formData.get("tenantId") ?? "");
    const file = formData.get("file");

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (file.size > maxKnowledgeBytes) {
      return NextResponse.json(
        { error: "知识库文件当前限制 25MB 以内。" },
        { status: 413 },
      );
    }

    const tenant = assertTenantFeature(tenantId, "knowledge_upload");
    assertStorageAvailable(tenant, file.size);

    const upload = await saveUpload(tenantId, "knowledge", file, user);
    const job = await createJob(
      tenantId,
      "knowledge_ingest",
      "解析知识库并生成可检索索引",
      user,
      {
        uploadId: upload.id,
        fileName: upload.originalName,
        mimeType: upload.mimeType,
      },
      upload.id,
    );

    return NextResponse.json({ upload, jobs: [job] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload knowledge file.",
      },
      { status: 403 },
    );
  }
}
