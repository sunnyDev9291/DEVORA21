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

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

function buildAiAuthHeaders(accept = "text/plain"): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: accept,
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

function throwIfMidStreamError(accumulated: string): void {
  const match = MID_STREAM_ERROR.exec(accumulated);
  if (match?.[1]) {
    throw new Error(match[1].trim());
  }
}

/** Collect a full completion as plain text (non-stream or drained stream body). */
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
    headers: buildAiAuthHeaders("text/plain"),
    body: JSON.stringify({
      messages,
      maxTokens: options?.maxTokens ?? maxTokens,
      jsonObject: options?.jsonObject ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(await readBackendError(response));
  }

  const content = (await response.text()).trim();
  throwIfMidStreamError(content);
  if (!content) {
    throw new Error("Empty response from AI backend.");
  }
  return content;
}

/** Stream plain-text chunks from the backend (Claude stream=true, no SSE wrappers). */
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
    headers: buildAiAuthHeaders("text/plain"),
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
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    accumulated += chunk;
    throwIfMidStreamError(accumulated);
    yield { content: chunk };
  }

  const tail = decoder.decode();
  if (tail) {
    accumulated += tail;
    throwIfMidStreamError(accumulated);
    yield { content: tail };
  }
}
