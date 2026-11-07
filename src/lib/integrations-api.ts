import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import {
  getIntegrationKey,
  getIntegrationKeyHeader,
} from "@/lib/job-community-storage";

export type IntegrationProfile = {
  entity_id: string;
  first_name: string;
  last_name: string;
};

export type BidLogStatus = "sent" | "in_progress" | "hired" | "failed";

export type CreateBidLogBody = {
  profile_id: string;
  archive_id: string;
  job_url?: string;
  company?: string;
  position?: string;
  bidder_id?: string;
  status?: BidLogStatus;
  applied_at?: string;
  is_easy_apply?: boolean;
  tz_offset?: number;
  resume_title?: string;
  save_to_profile?: boolean;
  resume_id?: string;
  /** Default true on the API. Only send false if you want a 409 confirm step. */
  confirm_warnings?: boolean;
};

export type BidLogSummary = {
  entity_id: string;
  profile_name: string;
  company: string;
  position: string;
  job_url: string;
  status: string;
};

export type CreateBidLogSuccess = {
  success: true;
  message: string;
  bid_log: BidLogSummary;
  confirmed_warnings?: boolean;
  warnings?: string[];
};

export type CreateBidLogRequiresConfirmation = {
  success: false;
  requires_confirmation: true;
  warnings: string[];
};

export type IntegrationErrorBody = {
  success?: boolean;
  message?: string;
  error?: {
    message?: string;
    type?: string;
  };
  requires_confirmation?: boolean;
  warnings?: string[];
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function missingKeyError(): ApiError {
  return new ApiError(
    "Job Community integration key is missing. Add your bck_ key under My account.",
    401,
    { message: "Job Community integration key is missing" }
  );
}

function formatWarningText(warnings: unknown): string {
  if (!Array.isArray(warnings) || warnings.length === 0) return "";
  return warnings
    .map((w) => {
      if (typeof w === "string") return w.trim();
      if (w && typeof w === "object" && "message" in w) {
        const msg = (w as { message?: unknown }).message;
        return typeof msg === "string" ? msg.trim() : "";
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Devora API integration calls — cookie session + X-Integration-Key.
 * Never send the bck_ key to any host other than the Devora API base.
 */
async function integrationRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ res: Response; data: (T & IntegrationErrorBody) | null }> {
  if (!getIntegrationKey()) {
    throw missingKeyError();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...getIntegrationKeyHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await apiAuthFetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
    "cookie"
  );

  const data = await parseJson<T & IntegrationErrorBody>(res);
  return { res, data };
}

function throwIntegrationError(
  res: Response,
  data: IntegrationErrorBody | null,
  fallback: string
): never {
  const message =
    data?.error?.message ||
    data?.message ||
    fallback;

  throw new ApiError(message, res.status, { message });
}

export function isIntegrationKeyMissingError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const msg = `${error.message} ${error.data?.message ?? ""}`.toLowerCase();
  return (
    error.status === 401 &&
    (msg.includes("integration key") ||
      msg.includes("bck_") ||
      msg.includes("job community"))
  );
}

export function integrationSettingsHref(): string {
  return "/dashboard#job-community";
}

export const integrationsApi = {
  async listProfiles(): Promise<IntegrationProfile[]> {
    const { res, data } = await integrationRequest<{
      success?: boolean;
      profiles?: IntegrationProfile[];
    }>("/integrations/profiles", { method: "GET" });

    if (!res.ok) {
      throwIntegrationError(res, data, "Could not load Job Community profiles.");
    }

    return Array.isArray(data?.profiles) ? data.profiles : [];
  },

  async createBidLog(body: CreateBidLogBody): Promise<CreateBidLogSuccess> {
    const payload: CreateBidLogBody = {
      profile_id: body.profile_id.trim(),
      archive_id: body.archive_id.trim(),
    };
    const jobUrl = body.job_url?.trim();
    if (jobUrl) payload.job_url = jobUrl;
    if (body.company?.trim()) payload.company = body.company.trim();
    if (body.position?.trim()) payload.position = body.position.trim();
    if (body.bidder_id?.trim()) payload.bidder_id = body.bidder_id.trim();
    if (body.status) payload.status = body.status;
    if (body.applied_at?.trim()) payload.applied_at = body.applied_at.trim();
    if (typeof body.is_easy_apply === "boolean") payload.is_easy_apply = body.is_easy_apply;
    if (typeof body.tz_offset === "number") payload.tz_offset = body.tz_offset;
    if (body.resume_title?.trim()) payload.resume_title = body.resume_title.trim();
    if (body.resume_id?.trim()) payload.resume_id = body.resume_id.trim();
    if (typeof body.confirm_warnings === "boolean") {
      payload.confirm_warnings = body.confirm_warnings;
    }
    // Do not send save_to_profile (leave off). Do not send screenshots / job_posting_id / from_jobs.

    const { res, data } = await integrationRequest<CreateBidLogSuccess>(
      "/integrations/bid-logs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (res.status === 201 && data?.success && data.bid_log) {
      return {
        success: true,
        message: data.message || "Bid log created successfully.",
        bid_log: data.bid_log,
        confirmed_warnings: data.confirmed_warnings,
        warnings: data.warnings,
      };
    }

    if (res.status === 409 && data?.requires_confirmation) {
      const confirmMsg =
        formatWarningText(data.warnings) ||
        "Confirmation required before creating this bid log.";
      throw new ApiError(confirmMsg, 409, { message: confirmMsg });
    }

    throwIntegrationError(res, data, "Could not create bid log.");
  },

  formatWarnings(warnings: unknown): string {
    return formatWarningText(warnings);
  },
};
