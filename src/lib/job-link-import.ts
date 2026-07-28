/** Decode common HTML entities for scraped plain text. */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/(div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n{3,}/g, "\n\n")
  );
}

function metaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return "";
}

function extractJsonLdJob(html: string): {
  title?: string;
  company?: string;
  description?: string;
} | null {
  const blocks = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!blocks) return null;

  for (const block of blocks) {
    const raw = block.replace(/<\/?script[^>]*>/gi, "").trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const queue = [...nodes];

      while (queue.length) {
        const node = queue.shift() as Record<string, unknown> | undefined;
        if (!node || typeof node !== "object") continue;

        const type = node["@type"];
        const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
        if (types.some((t) => /jobposting/i.test(t))) {
          const org = node.hiringOrganization as Record<string, unknown> | string | undefined;
          const company =
            typeof org === "string"
              ? org
              : typeof org?.name === "string"
                ? org.name
                : "";
          const description =
            typeof node.description === "string" ? stripTags(node.description) : "";
          return {
            title: typeof node.title === "string" ? decodeEntities(node.title) : undefined,
            company: company ? decodeEntities(company) : undefined,
            description: description || undefined,
          };
        }

        if (Array.isArray(node["@graph"])) {
          queue.push(...(node["@graph"] as Record<string, unknown>[]));
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return null;
}

function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : "";
}

export type ImportedJobPosting = {
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
};

export function parseJobPostingHtml(html: string, sourceUrl: string): ImportedJobPosting {
  const jsonLd = extractJsonLdJob(html);
  const title =
    jsonLd?.title ||
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title") ||
    extractH1(html) ||
    "";
  const company =
    jsonLd?.company ||
    metaContent(html, "og:site_name") ||
    "";
  const description =
    jsonLd?.description ||
    metaContent(html, "og:description") ||
    metaContent(html, "description") ||
    "";

  if (!title.trim() && !description.trim()) {
    throw new Error(
      "Could not find a job title or description on that page. Paste the posting manually."
    );
  }

  return {
    title: title.trim(),
    company: company.trim(),
    description: description.trim(),
    sourceUrl,
  };
}

export function normalizeJobUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Job link is required.");
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enter a valid job URL.");
  }
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error("Job link must be an http(s) URL.");
  }
  return url.toString();
}
