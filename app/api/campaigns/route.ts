import { NextResponse } from "next/server";
import { getAcquisitionSummary, getCampaignsForTenant } from "../../../lib/campaigns";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;

  return NextResponse.json({
    summary: getAcquisitionSummary(tenantId),
    campaigns: getCampaignsForTenant(tenantId),
  });
}
