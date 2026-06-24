import { readFile } from "fs/promises";
import path from "path";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export async function resolveTemplateBuffer(input: {
  templateName?: string;
  templateBase64?: string;
}): Promise<{ buffer: Buffer; templateName: string }> {
  const base64 = input.templateBase64?.trim();
  if (base64) {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      throw new Error("Invalid template data.");
    }
    const rawName = input.templateName?.trim() || "resume";
    const templateName = path.basename(rawName).replace(/\.docx$/i, "");
    return { buffer, templateName };
  }

  const templateInput = input.templateName?.trim();
  if (!templateInput) {
    throw new Error("templateName or templateBase64 is required.");
  }

  const safeName = path.basename(
    templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`,
  );
  const filePath = path.join(TEMPLATES_DIR, safeName);
  const templateName = safeName.replace(/\.docx$/i, "");

  if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
    throw new Error("Invalid template.");
  }

  const buffer = await readFile(filePath);
  return { buffer, templateName };
}
