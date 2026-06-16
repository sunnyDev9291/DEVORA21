import { completeDeepSeek, iterateDeepSeekStream } from "@/lib/deepseek-stream";
import {
  detectResumeGenerationPhase,
  mergeResumeWithTemplate,
  parseResumeJsonContent,
  pickResumeModelText,
  RESUME_MAX_TOKENS,
  type ResumeGenerationPhase,
} from "@/lib/resume-prompt";
import type { ResumeGeneratePrep } from "@/lib/resume-generate-prep";

function ndjson(data: Record<string, unknown>): string {
  return `${JSON.stringify(data)}\n`;
}

export function buildResumeNdjsonStream(prep: ResumeGeneratePrep): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const enqueue = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(ndjson(payload)));
      };

      try {
        const { messages, existingExperiences, headerTitle, templateName } = prep;

        let thinking = "";
        let output = "";
        let phase: ResumeGenerationPhase = "starting";
        enqueue({ type: "phase", phase });

        for await (const delta of iterateDeepSeekStream(messages, RESUME_MAX_TOKENS, {
          jsonObject: true,
        })) {
          if (delta.reasoning) {
            thinking += delta.reasoning;
            enqueue({ type: "thinking", text: delta.reasoning });
          }
          if (delta.content) {
            output += delta.content;
            enqueue({ type: "output", text: delta.content });
          }

          const nextPhase = detectResumeGenerationPhase(thinking, output);
          if (nextPhase !== phase) {
            phase = nextPhase;
            enqueue({ type: "phase", phase });
          }
        }

        enqueue({ type: "phase", phase: "finalizing" });

        let modelText = pickResumeModelText(output, thinking);
        if (!modelText) {
          enqueue({
            type: "error",
            message: "AI returned no content. Check DEEPSEEK_API_KEY and try again.",
          });
          controller.close();
          return;
        }

        let parsed;
        try {
          parsed = parseResumeJsonContent(modelText);
        } catch {
          enqueue({ type: "phase", phase: "finalizing" });
          modelText = await completeDeepSeek(messages, RESUME_MAX_TOKENS, { jsonObject: true });
          parsed = parseResumeJsonContent(modelText);
        }

        const content = mergeResumeWithTemplate(parsed, existingExperiences, headerTitle);
        enqueue({ type: "done", content, templateName });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate resume content.";
        enqueue({ type: "error", message });
        controller.close();
      }
    },
  });
}

export function resumeNdjsonResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function runResumeGenerationSync(prep: ResumeGeneratePrep): Promise<string> {
  const modelText = await completeDeepSeek(prep.messages, RESUME_MAX_TOKENS, {
    jsonObject: true,
  });
  if (!modelText.trim()) {
    throw new Error("AI returned no content. Check DEEPSEEK_API_KEY and try again.");
  }
  return modelText;
}
