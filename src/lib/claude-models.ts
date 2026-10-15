import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";

/** Default Claude model for resume generation (Sonnet 4.6). */
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

export const CLAUDE_MODEL_STORAGE_KEY = "dv21:resume-claude-model";

export type ClaudeModelFamily = "haiku" | "sonnet" | "opus";

export type ClaudeModelOption = {
  id: string;
  label: string;
  family: ClaudeModelFamily;
  description?: string;
  /** Preferred default within its family when API does not mark one. */
  isDefault?: boolean;
};

export type ClaudeModelsResponse = {
  models: ClaudeModelOption[];
  defaultModelId?: string;
};

/** Offline fallback when GET /ai/models is unavailable. */
export const FALLBACK_CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    family: "haiku",
    description: "Fastest · lower cost",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Sonnet 4.5",
    family: "sonnet",
    description: "Balanced quality and speed",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    family: "sonnet",
    description: "Recommended for resume drafting",
    isDefault: true,
  },
  {
    id: "claude-opus-4-5",
    label: "Opus 4.5",
    family: "opus",
    description: "Highest quality · slower",
  },
  {
    id: "claude-opus-4-6",
    label: "Opus 4.6",
    family: "opus",
    description: "Highest quality · slower",
  },
];

const FAMILY_ORDER: ClaudeModelFamily[] = ["haiku", "sonnet", "opus"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferFamily(id: string, explicit?: string): ClaudeModelFamily {
  const key = `${explicit || ""} ${id}`.toLowerCase();
  if (key.includes("haiku")) return "haiku";
  if (key.includes("opus")) return "opus";
  return "sonnet";
}

function normalizeModel(raw: unknown): ClaudeModelOption | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    asString(row.id) ||
    asString(row.model) ||
    asString(row.modelId) ||
    asString(row.model_id);
  if (!id) return null;

  const family = inferFamily(id, asString(row.family) || asString(row.tier));
  const label =
    asString(row.label) ||
    asString(row.name) ||
    asString(row.displayName) ||
    asString(row.display_name) ||
    id;

  return {
    id,
    label,
    family,
    description: asString(row.description) || asString(row.subtitle) || undefined,
    isDefault: Boolean(row.isDefault || row.is_default || row.default),
  };
}

function sortModels(models: ClaudeModelOption[]): ClaudeModelOption[] {
  return [...models].sort((a, b) => {
    const familyDiff = FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family);
    if (familyDiff !== 0) return familyDiff;
    return a.label.localeCompare(b.label);
  });
}

export function resolveDefaultClaudeModel(
  models: ClaudeModelOption[],
  preferredId?: string
): string {
  const preferred = preferredId?.trim();
  if (preferred && models.some((m) => m.id === preferred)) return preferred;

  const marked = models.find((m) => m.isDefault);
  if (marked) return marked.id;

  if (models.some((m) => m.id === DEFAULT_CLAUDE_MODEL)) return DEFAULT_CLAUDE_MODEL;

  const sonnet = models.find((m) => m.family === "sonnet");
  return sonnet?.id || models[0]?.id || DEFAULT_CLAUDE_MODEL;
}

export function readStoredClaudeModel(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CLAUDE_MODEL_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function storeClaudeModel(modelId: string): void {
  if (typeof window === "undefined") return;
  const id = modelId.trim();
  if (!id) return;
  try {
    window.localStorage.setItem(CLAUDE_MODEL_STORAGE_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

export function groupClaudeModelsByFamily(
  models: ClaudeModelOption[]
): Array<{ family: ClaudeModelFamily; label: string; models: ClaudeModelOption[] }> {
  const labels: Record<ClaudeModelFamily, string> = {
    haiku: "Haiku",
    sonnet: "Sonnet",
    opus: "Opus",
  };
  return FAMILY_ORDER.map((family) => ({
    family,
    label: labels[family],
    models: models.filter((m) => m.family === family),
  })).filter((group) => group.models.length > 0);
}

/**
 * Load Claude models from the backend.
 * Tries several common list endpoints; falls back to a static catalog.
 */
export async function fetchClaudeModels(signal?: AbortSignal): Promise<ClaudeModelsResponse> {
  const candidates = [
    `${API_BASE_URL}/ai/models`,
    `${API_BASE_URL}/ai/claude/models`,
    `${API_BASE_URL}/ai/models/claude`,
  ];

  let lastError: Error | null = null;

  for (const url of candidates) {
    try {
      const res = await apiAuthFetch(
        url,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        },
        "auto"
      );

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        lastError = new Error(
          data.error || data.message || `Could not load models (${res.status}).`
        );
        if (res.status === 404 || res.status === 501) continue;
        continue;
      }

      const rawList = Array.isArray(data.models)
        ? data.models
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
            ? data.data
            : [];

      const models = sortModels(
        rawList.map(normalizeModel).filter((m): m is ClaudeModelOption => Boolean(m))
      );

      if (!models.length) {
        lastError = new Error("Model list was empty.");
        continue;
      }

      const defaultModelId = resolveDefaultClaudeModel(
        models,
        asString(data.defaultModelId) ||
          asString(data.default_model_id) ||
          asString(data.defaultModel) ||
          asString(data.default)
      );

      return { models, defaultModelId };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError && typeof console !== "undefined") {
    console.warn("[claude-models] Using fallback catalog:", lastError.message);
  }

  const models = sortModels(FALLBACK_CLAUDE_MODELS);
  return {
    models,
    defaultModelId: resolveDefaultClaudeModel(models, DEFAULT_CLAUDE_MODEL),
  };
}
