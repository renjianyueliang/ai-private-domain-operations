import { NextResponse } from "next/server";
import {
  createAcquisitionPlan,
  listAcquisitionPlans,
} from "../../../../lib/control-store";
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

    return NextResponse.json({ user, ...(await listAcquisitionPlans(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list acquisition plans.",
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
      industry?: unknown;
      product?: unknown;
      customer?: unknown;
      hook?: unknown;
      dailyLeadTarget?: unknown;
      riskMode?: unknown;
      channels?: unknown;
    };

    const record = await createAcquisitionPlan(user, {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : "",
      industry: typeof body.industry === "string" ? body.industry : "",
      product: typeof body.product === "string" ? body.product : "",
      customer: typeof body.customer === "string" ? body.customer : "",
      hook: typeof body.hook === "string" ? body.hook : "",
      dailyLeadTarget:
        typeof body.dailyLeadTarget === "number"
          ? body.dailyLeadTarget
          : Number.parseInt(String(body.dailyLeadTarget ?? ""), 10),
      riskMode: typeof body.riskMode === "string" ? body.riskMode : "高风险人工确认",
      channels: Array.isArray(body.channels) ? body.channels.map(String) : [],
    });

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save acquisition plan.",
      },
      { status: 403 },
    );
  }
}
