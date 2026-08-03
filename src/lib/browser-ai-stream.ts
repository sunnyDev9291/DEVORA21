import { API_BASE_URL } from "@/lib/api-base-url";
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
   * Bearer for Authorization:
   * - dv21_ user key, or
   * - AI_INTERNAL_API_KEY from prepare (cookie sessions)
   */
  authToken: string;
  /** Logged-in user id — required when Authorization is the internal key. */
  userId?: string;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

async function readHttpError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `AI backend error (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as {
      error?: string;
      message?: string;
      errorMessage?: string;
    };
    return parsed.error || parsed.message || parsed.errorMessage || detail;
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
 * Stream chat completions directly from the browser → api.devora21.com.
 * Avoids Netlify BFF timeouts on long Claude streams.
 * Backend strips client system messages and applies the saved profile prompt —
 * send userId / X-User-Id when using the internal AI key.
 */
export async function* iterateBrowserAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens = 4096,
  options: BrowserAiStreamOptions
): AsyncGenerator<BrowserAiStreamDelta> {
  const authToken = options.authToken?.trim() || "";
  if (!authToken) {
    throw new Error(
      "Missing AI stream auth. Connect a dv21_ API key, or set AI_INTERNAL_API_KEY on the server for cookie sessions."
    );
  }

  const userId = options.userId?.trim() || "";
  const usingUserKey = isUserApiKey(authToken);

  if (!usingUserKey && !userId) {
    throw new Error(
      "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
    Authorization: `Bearer ${authToken}`,
  };
  if (userId) {
    headers["X-User-Id"] = userId;
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
