import { readFile } from "fs/promises";
import path from "path";
import { PROMPTS_DIR } from "@/lib/prompts-dir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";

  const safeName = path.basename(name);
  if (!safeName || !safeName.toLowerCase().endsWith(".txt") || safeName.startsWith("~$")) {
    return Response.json({ error: "Invalid prompt name." }, { status: 400 });
  }

  const filePath = path.join(PROMPTS_DIR, safeName);
  if (!path.resolve(filePath).startsWith(path.resolve(PROMPTS_DIR))) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return Response.json(
      { name: safeName.replace(/\.txt$/i, ""), content },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return Response.json({ error: "Prompt not found." }, { status: 404 });
  }
}
