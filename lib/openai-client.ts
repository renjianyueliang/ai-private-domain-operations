export type OpenAIResult =
  | {
      ok: true;
      text: string;
      model: string;
    }
  | {
      ok: false;
      error: string;
      model: string;
    };

const defaultModel = "gpt-5.6-sol";

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
  if (!Array.isArray(output)) return "";

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

export async function generateWithOpenAI(prompt: string): Promise<OpenAIResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || defaultModel;

  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured.",
      model,
    };
  }

  try {
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
      return {
        ok: false,
        error: `OpenAI API ${response.status}: ${errorBody.slice(0, 500)}`,
        model,
      };
    }

    const data = (await response.json()) as unknown;
    const text = getOutputText(data);

    if (!text) {
      return {
        ok: false,
        error: "OpenAI API returned an empty output.",
        model,
      };
    }

    return {
      ok: true,
      text,
      model,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown OpenAI API error.",
      model,
    };
  }
}
