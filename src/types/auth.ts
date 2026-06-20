export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  resumeTemplateFileName?: string;
  promptFileName?: string;
  createdAt?: string;
}

export type UserProfileUpdate = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  resumeTemplateFileName?: string;
  customPrompt?: string;
  onboardingCompleted?: boolean;
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
