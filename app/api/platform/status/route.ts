import { NextResponse } from "next/server";
import { getProductionStatus } from "../../../../lib/production-status";
import { getSessionUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await getProductionStatus({
        currentUser: getSessionUserFromRequest(request),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load production status.",
      },
      { status: 500 },
    );
  }
}
