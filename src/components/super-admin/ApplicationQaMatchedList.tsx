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

function MetaChip({ label }: { label: string }) {
  return (
    <span
      className={`${saMono} inline-flex max-w-full break-all rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600`}
    >
      {label}
    </span>
  );
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

  const showAction = items.some((item) => Boolean(item.actionType?.trim()));
  const showComponent = items.some((item) => Boolean(item.componentType?.trim()));
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
            {showAction ? <th className="px-4 py-3 font-medium">Action</th> : null}
            {showComponent ? <th className="px-4 py-3 font-medium">Component</th> : null}
            {showConfidence ? (
              <th className="px-4 py-3 font-medium">Confidence</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const when =
              (item.occurredAt && formatEstDateTime(item.occurredAt)) ||
              (item.updatedAt && formatEstDateTime(item.updatedAt)) ||
              item.occurredAt ||
              item.updatedAt ||
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
                {showAction ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    {item.actionType?.trim() ? (
                      <MetaChip label={item.actionType.trim()} />
                    ) : (
                      <span className={`${saMono} text-xs text-slate-400`}>—</span>
                    )}
                  </td>
                ) : null}
                {showComponent ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    {item.componentType?.trim() ? (
                      <MetaChip label={item.componentType.trim()} />
                    ) : (
                      <span className={`${saMono} text-xs text-slate-400`}>—</span>
                    )}
                  </td>
                ) : null}
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
