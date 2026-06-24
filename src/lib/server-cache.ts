import { isNetlifyRuntime } from "@/lib/netlify-runtime";

/** Default TTL for AI-derived caches (template parse, JD keywords). */
export const SERVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_STORE_NAME = "devora21-cache";
const memory = new Map<string, { value: unknown; expiresAt: number }>();

function cacheKey(key: string): string {
  return `cache:${key}`;
}

function pruneMemory() {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: CACHE_STORE_NAME, consistency: "strong" });
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const now = Date.now();

  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    const entry = (await store.get(cacheKey(key), { type: "json" })) as {
      value: T;
      expiresAt: number;
    } | null;
    if (!entry || entry.expiresAt <= now) {
      if (entry) await store.delete(cacheKey(key));
      return null;
    }
    return entry.value;
  }

  pruneMemory();
  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= now) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function setCachedValue<T>(
  key: string,
  value: T,
  ttlMs = SERVER_CACHE_TTL_MS
): Promise<void> {
  const entry = { value, expiresAt: Date.now() + ttlMs };

  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.setJSON(cacheKey(key), entry);
    return;
  }

  pruneMemory();
  memory.set(key, entry);
}
