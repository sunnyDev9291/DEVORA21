"use client";

import { EvaluationHeroLoader, EvaluationRowLoader } from "@/components/ui/ResumeStepLoader";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";

const IMPROVE_PHASES: Array<{
  phase: ResumeGenerationPhase;
  title: string;
  description: string;
}> = [
  {
    phase: "starting",
    title: "Preparing focused improvement",
    description: "Locking the current draft as the baseline",
  },
  {
    phase: "analyzing",
    title: "Reading selected score item",
    description: "Using only the clicked feedback as the target",
  },
  {
    phase: "summary",
    title: "Finding smallest safe edit",
    description: "Avoiding unrelated rewrites",
  },
  {
    phase: "experiences",
    title: "Applying targeted wording",
    description: "Updating only the affected resume field",
  },
  {
    phase: "finalizing",
    title: "Checking improvement",
    description: "Comparing score and content changes",
  },
];

function phaseIndex(phase: ResumeGenerationPhase): number {
  const exact = IMPROVE_PHASES.findIndex((item) => item.phase === phase);
  if (exact >= 0) return exact;
  if (phase === "title" || phase === "skills") return 2;
  return 0;
}

interface ResumeImproveProgressProps {
  phase: ResumeGenerationPhase;
  targetLabel?: string;
}

export default function ResumeImproveProgress({
  phase,
  targetLabel,
}: ResumeImproveProgressProps) {
  const currentIdx = phaseIndex(phase);
  const current = IMPROVE_PHASES[currentIdx] ?? IMPROVE_PHASES[0];

  return (
    <div className="overflow-hidden">
      <EvaluationHeroLoader
        title={`${current.title}...`}
        description={targetLabel ? `Target: ${targetLabel}` : current.description}
        accent="emerald"
      />
      {IMPROVE_PHASES.map((step, idx) => {
        if (idx === currentIdx) return null;
        const state = idx < currentIdx ? "done" : "pending";
        return (
          <EvaluationRowLoader
            key={step.phase}
            title={state === "done" ? step.title : `${step.title}...`}
            description={step.description}
            accent="emerald"
            state={state}
          />
        );
      })}
    </div>
  );
}
