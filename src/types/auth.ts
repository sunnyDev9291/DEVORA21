import type { JobCrawlPlatform } from "@/lib/builtin-crawl-types";

export type ProfileListingUrls = Partial<Record<JobCrawlPlatform, string>>;

export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  resumeBuilderEnabled?: boolean;
  resumeTemplateFileName?: string;
  promptFileName?: string;
  /** Per-user job crawl listing URLs (Built In, HiringCafe, Workable, Working Nomads). */
  listingUrls?: ProfileListingUrls;
  createdAt?: string;
}

export type UserProfileUpdate = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  resumeTemplateFileName?: string;
  customPrompt?: string;
  onboardingCompleted?: boolean;
  listingUrls?: ProfileListingUrls;
};

export type OnboardingCompletePayload = {
  firstName: string;
  lastName: string;
  avatar?: string;
  resumeTemplateFileName?: string;
  customPrompt?: string;
};

export interface AuthResponse {
  user: User;
  message?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
