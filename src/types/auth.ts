export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified?: boolean;
  createdAt?: string;
}

export type UserProfileUpdate = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  resumeTemplateName?: string;
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
