"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useState } from "react";
import SuperAdminProfileMultiSelect, {
  type ProfileOption,
} from "@/components/super-admin/SuperAdminProfileMultiSelect";
import Button from "@/components/ui/Button";
import CopyIconButton from "@/components/ui/CopyIconButton";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  downloadBlob,
  fetchSavedResumeJobDescription,
} from "@/lib/saved-resumes-api";
import type { InterviewRoundRecordResponse } from "@/lib/saved-resumes-types";
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
const ResumeDownloadChooser = dynamic(
  () => import("@/components/ui/ResumeDownloadChooser"),
  { ssr: false }
);

type SortState = { sortBy: AdminResumeSortField; sortDir: AdminResumeSortDir };

/** Match Saved Resumes (resume variant) table chrome. */
const rowStyles = {
  groupPanel:
    "overflow-hidden rounded-2xl border border-orange-200/55 bg-white/55 shadow-sm backdrop-blur-sm",
  thead:
    "border-b border-orange-200/50 bg-orange-50/70 text-[11px] uppercase tracking-[0.12em] text-orange-800/70",
  tbody: "divide-y divide-orange-100/80 text-sm",
  rowHover: "group align-top hover:bg-orange-50/50",
  bidTime: "whitespace-nowrap px-4 py-3 text-stone-600 tabular-nums",
  profile: "px-4 py-3",
  profileName: "font-semibold text-stone-900",
  profileEmail: "mt-0.5 text-[11px] text-stone-500",
  company: "px-4 py-3 font-semibold text-stone-900",
  jobTitle: "px-4 py-3 text-stone-700",
  description: "max-w-xs px-4 py-3 text-stone-500 md:max-w-md",
  descLink:
    "text-left text-xs text-orange-700 underline-offset-2 hover:text-tomato-600 hover:underline line-clamp-2",
  fileName:
    "block text-left font-mono text-xs leading-relaxed whitespace-normal break-all text-orange-700 underline-offset-2 hover:text-tomato-600 hover:underline",
  fileNameCell: "min-w-[14rem] px-4 py-3 align-top whitespace-normal",
  actionsCell:
    "sticky right-0 z-[1] whitespace-nowrap bg-white/90 px-4 py-3 shadow-[-8px_0_12px_-8px_rgba(194,65,12,0.12)] backdrop-blur-sm group-hover:bg-orange-50/95",
  actionsHead:
    "sticky right-0 z-[1] bg-orange-50/95 px-4 py-3 text-right font-medium shadow-[-8px_0_12px_-8px_rgba(194,65,12,0.12)]",
} as const;

function formatBidTime(iso: string): { timeLabel: string; fullLabel: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { timeLabel: "—", fullLabel: iso || "—" };
  }
  return {
    timeLabel: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
    fullLabel: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date),
  };
}

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
      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-orange-900 disabled:opacity-40"
    >
      {label}
      <span className="text-orange-700">{active ? (sort.sortDir === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );
}

function AdminJobDescriptionModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: AdminResumeRecord | null;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !item?.id) {
      setText("");
      setError("");
      setLoading(false);
      return;
    }

    if (item.jobDescription?.trim()) {
      setText(item.jobDescription);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setText("");
    void fetchSavedResumeJobDescription(item.id)
      .then((result) => {
        if (cancelled) return;
        setText(result.jobDescription);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message || "Could not load job description.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item?.id, item?.jobDescription]);

  const description =
    text.trim() ||
    (loading ? "" : "No job description was saved for this application.");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `${item.jobTitle} at ${item.companyName}` : "Job description"}
      className="max-w-2xl"
    >
      <div className="overflow-y-auto px-6 py-5 max-h-[min(70dvh,32rem)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Job description
            {item?.profileName || item?.profileEmail ? (
              <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">
                · {item.profileName || item.profileEmail}
              </span>
            ) : null}
          </p>
          <CopyIconButton
            text={text}
            label="Copy job description"
            className="h-10 self-auto"
            disabled={!text.trim()}
          />
        </div>
        {loading ? (
          <p className="text-sm text-stone-500">Loading job description…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
            {description}
          </div>
        )}
      </div>
    </Modal>
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
  const [preview, setPreview] = useState<{
    blob: Blob;
    fileName: string;
    archiveId: string;
  } | null>(null);
  const [jdItem, setJdItem] = useState<AdminResumeRecord | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<AdminResumeRecord | null>(null);
  const [downloadDefaults, setDownloadDefaults] = useState<{ pdf: boolean; docx: boolean }>({
    pdf: true,
    docx: false,
  });
  const [downloadFeedback, setDownloadFeedback] = useState<{
    tone: "ok" | "err" | "pending";
    text: string;
  } | null>(null);

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

  function openDownloadChooser(
    item: AdminResumeRecord,
    defaults: { pdf: boolean; docx: boolean } = { pdf: true, docx: false }
  ) {
    setDownloadFeedback(null);
    setDownloadDefaults(defaults);
    setDownloadTarget(item);
  }

  function patchInterviewHistory(update: InterviewRoundRecordResponse) {
    setItems((current) =>
      current.map((row) =>
        row.id === update.id
          ? {
              ...row,
              createdAt: update.bidAt || row.createdAt,
              interviewHistory: update.interviewHistory,
              nextInterviewRound: update.nextInterviewRound,
            }
          : row
      )
    );
    setDownloadTarget((current) =>
      current && current.id === update.id
        ? {
            ...current,
            createdAt: update.bidAt || current.createdAt,
            interviewHistory: update.interviewHistory,
            nextInterviewRound: update.nextInterviewRound,
          }
        : current
    );
  }

  async function handlePreview(item: AdminResumeRecord) {
    setBusyId(`${item.id}-preview`);
    setError("");
    try {
      const preferred = item.pdfFileName || item.resumeFileName.replace(/\.docx$/i, ".pdf");
      const { blob, fileName } = await superAdminResumesApi.fetchFile(item.id, "pdf", preferred);
      setPreview({ blob, fileName, archiveId: item.id });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not preview PDF."));
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const colSpan = 7;

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
          <div className={rowStyles.groupPanel}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={rowStyles.thead}>
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <SortHeader
                        label="Bid time"
                        field="createdAt"
                        sort={sort}
                        onSort={handleSort}
                        disabled={loading}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <SortHeader
                        label="Profile"
                        field="profileName"
                        sort={sort}
                        onSort={handleSort}
                        disabled={loading}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <SortHeader
                        label="Company"
                        field="companyName"
                        sort={sort}
                        onSort={handleSort}
                        disabled={loading}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <SortHeader
                        label="Job title"
                        field="jobTitle"
                        sort={sort}
                        onSort={handleSort}
                        disabled={loading}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Job description</th>
                    <th className="px-4 py-3 font-medium">File name</th>
                    <th className={rowStyles.actionsHead}>Download</th>
                  </tr>
                </thead>
                <tbody className={rowStyles.tbody}>
                  {loading ? (
                    <tr>
                      <td colSpan={colSpan} className="px-4 py-10 text-center text-stone-500">
                        Searching…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="px-4 py-10 text-center text-stone-500">
                        No resumes matched “{submittedQuery}”.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const bid = formatBidTime(item.createdAt);
                      const noDescription = item.hasJobDescription === false;
                      const jdTrimmed = item.jobDescription?.trim() ?? "";
                      const previewSnippet =
                        jdTrimmed.length > 100
                          ? `${jdTrimmed.slice(0, 100)}…`
                          : jdTrimmed || "View description";

                      return (
                        <tr key={item.id} className={rowStyles.rowHover}>
                          <td className={rowStyles.bidTime} title={bid.fullLabel}>
                            {bid.timeLabel}
                          </td>
                          <td className={rowStyles.profile}>
                            <p className={rowStyles.profileName}>
                              {item.profileName || item.profileEmail || item.profileId || "—"}
                            </p>
                            {item.profileEmail && item.profileName ? (
                              <p className={rowStyles.profileEmail}>{item.profileEmail}</p>
                            ) : null}
                          </td>
                          <td className={rowStyles.company}>{item.companyName || "—"}</td>
                          <td className={rowStyles.jobTitle}>{item.jobTitle || "—"}</td>
                          <td className={rowStyles.description}>
                            {noDescription ? (
                              <span className="text-stone-400">No description</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setJdItem(item)}
                                className={rowStyles.descLink}
                                title="View full job description"
                              >
                                {previewSnippet}
                              </button>
                            )}
                          </td>
                          <td className={rowStyles.fileNameCell}>
                            <button
                              type="button"
                              onClick={() => void handlePreview(item)}
                              className={rowStyles.fileName}
                              disabled={busyId !== null}
                              title="Preview PDF"
                            >
                              {busyId === `${item.id}-preview` ? "…" : item.resumeFileName || "—"}
                            </button>
                          </td>
                          <td className={rowStyles.actionsCell}>
                            <div className="inline-flex flex-row flex-nowrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busyId !== null}
                                onClick={() => openDownloadChooser(item)}
                              >
                                Download
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {downloadFeedback ? (
            <p
              className={`${saMono} text-[11px] ${
                downloadFeedback.tone === "ok"
                  ? "text-emerald-700"
                  : downloadFeedback.tone === "pending"
                    ? "text-amber-700"
                    : "text-rose-700"
              }`}
            >
              {downloadFeedback.text}
            </p>
          ) : null}

          <div
            className={`flex flex-wrap items-center justify-between gap-3 ${saMono} text-[11px] text-stone-500`}
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
          onDownload={() => {
            const match = items.find((row) => row.id === preview.archiveId);
            setPreview(null);
            if (match) {
              openDownloadChooser(match, { pdf: true, docx: false });
              return;
            }
            downloadBlob(preview.blob, preview.fileName);
          }}
        />
      ) : null}

      <AdminJobDescriptionModal
        open={Boolean(jdItem)}
        onClose={() => setJdItem(null)}
        item={jdItem}
      />

      <ResumeDownloadChooser
        open={Boolean(downloadTarget)}
        archiveId={downloadTarget?.id}
        onClose={() => setDownloadTarget(null)}
        defaultIncludePdf={downloadDefaults.pdf}
        defaultIncludeDocx={downloadDefaults.docx}
        showInterviewOptions
        companyName={downloadTarget?.companyName}
        bidAt={downloadTarget?.createdAt}
        interviewHistory={downloadTarget?.interviewHistory}
        nextInterviewRound={downloadTarget?.nextInterviewRound}
        onInterviewHistoryUpdated={patchInterviewHistory}
        onFeedback={(feedback) => {
          setDownloadFeedback(feedback);
          if (feedback.tone === "err") setError(feedback.text);
        }}
      />
    </div>
  );
}
