import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEMPLATES_DIR = path.join(process.cwd(), "assets", "starting resumes");
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";

  // Sanitize: strip any path components, must be a .docx
  const safeName = path.basename(name);
  if (!safeName || !safeName.toLowerCase().endsWith(".docx") || safeName.startsWith("~$")) {
    return Response.json({ error: "Invalid template name." }, { status: 400 });
  }

  const filePath = path.join(TEMPLATES_DIR, safeName);
  // Ensure the resolved path is still inside the templates folder
  if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return Response.json({ error: "Template not found." }, { status: 404 });
  }
}
