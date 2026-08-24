import { API_BASE_URL } from "@/lib/api-base-url";
import { ApiError } from "@/lib/auth-api";
import { getUserApiKey, isUserApiKey } from "@/lib/user-api-key";
import type { JobCheckInput } from "@/lib/job-check-types";

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;
/** Fail if backend never sends the first byte (hang / no flush). */
const FIRST_BYTE_TIMEOUT_MS = 45_000;

async function readHttpError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `Job Check failed (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
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

function throwIfMidStreamError(accumulated: string): void {
  const match = MID_STREAM_ERROR.exec(accumulated);
  if (match?.[1]) {
    throw new Error(match[1].trim());
  }
}

async function resolveStreamAuthToken(): Promise<string> {
  const userKey = getUserApiKey();
  if (userKey) return userKey;

  const res = await fetch("/api/jobs/check/auth", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as {
    streamAuthToken?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new ApiError(
      data.error?.trim() ||
        "Sign in or connect a dv21_ API key to run Job Check.",
      res.status
    );
  }

  const token = data.streamAuthToken?.trim() ?? "";
  if (!token) {
    throw new ApiError(
      "AI is not configured for Job Check. Connect a dv21_ API key or set AI_INTERNAL_API_KEY on the server.",
      503
    );
  }
  return token;
}

async function fetchDirectJobCheckStream(
  input: JobCheckInput,
  authToken: string,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(`${API_BASE_URL}/jobs/check/stream`, {
    method: "POST",
    // Same as resume AI stream — avoid credential CORS hangs.
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(input),
    signal,
  });
}

async function fetchBffJobCheckStream(
  input: JobCheckInput,
  authToken: string,
  signal?: AbortSignal
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
  };
  if (isUserApiKey(authToken)) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return fetch("/api/jobs/check/stream", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(input),
    signal,
  });
}

async function openJobCheckStream(
  input: JobCheckInput,
  authToken: string,
  signal?: AbortSignal
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchDirectJobCheckStream(input, authToken, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (!isNetworkFetchError(err)) throw err;
    response = await fetchBffJobCheckStream(input, authToken, signal);
  }

  // Direct may return 401/404/500 — fall back to same-origin BFF once.
  if (!response.ok) {
    const directError = await readHttpError(response);
    try {
      const fallback = await fetchBffJobCheckStream(input, authToken, signal);
      if (fallback.ok && fallback.body) return fallback;
      const fallbackError = await readHttpError(fallback);
      throw new ApiError(fallbackError || directError, fallback.status || response.status);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (signal?.aborted) throw err;
      throw new ApiError(directError, response.status);
    }
  }

  if (!response.body) {
    throw new ApiError("No response stream from Job Check.", 502);
  }

  return response;
}

async function* readTextStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let gotChunk = false;

  const timeoutController = new AbortController();
  const firstByteTimer = window.setTimeout(() => {
    timeoutController.abort();
    void reader.cancel();
  }, FIRST_BYTE_TIMEOUT_MS);

  const onAbort = () => {
    window.clearTimeout(firstByteTimer);
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  timeoutController.signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (timeoutController.signal.aborted && !gotChunk) {
        throw new ApiError(
          "Job Check timed out waiting for the first token. The backend must stream plain text immediately (flush chunks), not buffer the full response.",
          504
        );
      }

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;

      if (!gotChunk) {
        gotChunk = true;
        window.clearTimeout(firstByteTimer);
      }

      accumulated += chunk;
      throwIfMidStreamError(accumulated);
      yield chunk;
    }

    const tail = decoder.decode();
    if (tail) {
      if (!gotChunk) {
        gotChunk = true;
        window.clearTimeout(firstByteTimer);
      }
      accumulated += tail;
      throwIfMidStreamError(accumulated);
      yield tail;
    }
  } finally {
    window.clearTimeout(firstByteTimer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!gotChunk || !accumulated.trim()) {
    throw new ApiError(
      "Job Check returned an empty stream. Confirm POST /jobs/check/stream returns text/plain chunks (not buffered JSON).",
      502
    );
  }
}

/** Stream plain-text Job Check output from the backend AI model. */
export async function* iterateJobCheckStream(
  input: JobCheckInput,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const companyName = input.companyName.trim();
  if (!companyName) {
    throw new ApiError("Company name is required for Job Check.", 400);
  }

  const authToken = await resolveStreamAuthToken();
  const response = await openJobCheckStream(
    {
      jobTitle: input.jobTitle.trim(),
      companyName,
      jobDescription: input.jobDescription.trim(),
    },
    authToken,
    signal
  );

  yield* readTextStream(response, signal);
}
