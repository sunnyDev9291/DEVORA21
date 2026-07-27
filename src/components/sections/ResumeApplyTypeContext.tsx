"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ResumeApplyType = "linkedin-easy-apply" | "apply";

type ResumeApplyTypeContextValue = {
  applyType: ResumeApplyType;
  setApplyType: (value: ResumeApplyType) => void;
};

const ResumeApplyTypeContext = createContext<ResumeApplyTypeContextValue | null>(null);

export function ResumeApplyTypeProvider({ children }: { children: ReactNode }) {
  const [applyType, setApplyType] = useState<ResumeApplyType>("linkedin-easy-apply");
  const value = useMemo(() => ({ applyType, setApplyType }), [applyType]);
  return <ResumeApplyTypeContext.Provider value={value}>{children}</ResumeApplyTypeContext.Provider>;
}

export function useResumeApplyType() {
  const ctx = useContext(ResumeApplyTypeContext);
  if (!ctx) {
    throw new Error("useResumeApplyType must be used within ResumeApplyTypeProvider");
  }
  return ctx;
}
