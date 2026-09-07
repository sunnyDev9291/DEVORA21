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
  /** Required by backend English-team gate (always send; at least one non-empty). */
  jobTitle?: string;
  jobDescription?: string;
  /** When true, ask the backend to skip the English-team block and generate anyway. */
  skipEnglishTeamGate?: boolean;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;
const JOB_DESC_QUERY_MAX = 2500;

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

/** Backend gate error when jobTitle/jobDescription never reached the handler. */
function isMissingJobContextError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("jobtitle or jobdescription is required") ||
    normalized.includes("job title or job description is required")
  );
}

function resolveJobContext(options: Pick<BrowserAiStreamOptions, "jobTitle" | "jobDescription">): {
  jobTitle: string;
  jobDescription: string;
} {
  return {
    jobTitle: options.jobTitle?.trim() ?? "",
    jobDescription: options.jobDescription?.trim() ?? "",
  };
}

/**
 * Build stream JSON with job fields first (camel + snake).
 * Resume English-team gating on api.devora21.com requires these on jsonObject streams.
 */
function buildAiStreamBody(
  messages: BrowserAiChatMessage[],
  maxTokens: number,
  options: BrowserAiStreamOptions
): Record<string, unknown> {
  const userId = options.userId?.trim() || "";
  const { jobTitle, jobDescription } = resolveJobContext(options);

  const body: Record<string, unknown> = {
    jobTitle,
    jobDescription,
    job_title: jobTitle,
    job_description: jobDescription,
    messages,
    maxTokens,
    jsonObject: options.jsonObject ?? false,
  };
  if (userId) {
    body.userId = userId;
  }
  if (options.skipEnglishTeamGate) {
    body.skipEnglishTeamGate = true;
    body.skip_english_team_gate = true;
  }
  return body;
}

/** Query-string backup when gateways strip unknown JSON fields on the stream route. */
function withJobContextQuery(url: string, jobTitle: string, jobDescription: string): string {
  if (!jobTitle && !jobDescription) return url;
  const params = new URLSearchParams();
  if (jobTitle) {
    params.set("jobTitle", jobTitle);
    params.set("job_title", jobTitle);
  }
  if (jobDescription) {
    const clipped =
      jobDescription.length > JOB_DESC_QUERY_MAX
        ? jobDescription.slice(0, JOB_DESC_QUERY_MAX)
        : jobDescription;
    params.set("jobDescription", clipped);
    params.set("job_description", clipped);
  }
  const query = params.toString();
  return query ? `${url}?${query}` : url;
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
  const { jobTitle, jobDescription } = resolveJobContext(options);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
    Authorization: `Bearer ${authToken}`,
  };

  const url = withJobContextQuery(
    `${API_BASE_URL}/ai/chat/completions/stream`,
    jobTitle,
    jobDescription
  );

  // Bearer + body.userId identify the user; omit cookies to avoid credential CORS failures.
  return fetch(url, {
    method: "POST",
    credentials: "omit",
    headers,
    body: JSON.stringify(buildAiStreamBody(messages, maxTokens, options)),
    signal: options.signal,
  });
}

/** Same-origin BFF when direct CORS/network fails (or job-context validation fails). */
async function fetchBffAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens: number,
  options: BrowserAiStreamOptions
): Promise<Response> {
  const authToken = options.authToken.trim();
  const { jobTitle, jobDescription } = resolveJobContext(options);
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
    body: JSON.stringify(buildAiStreamBody(messages, maxTokens, options)),
    signal: options.signal,
  });
}

/**
 * Prefer browser → api.devora21.com (long streams).
 * Fall back to same-origin BFF when CORS/network blocks the direct call,
 * or when the direct path rejects missing jobTitle/jobDescription despite a filled form.
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
  const { jobTitle, jobDescription } = resolveJobContext(options);

  if (!usingUserKey && !userId) {
    throw new Error(
      "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
    );
  }

  if ((options.jsonObject ?? false) && !jobTitle && !jobDescription) {
    throw new Error("Job title or job description is required for resume generation.");
  }

  const streamOptions: BrowserAiStreamOptions = {
    ...options,
    authToken,
    userId,
    jobTitle,
    jobDescription,
  };

  let response: Response;
  let usedBff = false;
  try {
    response = await fetchDirectAiStream(messages, maxTokens, streamOptions);
  } catch (err) {
    if (options.signal?.aborted) throw err;
    if (!isNetworkFetchError(err)) throw err;
    usedBff = true;
    response = await fetchBffAiStream(messages, maxTokens, streamOptions);
  }

  if (!response.ok) {
    const { message, gated } = await readHttpErrorPayload(response);
    if (gated) throw gated;
    if (!usedBff && isMissingJobContextError(message)) {
      response = await fetchBffAiStream(messages, maxTokens, streamOptions);
      if (!response.ok) {
        await throwHttpError(response);
      }
    } else {
      throw new Error(message);
    }
  }

  yield* readPlainTextStream(response);
}
