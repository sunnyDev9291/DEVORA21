import { API_BASE_URL } from "@/lib/api-base-url";

export type BrowserAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrowserAiStreamDelta = {
  content?: string;
};

const MID_STREAM_ERROR = /(?:^|\n)\[error\]\s*(.+)$/i;

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

function throwIfMidStreamError(accumulated: string): void {
  const match = MID_STREAM_ERROR.exec(accumulated);
  if (match?.[1]) {
    throw new Error(match[1].trim());
  }
}

/**
 * Stream chat completions directly from api.devora21.com as raw plain text chunks
 * (not SSE / not JSON envelopes). Avoids Netlify timeouts on long Claude responses.
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
      Accept: "text/plain",
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
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    accumulated += chunk;
    throwIfMidStreamError(accumulated);
    yield { content: chunk };
  }

  // Flush any remaining decoder state
  const tail = decoder.decode();
  if (tail) {
    accumulated += tail;
    throwIfMidStreamError(accumulated);
    yield { content: tail };
  }
}
