import { computeHumanToneScore } from "@/lib/resume-human-tone-algorithm";
import type { GeneratedResumeContent, HumanToneScoreResult } from "@/lib/resume-types";

export {
  HUMAN_TONE_PASS_THRESHOLD,
  HUMAN_TONE_SCORE_MAX,
} from "@/lib/resume-human-tone-algorithm";

/** Deterministic human-tone evaluation — separate from ATS keyword scoring. */
export function evaluateHumanToneScore(content: GeneratedResumeContent): HumanToneScoreResult {
  return computeHumanToneScore(content);
}
