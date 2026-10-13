"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  saBtnGhost,
  saBtnPrimary,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";

export type ProfileOption = {
  id: string;
  label: string;
  email?: string;
};

type SuperAdminProfileMultiSelectProps = {
  options: ProfileOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export default function SuperAdminProfileMultiSelect({
  options,
  selectedIds,
  onChange,
  disabled = false,
}: SuperAdminProfileMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = options.length > 0 && selectedIds.length === options.length;

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  const summary =
    selectedIds.length === 0
      ? "No profiles selected"
      : allSelected
        ? `All profiles (${options.length})`
        : `${selectedIds.length} of ${options.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <label className={saLabel}>Profiles</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${saField} flex items-center justify-between text-left`}
      >
        <span className="truncate">{summary}</span>
        <span className="ml-2 text-slate-500" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="border-b border-slate-100 p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={saField}
              placeholder="Search name or email…"
              spellCheck={false}
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`${saBtnPrimary} h-8 px-3 text-[10px]`}
                onClick={() => onChange(options.map((o) => o.id))}
              >
                Select all
              </button>
              <button
                type="button"
                className={`${saBtnGhost} h-8 px-3 text-[10px]`}
                onClick={() => onChange([])}
              >
                Deselect all
              </button>
            </div>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className={`${saMono} px-4 py-3 text-xs text-slate-500`}>No matches.</li>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(opt.id);
                return (
                  <li key={opt.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors hover:bg-teal-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(opt.id)}
                        className="mt-0.5 h-4 w-4 accent-teal-700"
                      />
                      <span className="min-w-0">
                        <span className={`${saMono} block text-xs text-slate-900`}>{opt.label}</span>
                        {opt.email ? (
                          <span className={`${saMono} block text-[10px] text-slate-500`}>
                            {opt.email}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
