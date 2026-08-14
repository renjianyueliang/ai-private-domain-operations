import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { dbQuery, isPostgresConfigured } from "./database";
import { getLocalDataRoot } from "./local-data-path";

export type ModelGatewayResult =
  | {
      ok: true;
      text: string;
      model: string;
      provider: "openai" | "compatible";
      latencyMs: number;
      fallbackUsed: boolean;
    }
  | {
      ok: false;
      error: string;
      model: string;
      provider: "mock";
      latencyMs: number;
      fallbackUsed: true;
    };

type ModelGatewayOptions = {
  tenantId?: string;
  taskKind?: string;
};

type UsageEvent = {
  id: string;
  tenantId?: string;
  provider: string;
  model: string;
  ok: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
  taskKind?: string;
  error?: string;
  createdAt: string;
};

function getOutputText(response: unknown) {
  if (
    typeof response === "object" &&
    response !== null &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text.trim();
  }

  const output = (response as { output?: unknown }).output;
  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) return [];
        return content
          .map((part) => {
            if (
              typeof part === "object" &&
              part !== null &&
              "text" in part &&
              typeof part.text === "string"
            ) {
              return part.text;
            }
            return "";
          })
          .filter(Boolean);
      })
      .join("\n")
      .trim();
  }

  const choices = (response as { choices?: unknown }).choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
    if (typeof first?.message?.content === "string") return first.message.content.trim();
    if (typeof first?.text === "string") return first.text.trim();
  }

  return "";
}

async function recordUsage(event: UsageEvent) {
  if (isPostgresConfigured()) {
    await dbQuery(
      `INSERT INTO app_model_usage_events (
        id, tenant_id, provider, model, ok, fallback_used, latency_ms,
        task_kind, error, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        event.id,
        event.tenantId ?? null,
        event.provider,
        event.model,
        event.ok,
        event.fallbackUsed,
        event.latencyMs,
        event.taskKind ?? null,
        event.error ?? null,
        event.createdAt,
      ],
    );
    return;
  }

  const localPath = path.join(getLocalDataRoot(), "model-usage.json");
  await mkdir(path.dirname(localPath), { recursive: true });

  let events: UsageEvent[] = [];
  try {
    events = JSON.parse(await readFile(localPath, "utf8")) as UsageEvent[];
  } catch {
    events = [];
  }

  events.unshift(event);
  await writeFile(localPath, JSON.stringify(events.slice(0, 500), null, 2), "utf8");
}

async function callOpenAIResponses(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const text = getOutputText(await response.json());
  if (!text) throw new Error("OpenAI API returned an empty output.");

  return { text, model };
}

async function callCompatibleChat(prompt: string) {
  const baseUrl = process.env.COMPATIBLE_MODEL_BASE_URL?.trim();
  const apiKey = process.env.COMPATIBLE_MODEL_API_KEY?.trim();
  const model = process.env.COMPATIBLE_MODEL_NAME?.trim() || "compatible-default";

  if (!baseUrl || !apiKey) {
    throw new Error("Compatible model endpoint is not configured.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Compatible model API ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const text = getOutputText(await response.json());
  if (!text) throw new Error("Compatible model returned an empty output.");

  return { text, model };
}

export async function generateWithModelGateway(
  prompt: string,
  options: ModelGatewayOptions = {},
): Promise<ModelGatewayResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const openai = await callOpenAIResponses(prompt);
    const result: ModelGatewayResult = {
      ok: true,
      text: openai.text,
      model: openai.model,
      provider: "openai",
      latencyMs: Date.now() - start,
      fallbackUsed: false,
    };
    await recordUsage({ id: randomUUID(), tenantId: options.tenantId, taskKind: options.taskKind, ...result, createdAt: new Date().toISOString() });
    return result;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown OpenAI API error.");
  }

  try {
    const compatible = await callCompatibleChat(prompt);
    const result: ModelGatewayResult = {
      ok: true,
      text: compatible.text,
      model: compatible.model,
      provider: "compatible",
      latencyMs: Date.now() - start,
      fallbackUsed: true,
    };
    await recordUsage({ id: randomUUID(), tenantId: options.tenantId, taskKind: options.taskKind, ...result, createdAt: new Date().toISOString() });
    return result;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown compatible model API error.");
  }

  const result: ModelGatewayResult = {
    ok: false,
    error: errors.join(" | "),
    model: process.env.OPENAI_MODEL?.trim() || process.env.COMPATIBLE_MODEL_NAME?.trim() || "mock",
    provider: "mock",
    latencyMs: Date.now() - start,
    fallbackUsed: true,
  };
  await recordUsage({ id: randomUUID(), tenantId: options.tenantId, taskKind: options.taskKind, ...result, createdAt: new Date().toISOString() });
  return result;
}
