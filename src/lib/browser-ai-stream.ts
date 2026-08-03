import { isUserApiKey } from "@/lib/user-api-key";

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
  /**
   * Optional dv21_ user API key.
   * Cookie sessions omit this — the BFF uses AI_INTERNAL_API_KEY + userId.
   */
  authToken?: string;
  /** Logged-in user id — required when not using a dv21_ key. */
  userId?: string;
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
 * Stream chat completions via same-origin BFF → api.devora21.com.
 * Backend strips client system messages and applies the user's saved profile prompt —
 * userId must reach the backend (sent by the BFF as body + X-User-Id).
 */
export async function* iterateBrowserAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens = 4096,
  options: BrowserAiStreamOptions
): AsyncGenerator<BrowserAiStreamDelta> {
  const userId = options.userId?.trim() || "";
  const authToken = options.authToken?.trim() || "";
  const usingUserKey = isUserApiKey(authToken);

  if (!usingUserKey && !userId) {
    throw new Error(
      "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
  };
  if (usingUserKey) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch("/api/ai/chat/completions/stream", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      messages,
      maxTokens,
      jsonObject: options.jsonObject ?? false,
      userId: userId || undefined,
    }),
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
