"use client";

import { useState } from "react";
import { saMono, saTableWrap } from "@/components/super-admin/resume-dashboard-styles";
import { formatEstDateTime } from "@/lib/format-est-datetime";
import {
  formatInputEventElement,
  type ApplicationQaInputEvent,
} from "@/lib/super-admin-application-qa-api";

type ApplicationQaInputEventsListProps = {
  events: ApplicationQaInputEvent[];
  emptyMessage?: string;
};

function MetaChip({ label }: { label: string }) {
  return (
    <span
      className={`${saMono} inline-flex max-w-full break-all rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600`}
    >
      {label}
    </span>
  );
}

function EventMetaExpand({ event }: { event: ApplicationQaInputEvent }) {
  const [open, setOpen] = useState(false);
  const hasMeta =
    Boolean(event.elementKey) ||
    Boolean(event.className) ||
    Boolean(event.cssSelector) ||
    Boolean(event.attributes && Object.keys(event.attributes).length);

  if (!hasMeta) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${saMono} text-[11px] font-semibold text-teal-700 hover:underline`}
      >
        {open ? "Hide details" : "Show details"}
      </button>
      {open ? (
        <div className={`${saMono} mt-2 space-y-1.5 break-all text-[11px] text-slate-500`}>
          {event.elementKey ? (
            <p>
              <span className="text-slate-400">elementKey · </span>
              {event.elementKey}
            </p>
          ) : null}
          {event.cssSelector ? (
            <p>
              <span className="text-slate-400">cssSelector · </span>
              {event.cssSelector}
            </p>
          ) : null}
          {event.className ? (
            <p>
              <span className="text-slate-400">className · </span>
              {event.className}
            </p>
          ) : null}
          {event.attributes && Object.keys(event.attributes).length ? (
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
              {JSON.stringify(event.attributes, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ApplicationQaInputEventsList({
  events,
  emptyMessage = "No DOM input events in this session.",
}: ApplicationQaInputEventsListProps) {
  if (events.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-center">
        <p className={`${saMono} text-xs text-slate-400`}>{emptyMessage}</p>
      </div>
    );
  }

  const showComponent = events.some((event) => Boolean(event.componentType?.trim()));

  return (
    <div className={saTableWrap}>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Action</th>
            {showComponent ? (
              <th className="px-4 py-3 font-medium">Component</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Element</th>
            <th className="px-4 py-3 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => {
            const when =
              (event.occurredAt && formatEstDateTime(event.occurredAt)) ||
              event.occurredAt ||
              "—";
            const action =
              event.actionType?.trim() || event.eventType?.trim() || "";
            return (
              <tr
                key={event.id || `${index}-${event.elementKey}`}
                className="border-t border-slate-100 align-top"
              >
                <td className={`${saMono} whitespace-nowrap px-4 py-3 text-[11px] text-slate-500`}>
                  {when}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {action ? (
                    <MetaChip label={action} />
                  ) : (
                    <span className={`${saMono} text-xs text-slate-400`}>—</span>
                  )}
                </td>
                {showComponent ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    {event.componentType?.trim() ? (
                      <MetaChip label={event.componentType.trim()} />
                    ) : (
                      <span className={`${saMono} text-xs text-slate-400`}>—</span>
                    )}
                  </td>
                ) : null}
                <td className="min-w-[14rem] max-w-[28rem] px-4 py-3">
                  <p className={`${saMono} break-all whitespace-pre-wrap text-xs text-slate-800`}>
                    {formatInputEventElement(event)}
                  </p>
                  <EventMetaExpand event={event} />
                </td>
                <td className="min-w-[12rem] px-4 py-3">
                  <p className="break-words whitespace-pre-wrap text-[15px] leading-snug text-slate-700">
                    {event.value || (
                      <span className={`${saMono} text-xs text-slate-400`}>(empty)</span>
                    )}
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
