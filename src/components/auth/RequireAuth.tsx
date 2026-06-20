"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function RequireAuth({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
