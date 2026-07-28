"use client";

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
  finalizing: "Filling structured fields from the raw JSON",
};

function phaseIndex(phase: ResumeGenerationPhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

interface ResumeThinkingProgressProps {
  phase: ResumeGenerationPhase;
  jobTitle?: string;
  embedded?: boolean;
}

export default function ResumeThinkingProgress({
  phase,
  jobTitle,
  embedded = false,
}: ResumeThinkingProgressProps) {
  const currentIdx = phaseIndex(phase);
  const heroTitle = `${RESUME_PHASE_LABELS[phase]}…`;
  const heroDescription = jobTitle
    ? `Target role: ${jobTitle}`
    : PHASE_DESCRIPTIONS[phase];

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
    </>
  );

  if (embedded) {
    return <div className="overflow-hidden">{body}</div>;
  }

  return <EvaluationStepStack>{body}</EvaluationStepStack>;
}
