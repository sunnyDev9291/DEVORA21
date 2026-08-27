import { BACKEND_API_URL } from "@/lib/api-base-url";
import { isUserApiKey } from "@/lib/user-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobCheckStreamBody = {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
};

async function readUpstreamError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `Job Check backend error (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
  }
}

/** Same-origin BFF for Job Check stream when direct api.devora21.com call fails. */
export async function POST(req: Request) {
  let body: JobCheckStreamBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const companyName = body.companyName?.trim() ?? "";
  if (!companyName) {
    return Response.json({ error: "Company name is required." }, { status: 400 });
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
    Accept: "text/plain",
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
    upstream = await fetch(`${BACKEND_API_URL}/jobs/check/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jobTitle: body.jobTitle?.trim() ?? "",
        companyName,
        jobDescription: body.jobDescription?.trim() ?? "",
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Job Check backend.";
    return Response.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json({ error: await readUpstreamError(upstream) }, { status: upstream.status });
  }

  if (!upstream.body) {
    return Response.json({ error: "No response stream from Job Check backend." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
