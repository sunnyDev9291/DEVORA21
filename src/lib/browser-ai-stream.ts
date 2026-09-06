import { API_BASE_URL } from "@/lib/api-base-url";
import { isUserApiKey } from "@/lib/user-api-key";
import {
  EnglishTeamRequiredError,
  parseEnglishTeamRequired,
} from "@/lib/english-team-gate";

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
  /** Required by backend English-team gate (send both when available). */
  jobTitle?: string;
  jobDescription?: string;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

async function readHttpErrorPayload(response: Response): Promise<{
  message: string;
  gated: EnglishTeamRequiredError | null;
}> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return {
      message: `AI backend error (${response.status}): ${response.statusText}`,
      gated: null,
    };
  }
  try {
    const parsed = JSON.parse(detail) as {
      error?: string;
      message?: string;
      errorMessage?: string;
      code?: string;
    };
    const gated = parseEnglishTeamRequired(parsed, response.status);
    return {
      message: parsed.error || parsed.message || parsed.errorMessage || detail,
      gated,
    };
  } catch {
    return { message: detail, gated: null };
  }
}

async function throwHttpError(response: Response): Promise<never> {
  const { message, gated } = await readHttpErrorPayload(response);
  if (gated) throw gated;
  throw new Error(message);
}

function throwIfMidStreamError(accumulated: string): void {
  const match = MID_STREAM_ERROR.exec(accumulated);
  if (match?.[1]) {
    throw new Error(match[1].trim());
  }
}

function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("cors")
  );
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

/** Browser → api.devora21.com. userId goes in JSON only (avoids CORS on X-User-Id). */
async function fetchDirectAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens: number,
  options: BrowserAiStreamOptions
): Promise<Response> {
  const authToken = options.authToken.trim();
  const userId = options.userId?.trim() || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
    Authorization: `Bearer ${authToken}`,
  };

  const body: Record<string, unknown> = {
    messages,
    maxTokens,
    jsonObject: options.jsonObject ?? false,
  };
  if (userId) {
    body.userId = userId;
  }
  const jobTitle = options.jobTitle?.trim() ?? "";
  const jobDescription = options.jobDescription?.trim() ?? "";
  if (jobTitle) body.jobTitle = jobTitle;
  if (jobDescription) body.jobDescription = jobDescription;

  // Bearer + body.userId identify the user; omit cookies to avoid credential CORS failures.
  return fetch(`${API_BASE_URL}/ai/chat/completions/stream`, {
    method: "POST",
    credentials: "omit",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

/** Same-origin BFF when direct CORS/network fails. */
async function fetchBffAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens: number,
  options: BrowserAiStreamOptions
): Promise<Response> {
  const authToken = options.authToken.trim();
  const userId = options.userId?.trim() || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
  };
  if (isUserApiKey(authToken)) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return fetch("/api/ai/chat/completions/stream", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      messages,
      maxTokens,
      jsonObject: options.jsonObject ?? false,
      userId: userId || undefined,
      jobTitle: options.jobTitle?.trim() || undefined,
      jobDescription: options.jobDescription?.trim() || undefined,
    }),
    signal: options.signal,
  });
}

/**
 * Prefer browser → api.devora21.com (long streams).
 * Fall back to same-origin BFF when CORS/network blocks the direct call.
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

  let response: Response;
  try {
    response = await fetchDirectAiStream(messages, maxTokens, options);
  } catch (err) {
    if (options.signal?.aborted) throw err;
    if (!isNetworkFetchError(err)) throw err;
    response = await fetchBffAiStream(messages, maxTokens, {
      ...options,
      authToken,
      userId,
    });
  }

  if (!response.ok) {
    await throwHttpError(response);
  }

  yield* readPlainTextStream(response);
}
