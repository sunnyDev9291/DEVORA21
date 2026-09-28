/** Country tabs in the job crawl Google Sheet (must match sheet tab names exactly). */
export const JOB_SHEET_COUNTRIES = [
  "Brazil",
  "Argentina",
  "Colombia",
  "Dominican Republic",
  "Other",
] as const;

export type JobSheetCountry = (typeof JOB_SHEET_COUNTRIES)[number];

export function isJobSheetCountry(value: string): value is JobSheetCountry {
  return (JOB_SHEET_COUNTRIES as readonly string[]).includes(value);
}

export const DEFAULT_JOB_SHEET_COUNTRY: JobSheetCountry = "Argentina";

/** Sheet header row — keep in sync with the Google Sheet. */
export const JOB_SHEET_HEADERS = [
  "No",
  "Date",
  "Day_Count",
  "Country",
  "Job_Platform",
  "Job_URL",
] as const;
