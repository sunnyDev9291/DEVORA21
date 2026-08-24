export const runtime = "nodejs";

/**
 * Fast auth handoff for browser → api.devora21.com Job Check streams.
 * Same pattern as resume generate/start streamAuthToken.
 */
export async function POST() {
  const streamAuthToken = process.env.AI_INTERNAL_API_KEY?.trim() ?? "";
  if (!streamAuthToken) {
    return Response.json(
      {
        error:
          "AI backend is not configured. Connect a dv21_ API key, or set AI_INTERNAL_API_KEY on the server.",
      },
      { status: 503 }
    );
  }

  return Response.json({ streamAuthToken }, { headers: { "Cache-Control": "no-store" } });
}
