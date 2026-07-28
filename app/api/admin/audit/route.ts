import { NextResponse } from "next/server";
import { listRiskEvents, setRiskEventReviewed } from "../../../../lib/control-store";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    return NextResponse.json({ user, ...(await listRiskEvents(user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list risk events.",
      },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      eventId?: unknown;
      reviewed?: unknown;
    };
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const reviewed = Boolean(body.reviewed);

    const event = await setRiskEventReviewed(user, eventId, reviewed);
    return NextResponse.json({ user, event });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update risk event.",
      },
      { status: 403 },
    );
  }
}
