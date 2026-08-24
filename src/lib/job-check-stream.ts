import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import type { JobCheckInput } from "@/lib/job-check-types";

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

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

async function fetchDirectJobCheckStream(
  input: JobCheckInput,
  signal?: AbortSignal
): Promise<Response> {
  return apiAuthFetch(`${API_BASE_URL}/jobs/check/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain",
    },
    body: JSON.stringify(input),
    signal,
  });
}

async function fetchBffJobCheckStream(
  input: JobCheckInput,
  signal?: AbortSignal
): Promise<Response> {
  return fetch("/api/jobs/check/stream", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain",
    },
    body: JSON.stringify(input),
    signal,
  });
}

async function openJobCheckStream(
  input: JobCheckInput,
  signal?: AbortSignal
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchDirectJobCheckStream(input, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (!isNetworkFetchError(err)) throw err;
    response = await fetchBffJobCheckStream(input, signal);
  }

  if (!response.ok) {
    throw new ApiError(await readHttpError(response), response.status);
  }

  if (!response.body) {
    throw new ApiError("No response stream from Job Check.", 502);
  }

  return response;
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

  const response = await openJobCheckStream(
    {
      jobTitle: input.jobTitle.trim(),
      companyName,
      jobDescription: input.jobDescription.trim(),
    },
    signal
  );

  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    accumulated += chunk;
    throwIfMidStreamError(accumulated);
    yield chunk;
  }

  const tail = decoder.decode();
  if (tail) {
    accumulated += tail;
    throwIfMidStreamError(accumulated);
    yield tail;
  }
}
