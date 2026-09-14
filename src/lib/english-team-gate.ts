/** Shared English-team gate for resume generation flows. */

export const ENGLISH_TEAM_REQUIRED_CODE = "ENGLISH_TEAM_REQUIRED" as const;

export const ENGLISH_TEAM_REQUIRED_MESSAGE =
  "This job does not appear to require working with an English / US / global team. Resume generation was blocked.";

export type EnglishTeamRequiredPayload = {
  code: typeof ENGLISH_TEAM_REQUIRED_CODE;
  answer: "No";
  workWithEnglishTeam: false;
  message: string;
};

export class EnglishTeamRequiredError extends Error {
  readonly code = ENGLISH_TEAM_REQUIRED_CODE;
  readonly answer = "No" as const;
  readonly workWithEnglishTeam = false;
  readonly status: number;

  constructor(message = ENGLISH_TEAM_REQUIRED_MESSAGE, status = 422) {
    super(message.trim() || ENGLISH_TEAM_REQUIRED_MESSAGE);
    this.name = "EnglishTeamRequiredError";
    this.status = status;
  }
}

export function isEnglishTeamRequiredError(err: unknown): err is EnglishTeamRequiredError {
  return err instanceof EnglishTeamRequiredError;
}

function readMessage(data: Record<string, unknown>): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return ENGLISH_TEAM_REQUIRED_MESSAGE;
}

/** Detect gate from a parsed JSON body (HTTP or poll payload). */
export function parseEnglishTeamRequired(
  data: unknown,
  status?: number
): EnglishTeamRequiredError | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const code = typeof row.code === "string" ? row.code.trim() : "";
  if (code !== ENGLISH_TEAM_REQUIRED_CODE) return null;
  return new EnglishTeamRequiredError(readMessage(row), status ?? 422);
}

/** Parse Response text/JSON and throw EnglishTeamRequiredError when gated. */
export async function throwIfEnglishTeamRequiredResponse(response: Response): Promise<void> {
  if (response.ok) return;

  const detail = await response.clone().text().catch(() => "");
  if (!detail) return;

  try {
    const parsed = JSON.parse(detail) as unknown;
    const gated = parseEnglishTeamRequired(parsed, response.status);
    if (gated) throw gated;
  } catch (err) {
    if (isEnglishTeamRequiredError(err)) throw err;
  }
}

export function parseEnglishTeamRequiredFromUnknown(
  data: unknown,
  status?: number
): EnglishTeamRequiredError | null {
  return parseEnglishTeamRequired(data, status);
}
