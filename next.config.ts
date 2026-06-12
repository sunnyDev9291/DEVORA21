import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Ship the resume templates folder with the serverless functions so the
  // /api/templates routes can read it at runtime (e.g. on Netlify).
  outputFileTracingIncludes: {
    "/api/templates": ["./assets/starting resumes/**/*"],
    "/api/templates/file": ["./assets/starting resumes/**/*"],
    "/api/resume": ["./assets/starting resumes/**/*"],
  },
  serverExternalPackages: ["pizzip"],
};

export default nextConfig;
