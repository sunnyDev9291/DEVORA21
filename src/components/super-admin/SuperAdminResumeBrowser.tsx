"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useState } from "react";
import SuperAdminProfileMultiSelect, {
  type ProfileOption,
} from "@/components/super-admin/SuperAdminProfileMultiSelect";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saField,
  saLabel,
  saMono,
  saTableWrap,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import { downloadBlob } from "@/lib/saved-resumes-api";
import { superAdminApi } from "@/lib/super-admin-api";
import {
  guessBrowserTimezone,
  superAdminResumesApi,
  type AdminResumeRecord,
  type AdminResumeSortDir,
  type AdminResumeSortField,
} from "@/lib/super-admin-resumes-api";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

type SortState = { sortBy: AdminResumeSortField; sortDir: AdminResumeSortDir };

function SortHeader({
  label,
  field,
  sort,
  onSort,
  disabled,
}: {
  label: string;
  field: AdminResumeSortField;
  sort: SortState;
  onSort: (field: AdminResumeSortField) => void;
  disabled?: boolean;
}) {
  const active = sort.sortBy === field;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-teal-700 disabled:opacity-40"
    >
      {label}
      <span className="text-teal-700">{active ? (sort.sortDir === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );
}

export default function SuperAdminResumeBrowser() {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ sortBy: "createdAt", sortDir: "desc" });
  const [items, setItems] = useState<AdminResumeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [jdItem, setJdItem] = useState<AdminResumeRecord | null>(null);

  const canSearch = query.trim().length > 0 && selectedIds.length > 0;
  const hasSearched = submittedQuery !== null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const opts: ProfileOption[] = [];
        let pageNum = 1;
        let totalUsers = Infinity;
        while (opts.length < totalUsers) {
          const list = await superAdminApi.listUsers({ page: pageNum, limit: 100 });
          if (cancelled) return;
          totalUsers = list.total;
          for (const u of list.users) {
            opts.push({
              id: u.id,
              label: u.name?.trim() || u.email || u.id,
              email: u.email,
            });
          }
          if (!list.users.length) break;
          pageNum += 1;
          if (pageNum > 50) break;
        }
        if (cancelled) return;
        setProfiles(opts);
        if (!initializedSelection) {
          setSelectedIds(opts.map((o) => o.id));
          setInitializedSelection(true);
        }
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializedSelection]);

  const runSearch = useCallback(
    async (q: string, profileIds: string[], nextPage: number, nextSort: SortState) => {
      const trimmed = q.trim();
      if (!trimmed || !profileIds.length) return;

      setLoading(true);
      setError("");
      setSubmittedQuery(trimmed);
      try {
        const result = await superAdminResumesApi.listResumes({
          q: trimmed,
          profileIds,
          timezone: guessBrowserTimezone(),
          page: nextPage,
          limit,
          sortBy: nextSort.sortBy,
          sortDir: nextSort.sortDir,
          // No date preset — integrated search across all time for selected profiles
          preset: "all",
        });
        setItems(result.items);
        setTotal(result.total);
        setPage(result.page);
      } catch (err) {
        setItems([]);
        setTotal(0);
        setError(getApiErrorMessage(err, "Could not search resumes."));
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    void runSearch(query, selectedIds, 1, sort);
  }

  function handleSort(field: AdminResumeSortField) {
    if (!hasSearched || !submittedQuery) return;
    const next: SortState =
      sort.sortBy === field
        ? { sortBy: field, sortDir: sort.sortDir === "asc" ? "desc" : "asc" }
        : { sortBy: field, sortDir: field === "createdAt" ? "desc" : "asc" };
    setSort(next);
    void runSearch(submittedQuery, selectedIds, 1, next);
  }

  async function handleDownload(item: AdminResumeRecord, format: "docx" | "pdf") {
    setBusyId(`${item.id}-${format}`);
    setError("");
    try {
      const preferred =
        format === "pdf"
          ? item.pdfFileName || item.resumeFileName.replace(/\.docx$/i, ".pdf")
          : item.resumeFileName;
      const { blob, fileName } = await superAdminResumesApi.fetchFile(item.id, format, preferred);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not download ${format.toUpperCase()}.`));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePreview(item: AdminResumeRecord) {
    setBusyId(`${item.id}-preview`);
    setError("");
    try {
      const preferred = item.pdfFileName || item.resumeFileName.replace(/\.docx$/i, ".pdf");
      const { blob, fileName } = await superAdminResumesApi.fetchFile(item.id, "pdf", preferred);
      setPreview({ blob, fileName });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not preview PDF."));
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className={`${saCard} space-y-4 p-5 sm:p-6`}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Search resumes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Integrated search across company, job title, job description, and file name. Results
            appear only after you search.
          </p>
        </div>

        <SuperAdminProfileMultiSelect
          options={profiles}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabled={!profiles.length}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="sa-resume-search-q" className={saLabel}>
              Search
            </label>
            <input
              id="sa-resume-search-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={saField}
              placeholder="Company, title, job description, or file name…"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={!canSearch || loading}
            className={`${saBtnPrimary} h-[42px] shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        {!query.trim() ? (
          <p className={`${saMono} text-[11px] text-slate-400`}>
            Enter a search term to enable Search.
          </p>
        ) : !selectedIds.length ? (
          <p className={`${saMono} text-[11px] text-slate-400`}>
            Select at least one profile to search.
          </p>
        ) : null}
      </form>

      {error ? (
        <div className="sa-alert px-4 py-3 text-xs" role="alert">
          <p className={saMono}>{error}</p>
          <p className={`${saMono} mt-2 text-slate-500`}>
            Backend must expose <code className="text-teal-700">GET /admin/resumes</code> with
            integrated <code className="text-teal-700">q</code> search across company, title, JD,
            and file name.
          </p>
        </div>
      ) : null}

      {!hasSearched ? (
        <div className={`${saCard} px-5 py-12 text-center`}>
          <p className="text-sm font-medium text-slate-800">No search yet</p>
          <p className={`${saMono} mt-2 text-xs text-slate-400`}>
            Type a query and press Search to load matching resumes.
          </p>
        </div>
      ) : (
        <>
          <div className={`${saTableWrap} overflow-x-auto`}>
            <table className={`min-w-full text-left ${saMono} text-xs text-slate-600`}>
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">
                    <SortHeader
                      label="Created"
                      field="createdAt"
                      sort={sort}
                      onSort={handleSort}
                      disabled={loading}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">
                    <SortHeader
                      label="Profile"
                      field="profileName"
                      sort={sort}
                      onSort={handleSort}
                      disabled={loading}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">
                    <SortHeader
                      label="Company"
                      field="companyName"
                      sort={sort}
                      onSort={handleSort}
                      disabled={loading}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">
                    <SortHeader
                      label="Title"
                      field="jobTitle"
                      sort={sort}
                      onSort={handleSort}
                      disabled={loading}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">File</th>
                  <th className="px-3 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      Searching…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      No resumes matched “{submittedQuery}”.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-900">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-900">
                          {item.profileName || item.profileEmail || item.profileId || "—"}
                        </p>
                        {item.profileEmail && item.profileName ? (
                          <p className="text-[10px] text-slate-500">{item.profileEmail}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{item.companyName || "—"}</td>
                      <td className="px-3 py-3 max-w-[14rem] truncate" title={item.jobTitle}>
                        {item.jobTitle || "—"}
                      </td>
                      <td
                        className="px-3 py-3 max-w-[10rem] truncate text-slate-500"
                        title={item.resumeFileName}
                      >
                        {item.resumeFileName || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            className={`${saBtnGhost} h-8 px-2 text-[10px]`}
                            disabled={busyId !== null}
                            onClick={() => void handlePreview(item)}
                          >
                            {busyId === `${item.id}-preview` ? "…" : "PDF"}
                          </button>
                          <button
                            type="button"
                            className={`${saBtnGhost} h-8 px-2 text-[10px]`}
                            disabled={busyId !== null}
                            onClick={() => void handleDownload(item, "docx")}
                          >
                            {busyId === `${item.id}-docx` ? "…" : "DOCX"}
                          </button>
                          <button
                            type="button"
                            className={`${saBtnGhost} h-8 px-2 text-[10px]`}
                            disabled={busyId !== null}
                            onClick={() => void handleDownload(item, "pdf")}
                          >
                            {busyId === `${item.id}-pdf` ? "…" : "DL PDF"}
                          </button>
                          <button
                            type="button"
                            className={`${saBtnPrimary} h-8 px-2 text-[10px]`}
                            onClick={() => setJdItem(item)}
                          >
                            JD
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-3 ${saMono} text-[11px] text-slate-500`}
          >
            <p>
              {total.toLocaleString()} result{total === 1 ? "" : "s"} for “{submittedQuery}” · page{" "}
              {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1 || !submittedQuery}
                onClick={() => void runSearch(submittedQuery!, selectedIds, page - 1, sort)}
                className={`${saBtnGhost} h-8 px-3`}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages || !submittedQuery}
                onClick={() => void runSearch(submittedQuery!, selectedIds, page + 1, sort)}
                className={`${saBtnGhost} h-8 px-3`}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {preview ? (
        <PdfPreviewModal
          open
          onClose={() => setPreview(null)}
          title={preview.fileName}
          fileName={preview.fileName}
          blob={preview.blob}
          onDownload={() => downloadBlob(preview.blob, preview.fileName)}
        />
      ) : null}

      {jdItem ? (
        <Modal
          open
          onClose={() => setJdItem(null)}
          title={`${jdItem.companyName || "Job"} · ${jdItem.jobTitle || "Description"}`}
        >
          <div className="space-y-3">
            <p className={`${saMono} text-[11px] text-slate-500`}>
              {jdItem.profileName || jdItem.profileEmail || jdItem.profileId} ·{" "}
              {new Date(jdItem.createdAt).toLocaleString()}
            </p>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap border border-slate-200 bg-slate-50 p-4 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-slate-600">
              {jdItem.jobDescription?.trim() || "No job description stored for this resume."}
            </pre>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
