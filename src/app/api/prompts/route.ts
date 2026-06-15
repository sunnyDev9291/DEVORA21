import { readdir, stat } from "fs/promises";
import path from "path";
import { PROMPTS_DIR } from "@/lib/prompts-dir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export type PromptInfo = {
  id: string;
  name: string;
  file: string;
  modifiedAt: number;
};

export async function GET() {
  try {
    const entries = await readdir(PROMPTS_DIR, { withFileTypes: true });
    const textFiles = entries.filter(
      (e) => e.isFile() && e.name.toLowerCase().endsWith(".txt") && !e.name.startsWith("~$")
    );

    const prompts: PromptInfo[] = await Promise.all(
      textFiles.map(async (e) => {
        const filePath = path.join(PROMPTS_DIR, e.name);
        const { mtimeMs } = await stat(filePath);
        return {
          id: e.name,
          name: e.name.replace(/\.txt$/i, ""),
          file: `/api/prompts/file?name=${encodeURIComponent(e.name)}`,
          modifiedAt: mtimeMs,
        };
      })
    );

    prompts.sort((a, b) => a.name.localeCompare(b.name));

    return Response.json(
      { prompts },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return Response.json(
      {
        prompts: [],
        error: err instanceof Error ? err.message : "Could not read prompts folder.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
