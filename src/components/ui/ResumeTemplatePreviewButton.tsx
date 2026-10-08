"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { profileApi } from "@/lib/profile-api";
import { base64ToDocxBlob } from "@/lib/profile-file";
import { downloadBlob } from "@/lib/saved-resumes-api";

const DocxPreviewModal = dynamic(() => import("@/components/ui/DocxPreviewModal"), { ssr: false });
const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });

type ResumeTemplatePreviewButtonProps = {
  fileName: string;
  templateBase64?: string | null;
  templateFile?: File | null;
  /** When set (and no pending local file), preview uses backend DOCX→PDF. */
  templateId?: string | null;
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
  templateId,
  className = "",
  size = "md",
}: ResumeTemplatePreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFileName, setPdfFileName] = useState("resume-template.pdf");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [preferDocxFallback, setPreferDocxFallback] = useState(false);

  const docxBlob = useMemo(() => {
    if (templateFile) return templateFile;
    if (templateBase64?.trim()) return base64ToDocxBlob(templateBase64);
    return null;
  }, [templateFile, templateBase64]);

  const downloadName = resolveDownloadName(fileName);
  // A freshly picked File must never be replaced by the server's previously stored template PDF.
  const hasPendingLocalFile = Boolean(templateFile);
  const canUseBackendPdf = Boolean(templateId?.trim()) && !hasPendingLocalFile;
  const canPreview = Boolean(docxBlob || canUseBackendPdf);
  const usePdfPreview = canUseBackendPdf && Boolean(pdfBlob) && !preferDocxFallback;
  const sizeClass =
    size === "sm"
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      : "inline-flex items-center gap-2 px-4 py-2 text-sm";

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setPreferDocxFallback(false);
    setPdfError("");
    setPdfBlob(null);

    // Pending local upload → show that DOCX only (backend still has the old template).
    if (hasPendingLocalFile || !canUseBackendPdf) {
      setPdfLoading(false);
      setPreferDocxFallback(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setPdfLoading(true);
      try {
        const pdf = await profileApi.fetchResumeTemplatePreviewPdf(templateId ?? undefined);
        if (cancelled) return;
        setPdfBlob(pdf.blob);
        setPdfFileName(pdf.fileName);
      } catch (err) {
        if (cancelled) return;
        setPdfBlob(null);
        if (docxBlob) {
          setPreferDocxFallback(true);
          setPdfError("");
        } else {
          setPdfError((err as Error).message || "Could not load template preview.");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, templateId, docxBlob, hasPendingLocalFile, canUseBackendPdf]);

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

      {usePdfPreview || (open && canUseBackendPdf && (pdfLoading || pdfError) && !preferDocxFallback) ? (
        <PdfPreviewModal
          open={open}
          onClose={() => setOpen(false)}
          title={downloadName}
          subtitle="Template preview · backend PDF (stored template)"
          fileName={pdfFileName}
          blob={pdfBlob}
          waitingForPdf={pdfLoading}
          error={pdfError}
          onDownload={() => {
            if (docxBlob) {
              downloadBlob(docxBlob, downloadName);
              return;
            }
            if (pdfBlob) downloadBlob(pdfBlob, pdfFileName);
          }}
        />
      ) : (
        <DocxPreviewModal
          open={open}
          onClose={() => setOpen(false)}
          title={downloadName}
          subtitle={
            hasPendingLocalFile
              ? "Selected file preview · save profile to update the stored backend template"
              : "Your uploaded resume template · browser HTML preview (approximate)"
          }
          blob={docxBlob}
          fileName={downloadName}
          onDownload={() => {
            if (!docxBlob) return;
            downloadBlob(docxBlob, downloadName);
          }}
        />
      )}
    </>
  );
}
