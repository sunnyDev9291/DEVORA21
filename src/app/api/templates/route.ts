import { readdir, stat } from "fs/promises";
import path from "path";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export const runtime = "nodejs";
// Always read the folder fresh — never cache the listing.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Source of truth: the resume templates folder in the repo.

export type TemplateInfo = {
  id: string;
  name: string;
  file: string;
  modifiedAt: number;
};

export async function GET() {
  try {
    const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
    const docxFiles = entries.filter(
      (e) => e.isFile() && e.name.toLowerCase().endsWith(".docx") && !e.name.startsWith("~$")
    );

    const templates: TemplateInfo[] = await Promise.all(
      docxFiles.map(async (e) => {
        const filePath = path.join(TEMPLATES_DIR, e.name);
        const { mtimeMs } = await stat(filePath);
        return {
          id: e.name,
          name: e.name.replace(/\.docx$/i, ""),
          file: `/api/templates/file?name=${encodeURIComponent(e.name)}`,
          modifiedAt: mtimeMs,
        };
      })
    );

    templates.sort((a, b) => a.name.localeCompare(b.name));

    const latest = [...templates].sort((a, b) => b.modifiedAt - a.modifiedAt)[0] ?? null;

    return Response.json(
      { templates, latest },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return Response.json(
      {
        templates: [],
        latest: null,
        error: err instanceof Error ? err.message : "Could not read templates folder.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
