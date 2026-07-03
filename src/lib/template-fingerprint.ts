/** Stable fingerprint for uploaded template bytes (base64 payload). */
export function fingerprintTemplateBase64(base64?: string): string {
  const trimmed = base64?.trim() ?? "";
  if (!trimmed) return "";

  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `${trimmed.length.toString(36)}:${(hash >>> 0).toString(16)}`;
}

export const PROFILE_TEMPLATE_UPDATED_EVENT = "devora21-profile-template-updated";
