import { readFile } from "fs/promises";
import path from "path";
import { completeDeepSeek, iterateDeepSeekStream } from "@/lib/deepseek-stream";
import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { resolveExperiencesFromDocx } from "@/lib/resume-docx-ai-parse";
import {
  RESUME_SYSTEM_PROMPT,
  buildResumeUserPrompt,
  detectResumeGenerationPhase,
  mergeResumeWithTemplate,
  parseResumeJsonContent,
  pickResumeModelText,
  RESUME_MAX_TOKENS,
  type ResumeGenerationPhase,
} from "@/lib/resume-prompt";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export const runtime = "nodejs";
/** Netlify/serverless: allow long AI resume generation (upgrade plan for >26s). */
export const maxDuration = 60;

interface ResumeRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
}

function ndjson(data: Record<string, unknown>): string {
  return `${JSON.stringify(data)}\n`;
}

export async function POST(req: Request) {
  let body: ResumeRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";

  if (!jobTitle) {
    return Response.json({ error: "Job title is required." }, { status: 400 });
  }

  if (!companyName) {
    return Response.json({ error: "Company name is required." }, { status: 400 });
  }

  const templateInput = body.templateName?.trim();
  if (!templateInput) {
    return Response.json({ error: "templateName is required — select a template first." }, { status: 400 });
  }

  const safeName = path.basename(
    templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`
  );
  const filePath = path.join(TEMPLATES_DIR, safeName);
  const templateName = safeName.replace(/\.docx$/i, "");

  if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
    return Response.json({ error: "Invalid template." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(ndjson(payload)));
      };

      try {
        const templateBuffer = await readFile(filePath);
        const existingExperiences = await resolveExperiencesFromDocx(templateBuffer);
        const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

        if (existingExperiences.length === 0) {
          enqueue({ type: "error", message: "No experience sections found in template." });
          controller.close();
          return;
        }

        const userPrompt = buildResumeUserPrompt({
          jobTitle,
          companyName,
          jobDescription,
          customPrompt,
          headerTitle: header.title,
          existingExperiences,
        });

        const messages = [
          { role: "system" as const, content: RESUME_SYSTEM_PROMPT },
          { role: "user" as const, content: userPrompt },
        ];

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

        const content = mergeResumeWithTemplate(parsed, existingExperiences, header.title);

        enqueue({ type: "done", content, templateName });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate resume content.";
        enqueue({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
