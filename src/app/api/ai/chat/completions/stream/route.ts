import { BACKEND_API_URL } from "@/lib/api-base-url";
import { isUserApiKey } from "@/lib/user-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamBody = {
  messages?: Array<{ role?: string; content?: string }>;
  maxTokens?: number;
  jsonObject?: boolean;
  userId?: string;
  jobTitle?: string;
  jobDescription?: string;
};

async function readUpstreamError(response: Response): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return {
      status: response.status,
      body: {
        error: `AI backend error (${response.status}): ${response.statusText}`,
      },
    };
  }
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>;
    return { status: response.status, body: parsed };
  } catch {
    return {
      status: response.status,
      body: { error: detail },
    };
  }
}

/**
 * Same-origin BFF for Claude stream.
 * Attaches AI_INTERNAL_API_KEY server-side and forwards userId / X-User-Id
 * so the backend can apply the saved profile prompt (no CORS header loss).
 */
export async function POST(req: Request) {
  let body: StreamBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages are required." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const authHeader = req.headers.get("authorization")?.trim() || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const usingUserKey = isUserApiKey(bearer);
  const internalKey = process.env.AI_INTERNAL_API_KEY?.trim() || "";

  if (!usingUserKey && !internalKey) {
    return Response.json(
      {
        error:
          "AI backend is not configured. Set AI_INTERNAL_API_KEY on the server, or connect a dv21_ API key.",
      },
      { status: 500 }
    );
  }

  if (!usingUserKey && !userId) {
    return Response.json(
      {
        error:
          "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate.",
      },
      { status: 401 }
    );
  }

  if (!BACKEND_API_URL) {
    return Response.json(
      { error: "AI backend is not configured. Set BACKEND_API_URL on the server." },
      { status: 500 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/plain",
    Authorization: `Bearer ${usingUserKey ? bearer : internalKey}`,
  };
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.Cookie = cookie;
  }

  const upstreamBody: Record<string, unknown> = {
    messages,
    maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : 4096,
    jsonObject: Boolean(body.jsonObject),
  };
  if (userId) {
    upstreamBody.userId = userId;
  }
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  if (jobTitle) upstreamBody.jobTitle = jobTitle;
  if (jobDescription) upstreamBody.jobDescription = jobDescription;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API_URL}/ai/chat/completions/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamBody),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI backend.";
    return Response.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    const { status, body: errorBody } = await readUpstreamError(upstream);
    const message =
      (typeof errorBody.error === "string" && errorBody.error) ||
      (typeof errorBody.message === "string" && errorBody.message) ||
      `AI backend error (${status}).`;
    return Response.json(
      {
        ...errorBody,
        error: message,
        message:
          typeof errorBody.message === "string" ? errorBody.message : message,
      },
      { status }
    );
  }

  if (!upstream.body) {
    return Response.json({ error: "No response stream from AI backend." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
