import { NextResponse } from "next/server";
import { createBillingRecord, listBillingRecords } from "../../../../lib/billing";
import { getUserFromRequest } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await listBillingRecords());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list billing records.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    const body = (await request.json()) as {
      tenantId?: unknown;
      kind?: unknown;
      title?: unknown;
      amountCny?: unknown;
      status?: unknown;
      dueDate?: unknown;
      note?: unknown;
    };

    const record = await createBillingRecord(user, {
      tenantId: typeof body.tenantId === "string" ? body.tenantId : "",
      kind: body.kind === "invoice" || body.kind === "payment" ? body.kind : "contract",
      title: typeof body.title === "string" ? body.title : "",
      amountCny: typeof body.amountCny === "number" ? body.amountCny : Number(body.amountCny ?? 0),
      status:
        body.status === "issued" || body.status === "paid" || body.status === "void"
          ? body.status
          : "draft",
      dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    });

    return NextResponse.json({ user, record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create billing record.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: message.includes("平台管理员") ? 403 : 400 },
    );
  }
}
