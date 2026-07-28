import { API_BASE_URL } from "@/lib/api-base-url";

export type BrowserAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrowserAiStreamDelta = {
  content?: string;
};

function resolveBrowserAiKey(): string {
  const key = process.env.NEXT_PUBLIC_AI_INTERNAL_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_AI_INTERNAL_API_KEY. Set it to the same value as AI_INTERNAL_API_KEY so the browser can stream from the API."
    );
  }
  return key;
}

async function readHttpError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) {
    return `AI backend error (${response.status}): ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    return parsed.error || parsed.message || detail;
  } catch {
    return detail;
  }
}

/**
 * Stream chat completions directly from api.devora21.com (SSE).
 * Does not go through Netlify — avoids function timeouts on long Claude responses.
 */
export async function* iterateBrowserAiStream(
  messages: BrowserAiChatMessage[],
  maxTokens = 4096,
  options?: { jsonObject?: boolean; signal?: AbortSignal }
): AsyncGenerator<BrowserAiStreamDelta> {
  const response = await fetch(`${API_BASE_URL}/ai/chat/completions/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${resolveBrowserAiKey()}`,
    },
    body: JSON.stringify({
      messages,
      maxTokens,
      jsonObject: options?.jsonObject ?? false,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(await readHttpError(response));
  }
  if (!response.body) {
    throw new Error("No response stream from AI backend.");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed: {
        error?: string;
        choices?: Array<{ delta?: { content?: string } }>;
      };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      if (parsed.error) {
        throw new Error(parsed.error);
      }

      const content = parsed.choices?.[0]?.delta?.content;
      if (content) yield { content };
    }
  }
}
