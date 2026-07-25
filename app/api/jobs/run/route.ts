import { NextResponse } from "next/server";
import { runQueuedJobs } from "../../../../lib/job-worker";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      tenantId?: unknown;
      maxJobs?: unknown;
    };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const maxJobs = typeof body.maxJobs === "number" ? body.maxJobs : 5;

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    const result = await runQueuedJobs(tenantId, user, maxJobs);
    return NextResponse.json({ user, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run jobs.",
      },
      { status: 403 },
    );
  }
}
