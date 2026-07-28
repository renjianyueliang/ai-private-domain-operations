import { NextResponse } from "next/server";
import {
  createContentDraft,
  listContentDrafts,
  updateContentDraftStatus,
  type ContentDraftStatus,
} from "../../../../lib/content-drafts";
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

    return NextResponse.json({ user, ...(await listContentDrafts(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list content drafts.",
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
      product?: unknown;
      customer?: unknown;
      hook?: unknown;
      platform?: unknown;
    };

    const record = await createContentDraft(user, {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : "",
      product: typeof body.product === "string" ? body.product : "",
      customer: typeof body.customer === "string" ? body.customer : "",
      hook: typeof body.hook === "string" ? body.hook : "",
      platform: typeof body.platform === "string" ? body.platform : undefined,
    });

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create content draft.",
      },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      tenantId?: unknown;
      draftId?: unknown;
      status?: unknown;
      reviewNote?: unknown;
    };

    const status = typeof body.status === "string" ? body.status : "needs_review";
    const record = await updateContentDraftStatus(
      user,
      typeof body.tenantId === "string" ? body.tenantId : "",
      typeof body.draftId === "string" ? body.draftId : "",
      status as ContentDraftStatus,
      typeof body.reviewNote === "string" ? body.reviewNote : undefined,
    );

    return NextResponse.json({ user, record });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update content draft.",
      },
      { status: 403 },
    );
  }
}
