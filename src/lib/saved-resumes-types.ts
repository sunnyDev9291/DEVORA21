export type SavedResumeArchive = {
  id: string;
  /** ISO 8601 UTC — when the application / bid was saved */
  bidAt: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  resumeFileName: string;
  pdfFileName?: string;
};

export type SavedResumeListResponse = {
  items: SavedResumeArchive[];
};
