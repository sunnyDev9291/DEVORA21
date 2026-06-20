const MAX_BYTES = 512 * 1024;
const MAX_DIMENSION = 512;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type AvatarFileResult = {
  dataUrl: string;
  fileName: string;
};

export function isAcceptedAvatarType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image file."));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image."))),
      type,
      quality,
    );
  });
}

async function compressDataUrl(dataUrl: string, mimeType: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(img, 0, 0, width, height);

  const outputType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  let quality = 0.92;
  let blob = await canvasToBlob(canvas, outputType, quality);

  while (blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, outputType, quality);
  }

  if (blob.size > MAX_BYTES) {
    throw new Error("Image is too large. Use a photo under 512 KB or paste an image URL.");
  }

  return readFileAsDataUrl(new File([blob], "avatar", { type: outputType }));
}

/** Read an image file, resize/compress, return a data URL for profile storage. */
export async function processAvatarFile(file: File): Promise<AvatarFileResult> {
  if (!isAcceptedAvatarType(file.type)) {
    throw new Error("Use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const raw = await readFileAsDataUrl(file);
  const dataUrl = await compressDataUrl(raw, file.type);

  return { dataUrl, fileName: file.name };
}
