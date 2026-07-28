import { BACKEND_API_URL } from "@/lib/api-base-url";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionOptions = {
  maxTokens?: number;
  jsonObject?: boolean;
};

export type AiStreamDelta = {
  content?: string;
  reasoning?: string;
};

function buildAiAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.AI_INTERNAL_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function missingBackendConfigMessage(): string {
  return "AI backend is not configured. Set BACKEND_API_URL and AI_INTERNAL_API_KEY on the server.";
}

async function readBackendError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `AI backend error (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
  }
}

export async function completeAiChat(
  messages: AiChatMessage[],
  maxTokens = 4096,
  options?: AiCompletionOptions
): Promise<string> {
  if (!BACKEND_API_URL) {
    throw new Error(missingBackendConfigMessage());
  }

  const response = await fetch(`${BACKEND_API_URL}/ai/chat/completions`, {
    method: "POST",
    headers: buildAiAuthHeaders(),
    body: JSON.stringify({
      messages,
      maxTokens: options?.maxTokens ?? maxTokens,
      jsonObject: options?.jsonObject ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(await readBackendError(response));
  }

  const data = (await response.json()) as { content?: string };
  const content = data.content?.trim();
  if (!content) {
    throw new Error("Empty response from AI backend.");
  }
  return content;
}

export async function* iterateAiChatStream(
  messages: AiChatMessage[],
  maxTokens = 4096,
  options?: AiCompletionOptions
): AsyncGenerator<AiStreamDelta> {
  if (!BACKEND_API_URL) {
    throw new Error(missingBackendConfigMessage());
  }

  const response = await fetch(`${BACKEND_API_URL}/ai/chat/completions/stream`, {
    method: "POST",
    headers: buildAiAuthHeaders(),
    body: JSON.stringify({
      messages,
      maxTokens: options?.maxTokens ?? maxTokens,
      jsonObject: options?.jsonObject ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(await readBackendError(response));
  }

  if (!response.body) {
    throw new Error("No response stream from AI backend.");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
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
          error?: string;
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        const chunk: AiStreamDelta = {};
        if (delta.reasoning_content) chunk.reasoning = delta.reasoning_content;
        if (delta.content) chunk.content = delta.content;
        if (chunk.reasoning || chunk.content) yield chunk;
      } catch {
        // Skip malformed SSE chunks.
      }
    }
  }
}
