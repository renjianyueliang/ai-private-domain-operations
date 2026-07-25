import { NextResponse } from "next/server";
import { createTenantDraft, listTenantDrafts } from "../../../../lib/platform-store";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await listTenantDrafts());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list tenant drafts.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      company?: unknown;
      industry?: unknown;
      plan?: unknown;
      renewalDate?: unknown;
      seats?: unknown;
    };

    const draft = await createTenantDraft(user, {
      company: typeof body.company === "string" ? body.company : "",
      industry: typeof body.industry === "string" ? body.industry : "",
      plan: typeof body.plan === "string" ? body.plan : "",
      renewalDate: typeof body.renewalDate === "string" ? body.renewalDate : "",
      seats:
        typeof body.seats === "number"
          ? body.seats
          : Number.parseInt(String(body.seats ?? ""), 10),
    });

    return NextResponse.json({ user, draft }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create tenant draft.",
      },
      { status: 403 },
    );
  }
}
