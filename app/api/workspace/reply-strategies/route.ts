import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getLatestReplyStrategy,
  saveReplyStrategy,
} from "../../../../lib/control-store";
import { getUserFromRequest } from "../../../../lib/session";
import type { ReplyRule } from "../../../../lib/workspace-product";

export const runtime = "nodejs";

function parseRules(value: unknown): ReplyRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
      const rule = item as Partial<ReplyRule>;
      return {
        id: String(rule.id ?? randomUUID()),
        tenantId: String(rule.tenantId ?? ""),
        name: String(rule.name ?? ""),
        trigger: String(rule.trigger ?? ""),
        reply: String(rule.reply ?? ""),
        destination: String(rule.destination ?? ""),
        enabled: Boolean(rule.enabled),
        riskMode:
          rule.riskMode === "自动建议" || rule.riskMode === "确认后发送" || rule.riskMode === "必须人工"
            ? rule.riskMode
            : "必须人工",
      } satisfies ReplyRule;
    })
    .filter((item): item is ReplyRule => Boolean(item && item.name && item.trigger));
}

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    return NextResponse.json({ user, ...(await getLatestReplyStrategy(tenantId, user)) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load reply strategy.",
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
      rules?: unknown;
      testMessage?: unknown;
    };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const rules = parseRules(body.rules).map((rule) => ({ ...rule, tenantId }));
    const testMessage = typeof body.testMessage === "string" ? body.testMessage : undefined;

    const record = await saveReplyStrategy(user, tenantId, rules, testMessage);
    return NextResponse.json({ user, record });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save reply strategy.",
      },
      { status: 403 },
    );
  }
}
