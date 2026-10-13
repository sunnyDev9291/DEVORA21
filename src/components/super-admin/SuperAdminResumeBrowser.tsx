"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import SuperAdminResumeFilters, {
  DEFAULT_RESUME_FILTERS,
  filtersToApi,
  type ResumeFilterState,
} from "@/components/super-admin/SuperAdminResumeFilters";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import { downloadBlob } from "@/lib/saved-resumes-api";
import { superAdminApi } from "@/lib/super-admin-api";
import {
  formatGenerationMethod,
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
}: {
  label: string;
  field: AdminResumeSortField;
  sort: SortState;
  onSort: (field: AdminResumeSortField) => void;
}) {
  const active = sort.sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-teal-200"
    >
      {label}
      <span className="text-teal-400/80">{active ? (sort.sortDir === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );
}

export default function SuperAdminResumeBrowser() {
  const [filters, setFilters] = useState<ResumeFilterState>(DEFAULT_RESUME_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ sortBy: "createdAt", sortDir: "desc" });
  const [items, setItems] = useState<AdminResumeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [profiles, setProfiles] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [jdItem, setJdItem] = useState<AdminResumeRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await superAdminApi.listUsers({ page: 1, limit: 100 });
        if (cancelled) return;
        setProfiles(
          list.users.map((u) => ({
            id: u.id,
            label: u.name?.trim() || u.email || u.id,
          }))
        );
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (nextFilters: ResumeFilterState, nextPage: number, nextSort: SortState) => {
      setLoading(true);
      setError("");
      try {
        const result = await superAdminResumesApi.listResumes({
          ...filtersToApi(nextFilters),
          page: nextPage,
          limit,
          sortBy: nextSort.sortBy,
          sortDir: nextSort.sortDir,
        });
        setItems(result.items);
        setTotal(result.total);
        setPage(result.page);
      } catch (err) {
        setItems([]);
        setTotal(0);
        setError(getApiErrorMessage(err, "Could not load resumes."));
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    void load(DEFAULT_RESUME_FILTERS, 1, { sortBy: "createdAt", sortDir: "desc" });
  }, [load]);

  function handleSort(field: AdminResumeSortField) {
    const next: SortState =
      sort.sortBy === field
        ? { sortBy: field, sortDir: sort.sortDir === "asc" ? "desc" : "asc" }
        : { sortBy: field, sortDir: field === "createdAt" ? "desc" : "asc" };
    setSort(next);
    void load(filters, 1, next);
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

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <SuperAdminResumeFilters
        value={filters}
        onChange={setFilters}
        onApply={() => {
          setPage(1);
          void load(filters, 1, sort);
        }}
        profiles={profiles}
        showKeywordFields
        applying={loading}
      />

      {error ? (
        <div
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
          role="alert"
        >
          <p className={saMono}>{error}</p>
          <p className={`${saMono} mt-2 text-[#8b9aab]`}>
            Backend must expose <code className="text-teal-200/80">GET /admin/resumes</code> with
            search, pagination, and file downloads.
          </p>
        </div>
      ) : null}

      <div className={`${saCard} overflow-x-auto`}>
        <table className={`min-w-full text-left ${saMono} text-xs text-[#c5d0dc]`}>
          <thead className="border-b border-[#1e2a36] text-[10px] text-[#6b7c8f]">
            <tr>
              <th className="px-3 py-3 font-medium">
                <SortHeader label="Created" field="createdAt" sort={sort} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 font-medium">
                <SortHeader label="Profile" field="profileName" sort={sort} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 font-medium">
                <SortHeader label="Company" field="companyName" sort={sort} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 font-medium">
                <SortHeader label="Title" field="jobTitle" sort={sort} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 font-medium">
                <SortHeader
                  label="Method"
                  field="generationMethod"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[#6b7c8f]">
                  Loading resumes…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[#6b7c8f]">
                  No resumes matched these filters.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-[#1e2a36] hover:bg-[#0d141c]/60">
                  <td className="px-3 py-3 whitespace-nowrap text-[#f4f7fb]">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[#f4f7fb]">
                      {item.profileName || item.profileEmail || item.profileId || "—"}
                    </p>
                    {item.profileEmail && item.profileName ? (
                      <p className="text-[10px] text-[#6b7c8f]">{item.profileEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{item.companyName || "—"}</td>
                  <td className="px-3 py-3 max-w-[14rem] truncate" title={item.jobTitle}>
                    {item.jobTitle || "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatGenerationMethod(item.generationMethod)}
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

      <div className={`flex flex-wrap items-center justify-between gap-3 ${saMono} text-[11px] text-[#6b7c8f]`}>
        <p>
          {total.toLocaleString()} resume{total === 1 ? "" : "s"} · page {page} / {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void load(filters, page - 1, sort)}
            className={`${saBtnGhost} h-8 px-3`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => void load(filters, page + 1, sort)}
            className={`${saBtnGhost} h-8 px-3`}
          >
            Next
          </button>
        </div>
      </div>

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
            <p className={`${saMono} text-[11px] text-[#6b7c8f]`}>
              {jdItem.profileName || jdItem.profileEmail || jdItem.profileId} ·{" "}
              {formatGenerationMethod(jdItem.generationMethod)} ·{" "}
              {new Date(jdItem.createdAt).toLocaleString()}
            </p>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap border border-[#1e2a36] bg-[#0d141c] p-4 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#c5d0dc]">
              {jdItem.jobDescription?.trim() || "No job description stored for this resume."}
            </pre>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
