import { NextResponse } from "next/server";
import {
  createConversationAction,
  listConversationActions,
  type ConversationActionKind,
} from "../../../../lib/client-workflow";
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

    return NextResponse.json({ user, ...(await listConversationActions(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list conversation actions.",
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
      conversationId?: unknown;
      action?: unknown;
      note?: unknown;
    };

    const record = await createConversationAction(
      user,
      typeof body.tenantId === "string" ? body.tenantId : "",
      typeof body.conversationId === "string" ? body.conversationId : "",
      typeof body.action === "string" ? (body.action as ConversationActionKind) : "add_followup",
      typeof body.note === "string" ? body.note : "",
    );

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create conversation action.",
      },
      { status: 403 },
    );
  }
}
