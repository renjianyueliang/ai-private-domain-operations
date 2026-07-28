import { NextResponse } from "next/server";
import { listFeatureMatrix, saveTenantFeatureMatrix } from "../../../../lib/control-store";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    return NextResponse.json({ user, ...(await listFeatureMatrix(user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list feature matrix.",
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
      features?: unknown;
    };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const features =
      typeof body.features === "object" && body.features !== null && !Array.isArray(body.features)
        ? (body.features as Record<string, unknown>)
        : {};

    const record = await saveTenantFeatureMatrix(user, tenantId, features);
    return NextResponse.json({ user, record });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save feature matrix.",
      },
      { status: 403 },
    );
  }
}
