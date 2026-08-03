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
   * - AI_INTERNAL_API_KEY (from prepare) for direct fallback / cached clients
   */
  authToken?: string;
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

async function* readPlainTextStream(
  response: Response
): AsyncGenerator<BrowserAiStreamDelta> {
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

async function fetchDirectAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens: number,
  options: BrowserAiStreamOptions
): Promise<Response> {
  const authToken = options.authToken?.trim() || "";
  if (!authToken) {
    throw new Error(
      "Missing AI stream auth. Connect a dv21_ API key, or set AI_INTERNAL_API_KEY on the server for cookie sessions."
    );
  }

  const userId = options.userId?.trim() || "";
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

  return fetch(`${API_BASE_URL}/ai/chat/completions/stream`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

/**
 * Stream chat completions via same-origin BFF → api.devora21.com.
 * Falls back to a direct API call when the BFF is missing or misconfigured
 * (e.g. cached older client + prepare streamAuthToken).
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

  const bffHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
  };
  if (usingUserKey) {
    bffHeaders.Authorization = `Bearer ${authToken}`;
  }

  let response = await fetch("/api/ai/chat/completions/stream", {
    method: "POST",
    credentials: "include",
    headers: bffHeaders,
    body: JSON.stringify({
      messages,
      maxTokens,
      jsonObject: options.jsonObject ?? false,
      userId: userId || undefined,
    }),
    signal: options.signal,
  });

  // Cached clients / partial deploys: fall back to direct API with prepare token.
  if (response.status === 404 || response.status === 405) {
    response = await fetchDirectAiStream(messages, maxTokens, options);
  } else if (!response.ok) {
    const bffError = await readHttpError(response);
    const canFallback =
      Boolean(authToken) &&
      /AI_INTERNAL_API_KEY|not configured|Missing AI stream/i.test(bffError);
    if (canFallback) {
      response = await fetchDirectAiStream(messages, maxTokens, options);
    } else {
      throw new Error(bffError);
    }
  }

  if (!response.ok) {
    throw new Error(await readHttpError(response));
  }

  yield* readPlainTextStream(response);
}
