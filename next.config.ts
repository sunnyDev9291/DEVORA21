import type { NextConfig } from "next";

const upstreamApi = (
  process.env.BACKEND_API_URL?.trim() ||
  (process.env.NEXT_PUBLIC_API_BASE_URL?.trim().startsWith("http")
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
    : "") ||
  "https://api.devora21.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["react-hook-form", "zod"],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Same-origin /backend → api.devora21.com so browser cookies are first-party.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${upstreamApi}/:path*`,
      },
    ];
  },
  // Retired Super Admin Application Q&A UI — keep bookmarks working.
  async redirects() {
    return [
      {
        source: "/super-admin/application-qa",
        destination: "/super-admin",
        permanent: true,
      },
      {
        source: "/super-admin/application-qa/:path*",
        destination: "/super-admin",
        permanent: true,
      },
      // Retired Super Admin rrweb session replay — keep bookmarks working.
      {
        source: "/super-admin/rrweb-sessions",
        destination: "/super-admin/application-captures",
        permanent: true,
      },
      {
        source: "/super-admin/rrweb-sessions/:path*",
        destination: "/super-admin/application-captures",
        permanent: true,
      },
    ];
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
    "/api/resume/generate/finalize": ["./assets/starting resumes/**/*"],
    "/api/resume/generate/status": ["./assets/starting resumes/**/*"],
  },
  serverExternalPackages: ["pizzip"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
