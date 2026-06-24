import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Ship the resume templates folder with the serverless functions so the
  // /api/templates routes can read it at runtime (e.g. on Netlify).
  outputFileTracingIncludes: {
    "/api/templates": ["./assets/starting resumes/**/*"],
    "/api/templates/file": ["./assets/starting resumes/**/*"],
    "/api/prompts": ["./assets/Prompts/**/*"],
    "/api/prompts/file": ["./assets/Prompts/**/*"],
    "/api/resume": ["./assets/starting resumes/**/*"],
    "/api/resume/stream": ["./assets/starting resumes/**/*"],
    "/api/resume/build": ["./assets/starting resumes/**/*"],
    "/api/resume/generate/start": ["./assets/starting resumes/**/*", "./assets/Prompts/**/*"],
    "/api/resume/generate/status": ["./assets/starting resumes/**/*"],
  },
  serverExternalPackages: ["pizzip"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
