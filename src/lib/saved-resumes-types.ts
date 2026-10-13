export type SavedResumeArchive = {
  id: string;
  /** ISO 8601 UTC — when the application / bid was saved */
  bidAt: string;
  jobTitle: string;
  companyName: string;
  /**
   * Full JD text. Omitted from lean list responses — fetch via
   * GET /resume/archives/:id/job-description when the user opens JD.
   */
  jobDescription?: string;
  /** True when a JD exists server-side even if jobDescription is not in the list payload. */
  hasJobDescription?: boolean;
  resumeFileName: string;
  pdfFileName?: string;
};

export type SavedResumeListResponse = {
  items: SavedResumeArchive[];
};

export type SavedResumeJobDescriptionResponse = {
  id: string;
  jobDescription: string;
};
