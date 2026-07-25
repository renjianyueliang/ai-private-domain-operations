import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.json({ user: getUserFromRequest(request) });
}
