const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-v4-pro";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekCallOptions = {
  maxTokens?: number;
  /** DeepSeek JSON mode — guarantees valid JSON in message content when complete. */
  jsonObject?: boolean;
};

function buildDeepSeekBody(
  messages: ChatMessage[],
  stream: boolean,
  options?: DeepSeekCallOptions
) {
  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    max_tokens: options?.maxTokens ?? 4096,
    stream,
    messages,
    thinking: { type: "disabled" },
  };
  if (options?.jsonObject) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

export async function completeDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096,
  options?: Omit<DeepSeekCallOptions, "maxTokens"> & { maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing DEEPSEEK_API_KEY. Add it to .env.local and restart.");
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      buildDeepSeekBody(messages, false, {
        maxTokens: options?.maxTokens ?? maxTokens,
        jsonObject: options?.jsonObject,
      })
    ),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`DeepSeek API error (${upstream.status}): ${detail || upstream.statusText}`);
  }

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from DeepSeek.");
  return content;
}

export type DeepSeekStreamDelta = {
  content?: string;
  reasoning?: string;
};

export async function* iterateDeepSeekStream(
  messages: ChatMessage[],
  maxTokens = 4096,
  options?: Omit<DeepSeekCallOptions, "maxTokens"> & { maxTokens?: number }
): AsyncGenerator<DeepSeekStreamDelta> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing DEEPSEEK_API_KEY. Add it to .env.local and restart.");
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      buildDeepSeekBody(messages, true, {
        maxTokens: options?.maxTokens ?? maxTokens,
        jsonObject: options?.jsonObject,
      })
    ),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`DeepSeek API error (${upstream.status}): ${detail || upstream.statusText}`);
  }

  if (!upstream.body) {
    throw new Error("No response stream from DeepSeek.");
  }

  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        const chunk: DeepSeekStreamDelta = {};
        if (delta.reasoning_content) chunk.reasoning = delta.reasoning_content;
        if (delta.content) chunk.content = delta.content;
        if (chunk.reasoning || chunk.content) yield chunk;
      } catch {
        // Skip malformed SSE chunks.
      }
    }
  }
}

export async function streamDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096
): Promise<Response> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: "Server is missing DEEPSEEK_API_KEY. Add it to .env.local and restart." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of iterateDeepSeekStream(messages, maxTokens)) {
          if (delta.content) controller.enqueue(encoder.encode(delta.content));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate a response.";
        controller.enqueue(encoder.encode(`\n\n[Error] ${message}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
