const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-v4-pro";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function completeDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing DEEPSEEK_API_KEY. Add it to .env.local and restart.");
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: maxTokens,
      stream: false,
      messages,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`DeepSeek API error (${upstream.status}): ${detail || upstream.statusText}`);
  }

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from DeepSeek.");
  return content;
}

export async function streamDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096
): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing DEEPSEEK_API_KEY. Add it to .env.local and restart." },
      { status: 500 }
    );
  }

  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: maxTokens,
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: `DeepSeek API error (${upstream.status}): ${detail || upstream.statusText}` },
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return Response.json({ error: "No response stream from DeepSeek." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
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
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // Skip malformed SSE chunks.
            }
          }
        }
        controller.close();
      } catch {
        controller.enqueue(encoder.encode("\n\n[Error] Failed to generate a response."));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
