const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_PROMPT_BYTES = 512 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const PROMPT_EXTENSIONS = new Set(["txt", "md", "json"]);

export function validateDocxFile(file: File): void {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Resume template must be a .docx file.");
  }
  if (file.size > MAX_DOCX_BYTES) {
    throw new Error("Resume template must be under 10 MB.");
  }
}

export function validatePromptFile(file: File): void {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!PROMPT_EXTENSIONS.has(ext)) {
    throw new Error("Prompt file must be .txt, .md, or .json.");
  }
  if (file.size > MAX_PROMPT_BYTES) {
    throw new Error("Prompt file must be under 512 KB.");
  }
}

export function validateAvatarFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image file.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar must be under 5 MB.");
  }
}

export async function readPromptFile(file: File): Promise<string> {
  validatePromptFile(file);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const text = await file.text();

  if (ext === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Prompt JSON is not valid.");
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "content" in parsed &&
      typeof (parsed as { content: unknown }).content === "string"
    ) {
      return (parsed as { content: string }).content;
    }
    throw new Error('Prompt JSON must include a "content" string field.');
  }

  return text;
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function base64ToDocxBlob(base64: string): Blob {
  return new Blob([base64ToArrayBuffer(base64)], { type: DOCX_MIME });
}
