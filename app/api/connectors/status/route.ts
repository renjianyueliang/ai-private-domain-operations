import { NextResponse } from "next/server";
import { summarizeConnectorStatus } from "../../../../lib/connectors";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(summarizeConnectorStatus());
}
