import { readFile } from "fs/promises";
import path from "path";
import { completeDeepSeek } from "@/lib/deepseek-stream";
import { applyContentToDocx, parseExperiencesFromDocxBuffer } from "@/lib/resume-docx";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert resume writer for software engineers.
Rewrite ONLY the summary, skills, and experience bullets for a target job.
Keep the same companies, roles, and date ranges from the template — do not invent new employers.

Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "skills": "comma-separated skill list",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "MM/YYYY – MM/YYYY",
      "bullets": ["bullet 1", "bullet 2"]
    }
  ]
}

Rules:
- summary: 2–4 sentences, ATS-friendly, no first-person pronouns.
- skills: one comma-separated line, mirror job keywords where truthful.
- experiences: one entry per company from the template, same count and order.
- bullets: 6–10 strong bullets per company, action verbs, quantify impact where possible.
- No markdown fences, no commentary — JSON only.`;

interface ResumeRequest {
  jobTitle?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
}

function parseJsonContent(raw: string): GeneratedResumeContent {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedResumeContent;

  if (!parsed.summary || !parsed.skills || !Array.isArray(parsed.experiences)) {
    throw new Error("AI response missing required resume fields.");
  }

  return {
    summary: String(parsed.summary).trim(),
    skills: String(parsed.skills).trim(),
    experiences: parsed.experiences.map((e) => ({
      company: String(e.company ?? "").trim(),
      role: String(e.role ?? "").trim(),
      dates: String(e.dates ?? "").trim(),
      bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
    })),
  };
}

export async function POST(req: Request) {
  let body: ResumeRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobTitle = body.jobTitle?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";

  if (!jobTitle && !jobDescription) {
    return Response.json(
      { error: "Provide at least a job title or a job description." },
      { status: 400 }
    );
  }

  const templateInput = body.templateName?.trim();
  if (!templateInput) {
    return Response.json({ error: "templateName is required — select a template first." }, { status: 400 });
  }

  try {
    const safeName = path.basename(
      templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`
    );
    const filePath = path.join(TEMPLATES_DIR, safeName);
    const templateName = safeName.replace(/\.docx$/i, "");

    if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
      return Response.json({ error: "Invalid template." }, { status: 400 });
    }

    const templateBuffer = await readFile(filePath);
    const existingExperiences = parseExperiencesFromDocxBuffer(templateBuffer);

    const userPrompt = [
      jobTitle && `Target job title: ${jobTitle}`,
      jobDescription && `Job description:\n${jobDescription}`,
      customPrompt && `Additional instructions:\n${customPrompt}`,
      `Template companies to preserve (same order, roles, dates):\n${JSON.stringify(existingExperiences, null, 2)}`,
      "Rewrite summary, skills, and experience bullets for the target role. Return JSON only.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiRaw = await completeDeepSeek(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      8192
    );

    const parsed = parseJsonContent(aiRaw);

    // Always align experiences with template companies, roles, and dates
    const content: GeneratedResumeContent = {
      summary: parsed.summary,
      skills: parsed.skills,
      experiences: existingExperiences.map((existing, i) => {
        const generated = parsed.experiences[i];
        return {
          company: existing.company,
          role: existing.role,
          dates: existing.dates,
          bullets: generated?.bullets?.length ? generated.bullets : existing.bullets,
        };
      }),
    };

    if (content.experiences.length === 0) {
      throw new Error("No experience sections found in template.");
    }

    const updatedBuffer = applyContentToDocx(templateBuffer, content);
    const docxBase64 = updatedBuffer.toString("base64");
    const fileName = `${templateName}-tailored.docx`;

    return Response.json({
      content,
      templateName,
      docxBase64,
      fileName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate resume.";
    return Response.json({ error: message }, { status: 500 });
  }
}
