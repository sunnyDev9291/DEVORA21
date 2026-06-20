import { buildResumeChatSystemPrompt } from "@/lib/resume-chat-prompt";
import { streamDeepSeek, type ChatMessage } from "@/lib/deepseek-stream";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export const runtime = "nodejs";

interface ResumeChatRequest {
  content?: GeneratedResumeContent;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  messages?: Array<{ role?: string; content?: string }>;
}

export async function POST(req: Request) {
  let body: ResumeChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = body.content;
  if (!content?.title || !content.summary || !content.skills || !Array.isArray(content.experiences)) {
    return Response.json({ error: "Resume content is required for chat." }, { status: 400 });
  }

  const history: ChatMessage[] = (body.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content?.trim() ?? "",
    }))
    .filter((m) => m.content.length > 0)
    .slice(-16);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  const system: ChatMessage = {
    role: "system",
    content: buildResumeChatSystemPrompt({
      content,
      jobTitle: body.jobTitle,
      companyName: body.companyName,
      jobDescription: body.jobDescription,
    }),
  };

  return streamDeepSeek([system, ...history], 2048);
}
