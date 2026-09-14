import { BACKEND_API_URL } from "@/lib/api-base-url";
import { isUserApiKey } from "@/lib/user-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnglishTeamBody = {
  jobTitle?: string;
  jobDescription?: string;
};

async function readUpstreamError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `English-team check backend error (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
  }
}

/** Same-origin BFF for English-team check when direct api.devora21.com call fails. */
export async function POST(req: Request) {
  let body: EnglishTeamBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobTitle = body.jobTitle?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  if (!jobTitle && !jobDescription) {
    return Response.json(
      { error: "Job title or job description is required." },
      { status: 400 }
    );
  }

  if (!BACKEND_API_URL) {
    return Response.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL on the server." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization")?.trim() || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const usingUserKey = isUserApiKey(bearer);
  const internalKey = process.env.AI_INTERNAL_API_KEY?.trim() || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (usingUserKey) {
    headers.Authorization = `Bearer ${bearer}`;
  } else if (internalKey) {
    headers.Authorization = `Bearer ${internalKey}`;
  }

  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.Cookie = cookie;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API_URL}/jobs/check/english-team`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobTitle, jobDescription }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach English-team check backend.";
    return Response.json({ error: message }, { status: 502 });
  }

  const text = await upstream.text().catch(() => "");
  if (!upstream.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error || parsed.message || text;
    } catch {
      message = text || (await readUpstreamError(upstream));
    }
    return Response.json(
      { error: message || `English-team check failed (${upstream.status}).` },
      { status: upstream.status }
    );
  }

  try {
    const data = JSON.parse(text) as unknown;
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "English-team check returned invalid JSON." },
      { status: 502 }
    );
  }
}
