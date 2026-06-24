"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function RequireResumeBuilder({ children }: { children: ReactNode }) {
  return <AuthGuard requireResumeBuilder>{children}</AuthGuard>;
}
