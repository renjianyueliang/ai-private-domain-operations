import { NextResponse } from "next/server";
import {
  createPublishPlanFromVideo,
  listPublishPlans,
} from "../../../../lib/client-workflow";
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

    return NextResponse.json({ user, ...(await listPublishPlans(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list publish plans.",
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
      videoJobId?: unknown;
      platform?: unknown;
    };

    const record = await createPublishPlanFromVideo(
      user,
      typeof body.tenantId === "string" ? body.tenantId : "",
      typeof body.videoJobId === "string" ? body.videoJobId : "",
      typeof body.platform === "string" ? body.platform : "短视频平台",
    );

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create publish plan.",
      },
      { status: 403 },
    );
  }
}
