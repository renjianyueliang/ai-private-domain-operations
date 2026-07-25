import { NextResponse } from "next/server";
import { buildWorkflowWithAgentRunner } from "../../../lib/agent-runner";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { command?: unknown; tenantId?: unknown };
    const command = typeof body.command === "string" ? body.command : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
    const workflow = await buildWorkflowWithAgentRunner(command, tenantId);

    return NextResponse.json(workflow);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build workflow.",
      },
      { status: 500 },
    );
  }
}
