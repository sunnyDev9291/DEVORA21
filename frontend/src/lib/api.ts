import axios, { AxiosError, isAxiosError } from "axios";
import type {
  AuthResponse,
  MessageResponse,
  User,
  ApiError,
} from "@/types/auth";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  console.warn("VITE_API_BASE_URL is not set. API requests will fail.");
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isAxiosError<ApiError>(error)) {
    const data = error.response?.data;
    if (data?.message) return data.message;
    if (data?.errors) {
      const first = Object.values(data.errors)[0];
      if (first?.[0]) return first[0];
    }
    if (error.response?.status === 401) return "Invalid email or password";
    if (error.response?.status === 403) return "You do not have permission to perform this action";
    if (error.response?.status === 404) return "Resource not found";
    if (error.response?.status === 422) return "Please check your input and try again";
    if (error.response?.status === 429) return "Too many requests. Please try again later";
    if (error.response?.status && error.response.status >= 500) {
      return "Server error. Please try again later";
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export const authApi = {
  getMe: () => api.get<User>("/auth/me"),

  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { name, email, password }),

  logout: () => api.post<MessageResponse>("/auth/logout"),

  forgotPassword: (email: string) =>
    api.post<MessageResponse>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post<MessageResponse>("/auth/reset-password", { token, password }),

  verifyEmail: (token: string) =>
    api.post<MessageResponse>("/auth/verify-email", { token }),
};

export function getOAuthUrl(provider: "google" | "microsoft"): string {
  return `${baseURL}/auth/${provider}`;
}

export type { AxiosError };
