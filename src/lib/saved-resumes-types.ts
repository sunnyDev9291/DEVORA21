export type InterviewHistoryEntry = {
  round: number;
  /** ISO 8601 when that round’s download was recorded */
  downloadedAt: string;
};

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
  /** Completed interview downloads, chronological by round. */
  interviewHistory?: InterviewHistoryEntry[];
  /** Next round number to offer (1 when history empty). */
  nextInterviewRound?: number;
};

export type SavedResumeListResponse = {
  items: SavedResumeArchive[];
};

export type SavedResumeJobDescriptionResponse = {
  id: string;
  jobDescription: string;
};

export type InterviewRoundRecordResponse = {
  id: string;
  bidAt?: string;
  interviewHistory: InterviewHistoryEntry[];
  nextInterviewRound: number;
  recordedRound?: number;
  recordedAt?: string;
  /** Set when a round was removed (delete API). */
  deletedRound?: number;
};

/** Peer archive at the same company with completed interview rounds (read-only). */
export type OtherInterviewProgressItem = {
  id: string;
  profileId?: string;
  profileName?: string;
  profileEmail?: string;
  jobTitle: string;
  companyName: string;
  bidAt: string;
  interviewHistory: InterviewHistoryEntry[];
  nextInterviewRound: number;
};

export type OtherInterviewProgressResponse = {
  items: OtherInterviewProgressItem[];
  companyName: string;
};
