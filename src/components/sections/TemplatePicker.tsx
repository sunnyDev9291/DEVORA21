"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { renderAsync } from "docx-preview";
import type { ResumeTemplate } from "@/lib/resume-template";

interface TemplatePickerProps {
  selected: ResumeTemplate | null;
  onSelect: (template: ResumeTemplate) => void;
}

export default function TemplatePicker({ selected, onSelect }: TemplatePickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);

  // Always re-read the folder (no cache) when the picker opens.
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

  // Show only the page at `index`, hide the rest.
  const showOnly = useCallback((index: number) => {
    pagesRef.current.forEach((el, i) => {
      el.style.display = i === index ? "" : "none";
    });
  }, []);

  function openTemplate(template: ResumeTemplate) {
    onSelect(template);
    setPickerOpen(false);
    setPreviewOpen(true);
  }

  // Render the selected .docx into the preview modal once it's mounted.
  useEffect(() => {
    if (!previewOpen || !selected) return;
    let cancelled = false;

    (async () => {
      setError("");
      setLoading(true);
      setPage(0);
      setTotalPages(0);
      pagesRef.current = [];
      try {
        const res = await fetch(selected.file, { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not load template (${res.status}).`);
        const blob = await res.blob();
        const container = previewRef.current;
        if (!container || cancelled) return;
        container.innerHTML = "";
        await renderAsync(blob, container, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
        });
        if (cancelled) return;
        const pageEls = Array.from(
          container.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
        );
        // Page-splitting can leave an empty paragraph (a stray bullet, since
        // bullets are CSS ::before markers) at the bottom of a page. Strip any
        // trailing empty paragraphs so pages end like the original document.
        for (const pageEl of pageEls) {
          let last = pageEl.lastElementChild;
          while (
            last &&
            last.tagName === "P" &&
            (last.textContent ?? "").trim() === "" &&
            !last.querySelector("img,svg,table")
          ) {
            const prev = last.previousElementSibling;
            last.remove();
            last = prev;
          }
        }
        pagesRef.current = pageEls;
        setTotalPages(pageEls.length);
        showOnly(0);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to render template.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewOpen, selected, showOnly]);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(index, totalPages - 1));
    setPage(clamped);
    showOnly(clamped);
    previewRef.current?.scrollTo({ top: 0 });
  }

  return (
    <div>
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
            Resume Template
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {selected ? `Selected: ${selected.name}` : "No template selected yet."}
          </p>
        </div>
        <div className="flex gap-3">
          {selected && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="bg-slate-200 dark:bg-white/[0.05] hover:bg-slate-300 dark:hover:bg-white/[0.08] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap"
            >
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={openPicker}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/25 whitespace-nowrap"
          >
            {selected ? "Change Template" : "Choose a Template"}
          </button>
        </div>
      </div>

      {/* Selection modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select a resume template"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPickerOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.10] rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Choose a Resume Template
              </h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {listLoading && (
              <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reading templates folder…
              </div>
            )}

            {listError && (
              <p className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {listError}
              </p>
            )}

            {!listLoading && !listError && templates.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-12">
                No .docx templates found in the folder.
              </p>
            )}

            {!listLoading && templates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((template) => {
                  const isSelected = selected?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => openTemplate(template)}
                      className={`text-left p-5 rounded-xl border transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-200 dark:border-white/[0.10] hover:border-blue-400 dark:hover:border-white/[0.20] bg-slate-50 dark:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-lg shrink-0">
                          📄
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white break-words">
                          {template.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Template preview"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl h-[90vh] bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/[0.10] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.08]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {selected?.name} — Template Preview
              </h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Document canvas */}
            <div className="relative flex-1 overflow-auto bg-[#e9ecef] dark:bg-navy-950">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading template…
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <p className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                  </p>
                </div>
              )}
              <div className="docx-preview-canvas" ref={previewRef} />
            </div>

            {/* Pagination bar */}
            {totalPages > 0 && !loading && (
              <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => goTo(page - 1)}
                  disabled={page === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goTo(page + 1)}
                  disabled={page === totalPages - 1}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
