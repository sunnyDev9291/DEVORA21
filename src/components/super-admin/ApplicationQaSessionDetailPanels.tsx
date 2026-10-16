"use client";

import ApplicationQaInputEventsList from "@/components/super-admin/ApplicationQaInputEventsList";
import ApplicationQaMatchedList from "@/components/super-admin/ApplicationQaMatchedList";
import { saDisplay, saEyebrow, saMono } from "@/components/super-admin/resume-dashboard-styles";
import type { ApplicationQaSessionDetail } from "@/lib/super-admin-application-qa-api";

type ApplicationQaSessionDetailPanelsProps = {
  detail: ApplicationQaSessionDetail;
  live?: boolean;
};

export default function ApplicationQaSessionDetailPanels({
  detail,
  live = false,
}: ApplicationQaSessionDetailPanelsProps) {
  const matchedCount = detail.matchedCount ?? detail.matchedQa.length;
  const unmatchedCount = detail.unmatchedCount ?? detail.unmatchedEvents.length;

  return (
    <div className="space-y-8">
      <div className={`${saMono} flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500`}>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-800">
          Matched: {matchedCount}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
          Unmatched: {unmatchedCount}
        </span>
        {live ? <span className="text-teal-700">Live</span> : null}
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className={saEyebrow}>DeepSeek</p>
            <h3 className={`${saDisplay} mt-1 text-lg font-bold text-slate-900`}>
              Matched questions &amp; answers
            </h3>
          </div>
          <p className={`${saMono} text-[11px] text-slate-400`}>
            {matchedCount} matched
          </p>
        </div>
        <ApplicationQaMatchedList items={detail.matchedQa} />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className={saEyebrow}>Capture</p>
            <h3 className={`${saDisplay} mt-1 text-lg font-bold text-slate-900`}>
              Unmatched DOM events
            </h3>
          </div>
          <p className={`${saMono} text-[11px] text-slate-400`}>
            {unmatchedCount} unmatched
          </p>
        </div>
        <ApplicationQaInputEventsList
          events={detail.unmatchedEvents}
          emptyMessage="No unmatched DOM events — all captured controls are matched."
        />
      </section>
    </div>
  );
}
