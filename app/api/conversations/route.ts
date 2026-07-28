import { NextResponse } from "next/server";
import {
  getConversationSummary,
  getConversationsForTenant,
} from "../../../lib/conversations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;

  return NextResponse.json({
    summary: getConversationSummary(tenantId),
    conversations: getConversationsForTenant(tenantId),
  });
}
