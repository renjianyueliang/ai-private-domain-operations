import { NextResponse } from "next/server";
import { listTenantState } from "../../../lib/local-store";
import { getUserFromRequest } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const user = getUserFromRequest(request);

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    const state = await listTenantState(tenantId, user);
    return NextResponse.json({ user, ...state });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load workspace state.",
      },
      { status: 403 },
    );
  }
}
