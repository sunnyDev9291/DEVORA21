import { API_BASE_URL } from "@/lib/api-base-url";
import { ApiError } from "@/lib/auth-api";
import { getUserApiKey, isUserApiKey } from "@/lib/user-api-key";

export type EnglishTeamCheckInput = {
  jobTitle?: string;
  jobDescription?: string;
};

export type EnglishTeamCheckResult = {
  answer: "Yes" | "No";
  workWithEnglishTeam: boolean;
};

async function resolveAiAuthToken(): Promise<string> {
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
        "Sign in or connect a dv21_ API key to check English-team status.",
      res.status
    );
  }

  const token = data.streamAuthToken?.trim() ?? "";
  if (!token) {
    throw new ApiError(
      "AI is not configured. Connect a dv21_ API key or set AI_INTERNAL_API_KEY on the server.",
      503
    );
  }
  return token;
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

async function readError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `English-team check failed (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
  }
}

function parseResult(data: unknown): EnglishTeamCheckResult {
  if (!data || typeof data !== "object") {
    throw new ApiError("English-team check returned an invalid response.", 502);
  }
  const row = data as Record<string, unknown>;
  const answerRaw = typeof row.answer === "string" ? row.answer.trim() : "";
  const answer =
    answerRaw.toLowerCase() === "yes" ? "Yes" : answerRaw.toLowerCase() === "no" ? "No" : null;

  if (typeof row.workWithEnglishTeam === "boolean") {
    return {
      answer: answer ?? (row.workWithEnglishTeam ? "Yes" : "No"),
      workWithEnglishTeam: row.workWithEnglishTeam,
    };
  }

  if (answer) {
    return {
      answer,
      workWithEnglishTeam: answer === "Yes",
    };
  }

  throw new ApiError("English-team check returned an invalid model answer.", 502);
}

function buildBody(input: EnglishTeamCheckInput): { jobTitle: string; jobDescription: string } {
  return {
    jobTitle: input.jobTitle?.trim() ?? "",
    jobDescription: input.jobDescription?.trim() ?? "",
  };
}

async function fetchDirect(
  body: { jobTitle: string; jobDescription: string },
  authToken: string,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(`${API_BASE_URL}/jobs/check/english-team`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function fetchBff(
  body: { jobTitle: string; jobDescription: string },
  authToken: string,
  signal?: AbortSignal
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (isUserApiKey(authToken)) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return fetch("/api/jobs/check/english-team", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
    signal,
  });
}

/** POST /jobs/check/english-team — same AI auth pattern as Job Check. */
export async function checkEnglishTeam(
  input: EnglishTeamCheckInput,
  signal?: AbortSignal
): Promise<EnglishTeamCheckResult> {
  const body = buildBody(input);
  if (!body.jobTitle && !body.jobDescription) {
    throw new ApiError("Job title or job description is required.", 400);
  }

  const authToken = await resolveAiAuthToken();

  let response: Response;
  try {
    response = await fetchDirect(body, authToken, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (!isNetworkFetchError(err)) throw err;
    response = await fetchBff(body, authToken, signal);
  }

  if (!response.ok && response.status >= 500) {
    try {
      const fallback = await fetchBff(body, authToken, signal);
      if (fallback.ok || fallback.status < 500) {
        response = fallback;
      }
    } catch {
      // keep original response
    }
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  const data = await response.json().catch(() => null);
  return parseResult(data);
}
