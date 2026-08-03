import { API_BASE_URL } from "@/lib/api-base-url";

export type BrowserAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrowserAiStreamDelta = {
  content?: string;
};

export type BrowserAiStreamOptions = {
  jsonObject?: boolean;
  signal?: AbortSignal;
  /** Bearer token for Authorization (dv21_ user key or AI_INTERNAL_API_KEY). */
  authToken: string;
  /** Logged-in user id — required when using the internal AI key so profile prompt can load. */
  userId?: string;
  /** Optional end-user Bearer (dv21_ / access token) forwarded as X-User-Authorization. */
  userAuthorization?: string;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

async function readHttpError(response: Response): Promise<string> {
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

/**
 * Stream chat completions from api.devora21.com as raw plain text.
 * Backend strips client system messages and applies the user's saved profile prompt —
 * send userId (and/or X-User-Authorization) so it can resolve that prompt.
 */
export async function* iterateBrowserAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens = 4096,
  options: BrowserAiStreamOptions
): AsyncGenerator<BrowserAiStreamDelta> {
  const authToken = options.authToken?.trim();
  if (!authToken) {
    throw new Error(
      "Missing AI stream auth. Connect a dv21_ API key, or ensure AI_INTERNAL_API_KEY is set on the server for cookie sessions."
    );
  }

  const userId = options.userId?.trim() || "";
  const userAuthorization = options.userAuthorization?.trim() || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
    Authorization: `Bearer ${authToken}`,
  };
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  if (userAuthorization) {
    headers["X-User-Authorization"] = userAuthorization.startsWith("Bearer ")
      ? userAuthorization
      : `Bearer ${userAuthorization}`;
  }

  const body: Record<string, unknown> = {
    messages,
    maxTokens,
    jsonObject: options.jsonObject ?? false,
  };
  if (userId) {
    body.userId = userId;
  }

  const response = await fetch(`${API_BASE_URL}/ai/chat/completions/stream`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readHttpError(response));
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
