import { NextResponse } from "next/server";
import {
  createVideoJobFromDraft,
  listWorkflowVideoJobs,
} from "../../../../lib/client-workflow";
import { updateContentDraftStatus } from "../../../../lib/content-drafts";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    return NextResponse.json({ user, ...(await listWorkflowVideoJobs(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list video jobs.",
      },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      tenantId?: unknown;
      contentDraftId?: unknown;
    };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const contentDraftId = typeof body.contentDraftId === "string" ? body.contentDraftId : "";

    await updateContentDraftStatus(
      user,
      tenantId,
      contentDraftId,
      "approved",
      "生成视频任务前自动记录为审核通过。",
    );
    const record = await createVideoJobFromDraft(user, tenantId, contentDraftId);
    await updateContentDraftStatus(
      user,
      tenantId,
      contentDraftId,
      "video_queued",
      "已由审核中心生成视频任务。",
    );

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create video job.",
      },
      { status: 403 },
    );
  }
}
