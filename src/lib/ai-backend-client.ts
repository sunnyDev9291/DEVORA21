import { BACKEND_API_URL } from "@/lib/api-base-url";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionOptions = {
  maxTokens?: number;
  jsonObject?: boolean;
  /** Logged-in user id for profile-prompt application. */
  userId?: string;
  /** Optional end-user Bearer forwarded as X-User-Authorization. */
  userAuthorization?: string;
  /** Required by backend English-team gate on resume (jsonObject) generations. */
  jobTitle?: string;
  jobDescription?: string;
};

export type AiStreamDelta = {
  content?: string;
  reasoning?: string;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

function buildAiAuthHeaders(
  accept = "text/plain",
  options?: Pick<AiCompletionOptions, "userId" | "userAuthorization">
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: accept,
  };
  const key = process.env.AI_INTERNAL_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  const userId = options?.userId?.trim();
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  const userAuthorization = options?.userAuthorization?.trim();
  if (userAuthorization) {
    headers["X-User-Authorization"] = userAuthorization.startsWith("Bearer ")
      ? userAuthorization
      : `Bearer ${userAuthorization}`;
  }
  return headers;
}

function buildAiBody(
  messages: AiChatMessage[],
  maxTokens: number,
  options?: AiCompletionOptions
): Record<string, unknown> {
  const jobTitle = options?.jobTitle?.trim() ?? "";
  const jobDescription = options?.jobDescription?.trim() ?? "";
  // Job fields first + snake_case aliases for the English-team resume gate.
  const body: Record<string, unknown> = {
    jobTitle,
    jobDescription,
    job_title: jobTitle,
    job_description: jobDescription,
    messages,
    maxTokens: options?.maxTokens ?? maxTokens,
    jsonObject: options?.jsonObject ?? false,
  };
  const userId = options?.userId?.trim();
  if (userId) {
    body.userId = userId;
  }
  return body;
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

function extractAiCompletionText(text: string): string {
  throwIfMidStreamError(text);
  if (!text) {
    throw new Error("Empty response from AI backend.");
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { content?: string; error?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        throw new Error(parsed.error.trim());
      }
      if (typeof parsed.content === "string") {
        const content = parsed.content.trim();
        if (content) return content;
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Response looked like JSON but wasn't — use raw text.
      } else if (err instanceof Error) {
        throw err;
      }
    }
  }

  return text;
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
    headers: buildAiAuthHeaders("text/plain", options),
    body: JSON.stringify(buildAiBody(messages, maxTokens, options)),
  });

  if (!response.ok) {
    throw new Error(await readBackendError(response));
  }

  const text = (await response.text()).trim();
  return extractAiCompletionText(text);
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
    headers: buildAiAuthHeaders("text/plain", options),
    body: JSON.stringify(buildAiBody(messages, maxTokens, options)),
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
