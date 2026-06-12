export type ResumeExperience = {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
};

export type GeneratedResumeContent = {
  summary: string;
  skills: string;
  experiences: ResumeExperience[];
};

export type ResumeGenerateResponse = {
  content: GeneratedResumeContent;
  templateName: string;
  docxBase64: string;
  fileName: string;
};
