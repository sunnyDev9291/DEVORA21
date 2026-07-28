import {
  normalizeJobUrl,
  parseJobPostingHtml,
} from "@/lib/job-link-import";

export const runtime = "nodejs";

/** Fetch a public job URL and extract title / company / description (no AI). */
export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeJobUrl(body.url ?? "");
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid job URL." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Devora21JobImport/1.0; +https://devora21.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      return Response.json(
        {
          error: `Could not open that link (${upstream.status}). Try pasting the job description instead.`,
        },
        { status: 502 }
      );
    }

    const html = await upstream.text();
    const posting = parseJobPostingHtml(html, url);
    return Response.json(posting);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to import job from link.";
    return Response.json({ error: message }, { status: 502 });
  }
}
