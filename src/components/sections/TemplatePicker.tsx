"use client";

import { useState } from "react";
import type { ResumeTemplate } from "@/lib/resume-template";
import DocxPreviewModal from "@/components/ui/DocxPreviewModal";

interface TemplatePickerProps {
  selected: ResumeTemplate | null;
  onSelect: (template: ResumeTemplate) => void;
}

export default function TemplatePicker({ selected, onSelect }: TemplatePickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  async function openPicker() {
    setPickerOpen(true);
    setListError("");
    setListLoading(true);
    try {
      const res = await fetch("/api/templates", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to load templates (${res.status}).`);
      setTemplates(data.templates ?? []);
    } catch (err) {
      setListError((err as Error).message || "Could not load templates.");
      setTemplates([]);
    } finally {
      setListLoading(false);
    }
  }

  function openTemplate(template: ResumeTemplate) {
    onSelect(template);
    setPickerOpen(false);
    setPreviewOpen(true);
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {selected ? (
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Step 1 · Template selected
              </p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{selected.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Your contact info and layout stay intact — only content sections are rewritten.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-dashed border-slate-300 dark:border-white/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Step 1</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Choose a resume template</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Pick a .docx from your starting templates to tailor for this job.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {selected && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
          >
            {selected ? "Change template" : "Browse templates"}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Select a resume template">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-backdrop-enter" onClick={() => setPickerOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.10] rounded-2xl shadow-2xl shadow-black/30 overflow-hidden animate-dialog-enter">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-navy-950 dark:to-navy-900">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resume templates</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select a .docx to use as your base</p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {listLoading && (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Loading templates…
                </div>
              )}
              {listError && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{listError}</p>}
              {!listLoading && !listError && templates.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-16">No .docx templates found.</p>
              )}
              {!listLoading && templates.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((template) => {
                    const isSelected = selected?.id === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => openTemplate(template)}
                        className={`group text-left p-4 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                            : "border-slate-200 dark:border-white/[0.08] hover:border-blue-400/60 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${isSelected ? "bg-blue-500/20" : "bg-slate-100 dark:bg-white/[0.05]"}`}>📄</span>
                          <span className="font-semibold text-slate-900 dark:text-white break-words text-sm">{template.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DocxPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={selected?.name ?? "Template preview"}
        subtitle="Base template · layout and contact info preserved"
        sourceUrl={selected?.file ?? null}
      />
    </div>
  );
}
