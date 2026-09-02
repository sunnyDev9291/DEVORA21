"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumePromptOption } from "@/lib/resume-prompt-option";

function formatPromptLabel(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

interface SavedPromptPickerProps {
  selectedId: string;
  loading?: boolean;
  disabled?: boolean;
  onSelect: (promptId: string, prompt?: ResumePromptOption) => void;
}

export default function SavedPromptPicker({
  selectedId,
  loading = false,
  disabled = false,
  onSelect,
}: SavedPromptPickerProps) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<ResumePromptOption[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const fetchedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = prompts.find((p) => p.id === selectedId);
  const label = selected ? formatPromptLabel(selected.name) : "Write your own";

  const loadPrompts = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setListLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/prompts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to load prompts (${res.status}).`);
      setPrompts(data.prompts ?? []);
    } catch (err) {
      fetchedRef.current = false;
      setPrompts([]);
      setListError((err as Error).message || "Could not load saved prompts.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPrompts();
  }, [open, loadPrompts]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(id: string) {
    const prompt = prompts.find((p) => p.id === id);
    onSelect(id, prompt);
    setOpen(false);
  }

  function toggleOpen() {
    if (disabled || loading) return;
    setOpen((v) => !v);
  }

  return (
    <div ref={rootRef} className="relative mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Saved prompt
      </p>

      <button
        type="button"
        id="savedPrompt"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={toggleOpen}
        className={`group w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "border-violet-500/40 bg-violet-500/[0.08] shadow-lg shadow-violet-500/10"
            : selected
              ? "border-violet-500/25 bg-gradient-to-r from-violet-500/[0.08] to-sun-400/[0.05] hover:border-violet-500/35"
              : "border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/[0.16]"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selected
              ? "bg-violet-500/20 text-violet-600 dark:text-violet-300"
              : "bg-slate-200/80 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-300"
          }`}
        >
          {loading || listLoading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : selected ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
            {loading ? "Loading prompt…" : listLoading ? "Loading presets…" : label}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {selected ? "Loaded into extra instructions" : "Pick a preset or type your own below"}
          </span>
        </span>

        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-violet-500" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {listError && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{listError}</p>
      )}

      {open && (
        <div
          role="listbox"
          aria-label="Saved prompts"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/[0.10] bg-white dark:bg-warm-900 shadow-2xl shadow-black/40 animate-dialog-enter"
        >
          <div className="border-b border-slate-100 dark:border-white/[0.06] bg-gradient-to-r from-slate-50 to-white dark:from-navy-950 dark:to-navy-900 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Choose a preset
            </p>
          </div>

          <ul className="max-h-56 overflow-y-auto p-2 space-y-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!selectedId}
                onClick={() => pick("")}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  !selectedId
                    ? "bg-violet-500/15 border border-violet-500/25"
                    : "hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">Write your own</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Clear extra instructions</span>
                </span>
                {!selectedId && (
                  <svg className="ml-auto h-4 w-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>

            {listLoading && (
              <li className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">Loading presets…</li>
            )}

            {!listLoading &&
              prompts.map((prompt) => {
                const isSelected = selectedId === prompt.id;
                const displayName = formatPromptLabel(prompt.name);
                return (
                  <li key={prompt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pick(prompt.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                        isSelected
                          ? "bg-violet-500/15 border border-violet-500/25"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-violet-500/20 text-violet-600 dark:text-violet-300"
                            : "bg-slate-100 dark:bg-white/[0.06] text-slate-500"
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">{displayName}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">ATS optimizer preset</span>
                      </span>
                      {isSelected && (
                        <svg className="ml-auto h-4 w-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
