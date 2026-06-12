import { streamDeepSeek, type ChatMessage } from "@/lib/deepseek-stream";

export const runtime = "nodejs";

interface ChatRequest {
  messages?: Array<{ role?: string; content?: string }>;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const history: ChatMessage[] = (body.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content?.trim() ?? "",
    }))
    .filter((m) => m.content.length > 0)
    .slice(-20);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  return streamDeepSeek(history, 4096);
}
