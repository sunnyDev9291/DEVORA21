"use client";

import { useEffect, useRef } from "react";
import { RESUME_PHASE_LABELS, type ResumeGenerationPhase } from "@/lib/resume-prompt";
import {
  EvaluationHeroLoader,
  EvaluationRowLoader,
  EvaluationStepStack,
} from "@/components/ui/ResumeStepLoader";

const PHASE_ORDER: ResumeGenerationPhase[] = [
  "starting",
  "analyzing",
  "title",
  "summary",
  "skills",
  "experiences",
  "finalizing",
];

const PHASE_DESCRIPTIONS: Record<ResumeGenerationPhase, string> = {
  starting: "Preparing prompts from your template",
  analyzing: "Streaming tailored resume content from the AI",
  title: "Crafting a tailored resume title",
  summary: "Writing your professional summary",
  skills: "Building skillsets for this role",
  experiences: "Tailoring experience bullets to the job",
  finalizing: "Polishing and packaging your draft",
};

function phaseIndex(phase: ResumeGenerationPhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

interface ResumeThinkingProgressProps {
  phase: ResumeGenerationPhase;
  jobTitle?: string;
  embedded?: boolean;
  /** Live AI response text while streaming. */
  streamOutput?: string;
}

export default function ResumeThinkingProgress({
  phase,
  jobTitle,
  embedded = false,
  streamOutput = "",
}: ResumeThinkingProgressProps) {
  const currentIdx = phaseIndex(phase);
  const heroTitle = `${RESUME_PHASE_LABELS[phase]}…`;
  const heroDescription = jobTitle
    ? `Target role: ${jobTitle}`
    : PHASE_DESCRIPTIONS[phase];
  const streamRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [streamOutput]);

  const body = (
    <>
      <EvaluationHeroLoader title={heroTitle} description={heroDescription} accent="blue" />
      {PHASE_ORDER.map((step, idx) => {
        if (step === phase) return null;

        const state = idx < currentIdx ? "done" : "pending";
        const accent: "sky" | "emerald" =
          step === "experiences" || step === "finalizing" ? "emerald" : "sky";

        return (
          <EvaluationRowLoader
            key={step}
            title={state === "done" ? RESUME_PHASE_LABELS[step] : `${RESUME_PHASE_LABELS[step]}…`}
            description={PHASE_DESCRIPTIONS[step]}
            accent={accent}
            state={state}
          />
        );
      })}

      <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-950/95 dark:bg-black/40 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            AI response
          </p>
          <p className="text-[11px] text-slate-500">
            {streamOutput ? `${streamOutput.length.toLocaleString()} chars` : "Waiting for tokens…"}
          </p>
        </div>
        <pre
          ref={streamRef}
          className="max-h-64 sm:max-h-80 overflow-auto px-3 py-3 text-[11px] leading-relaxed text-emerald-300/90 whitespace-pre-wrap break-words font-mono"
        >
          {streamOutput || "Connecting to stream…"}
        </pre>
      </div>
    </>
  );

  if (embedded) {
    return <div className="overflow-hidden">{body}</div>;
  }

  return <EvaluationStepStack>{body}</EvaluationStepStack>;
}
