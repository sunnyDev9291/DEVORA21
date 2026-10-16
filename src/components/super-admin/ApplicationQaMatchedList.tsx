"use client";

import { saMono, saTableWrap } from "@/components/super-admin/resume-dashboard-styles";
import { formatEstDateTime } from "@/lib/format-est-datetime";
import type { ApplicationQaMatchedItem } from "@/lib/super-admin-application-qa-api";

type ApplicationQaMatchedListProps = {
  items: ApplicationQaMatchedItem[];
};

function formatConfidence(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
  if (value > 1 && value <= 100) return `${Math.round(value)}%`;
  return String(value);
}

export default function ApplicationQaMatchedList({ items }: ApplicationQaMatchedListProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
        <p className={`${saMono} text-xs text-slate-400`}>
          No matched questions yet — waiting for DeepSeek…
        </p>
      </div>
    );
  }

  const showConfidence = items.some(
    (item) => typeof item.matchConfidence === "number" && Number.isFinite(item.matchConfidence)
  );

  return (
    <div className={saTableWrap}>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
            <th className="px-4 py-3 font-medium">Question</th>
            <th className="px-4 py-3 font-medium">Answer</th>
            {showConfidence ? (
              <th className="px-4 py-3 font-medium">Confidence</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const when =
              (item.updatedAt && formatEstDateTime(item.updatedAt)) ||
              (item.occurredAt && formatEstDateTime(item.occurredAt)) ||
              item.updatedAt ||
              item.occurredAt ||
              "—";
            const confidence = formatConfidence(item.matchConfidence);
            return (
              <tr
                key={item.id || `${index}-${item.elementKey}`}
                className="border-t border-slate-100 align-top"
              >
                <td className="min-w-[12rem] px-4 py-3">
                  <p className="break-words whitespace-pre-wrap text-[15px] font-medium leading-snug text-slate-900">
                    {item.question}
                  </p>
                </td>
                <td className="min-w-[12rem] px-4 py-3">
                  <p className="break-words whitespace-pre-wrap text-[15px] leading-snug text-slate-700">
                    {item.answer || (
                      <span className={`${saMono} text-xs text-slate-400`}>(empty)</span>
                    )}
                  </p>
                </td>
                {showConfidence ? (
                  <td className={`${saMono} whitespace-nowrap px-4 py-3 text-xs text-slate-500`}>
                    {confidence || "—"}
                  </td>
                ) : null}
                <td className={`${saMono} whitespace-nowrap px-4 py-3 text-[11px] text-slate-500`}>
                  {when}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
