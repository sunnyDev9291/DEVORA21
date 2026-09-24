import crypto from "crypto";
import { JOB_SHEET_HEADERS, type JobSheetCountry } from "@/lib/job-sheet-countries";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type SheetJobRowInput = {
  platform: string;
  jobUrl: string;
};

export type AppendJobsResult = {
  country: JobSheetCountry;
  added: number;
  skippedDuplicates: number;
  nextNo: number;
};

type ServiceAccountCreds = {
  clientEmail: string;
  privateKey: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function loadServiceAccount(): ServiceAccountCreds {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (clientEmail && privateKey) {
    return {
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  throw new Error(
    "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (or EMAIL + PRIVATE_KEY) and GOOGLE_SHEETS_SPREADSHEET_ID."
  );
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set.");
  }
  return id;
}

function createServiceAccountJwt(creds: ServiceAccountCreds): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(creds.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const creds = loadServiceAccount();
  const assertion = createServiceAccountJwt(creds);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Failed to authenticate with Google Sheets."
    );
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

function sheetRange(country: JobSheetCountry, a1 = "A:F"): string {
  // Sheet tab names with spaces need single quotes.
  return `'${country.replace(/'/g, "''")}'!${a1}`;
}

async function sheetsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const spreadsheetId = getSpreadsheetId();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `Google Sheets request failed (${response.status}).`);
  }

  return data;
}

/** Sheet date style matching existing rows: 2026/9/18 (no zero-padding). */
export function formatSheetDate(date = new Date(), timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}/${month}/${day}`;
}

function parseNo(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Append checked crawl jobs to the country tab.
 * Columns: No | Date | Day_Count | Country | Job_Platform | Job_URL
 */
export async function appendJobsToCountrySheet(
  country: JobSheetCountry,
  jobs: SheetJobRowInput[]
): Promise<AppendJobsResult> {
  const uniqueJobs: SheetJobRowInput[] = [];
  const seenIncoming = new Set<string>();
  for (const job of jobs) {
    const url = job.jobUrl.trim();
    if (!url) continue;
    const key = normalizeUrl(url);
    if (seenIncoming.has(key)) continue;
    seenIncoming.add(key);
    uniqueJobs.push({ platform: job.platform.trim() || "Unknown", jobUrl: url });
  }

  if (uniqueJobs.length === 0) {
    throw new Error("No valid job URLs to add.");
  }

  const existing = await sheetsFetch<{ values?: string[][] }>(
    `/values/${encodeURIComponent(sheetRange(country))}?majorDimension=ROWS`
  );

  const rows = existing.values ?? [];
  const dataRows =
    rows.length > 0 &&
    String(rows[0]?.[0] ?? "")
      .trim()
      .toLowerCase() === JOB_SHEET_HEADERS[0].toLowerCase()
      ? rows.slice(1)
      : rows;

  let maxNo = 0;
  const existingUrls = new Set<string>();
  const today = formatSheetDate();
  let todayCount = 0;

  for (const row of dataRows) {
    maxNo = Math.max(maxNo, parseNo(row[0]));
    const dateCell = String(row[1] ?? "").trim();
    if (dateCell === today) todayCount += 1;
    const url = String(row[5] ?? "").trim();
    if (url) existingUrls.add(normalizeUrl(url));
  }

  const toAdd = uniqueJobs.filter((job) => !existingUrls.has(normalizeUrl(job.jobUrl)));
  const skippedDuplicates = uniqueJobs.length - toAdd.length;

  if (toAdd.length === 0) {
    return {
      country,
      added: 0,
      skippedDuplicates,
      nextNo: maxNo,
    };
  }

  const values: (string | number)[][] = [];
  let nextNo = maxNo;
  let dayCount = todayCount;

  for (const job of toAdd) {
    nextNo += 1;
    dayCount += 1;
    values.push([nextNo, today, dayCount, country, job.platform, job.jobUrl]);
  }

  await sheetsFetch(
    `/values/${encodeURIComponent(sheetRange(country))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        majorDimension: "ROWS",
        values,
      }),
    }
  );

  return {
    country,
    added: toAdd.length,
    skippedDuplicates,
    nextNo,
  };
}
