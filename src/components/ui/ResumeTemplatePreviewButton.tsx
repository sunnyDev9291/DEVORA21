"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { base64ToDocxBlob } from "@/lib/profile-file";
import { downloadBlob } from "@/lib/saved-resumes-api";

const DocxPreviewModal = dynamic(() => import("@/components/ui/DocxPreviewModal"), { ssr: false });

type ResumeTemplatePreviewButtonProps = {
  fileName: string;
  templateBase64?: string | null;
  templateFile?: File | null;
  className?: string;
  size?: "sm" | "md";
};

function resolveDownloadName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "resume.docx";
  return trimmed.toLowerCase().endsWith(".docx") ? trimmed : `${trimmed}.docx`;
}

export default function ResumeTemplatePreviewButton({
  fileName,
  templateBase64,
  templateFile,
  className = "",
  size = "md",
}: ResumeTemplatePreviewButtonProps) {
  const [open, setOpen] = useState(false);

  const blob = useMemo(() => {
    if (templateFile) return templateFile;
    if (templateBase64?.trim()) return base64ToDocxBlob(templateBase64);
    return null;
  }, [templateFile, templateBase64]);

  const downloadName = resolveDownloadName(fileName);
  const canPreview = Boolean(blob);
  const sizeClass =
    size === "sm"
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      : "inline-flex items-center gap-2 px-4 py-2 text-sm";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canPreview}
        className={`${sizeClass} rounded-xl font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      >
        <svg className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        View template
      </button>

      <DocxPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        title={downloadName}
        subtitle="Your uploaded resume template"
        blob={blob}
        fileName={downloadName}
        onDownload={() => {
          if (!blob) return;
          downloadBlob(blob, downloadName);
        }}
      />
    </>
  );
}
