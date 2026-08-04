import {
  completeAiChat,
  iterateAiChatStream,
  type AiChatMessage,
  type AiCompletionOptions,
  type AiStreamDelta,
} from "@/lib/ai-backend-client";

export const DEEPSEEK_MODEL = "claude-sonnet-4-6";

export type ChatMessage = AiChatMessage;
export type DeepSeekCallOptions = AiCompletionOptions;
export type DeepSeekStreamDelta = AiStreamDelta;

export async function completeDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096,
  options?: Omit<DeepSeekCallOptions, "maxTokens"> & { maxTokens?: number }
): Promise<string> {
  return completeAiChat(messages, maxTokens, {
    maxTokens: options?.maxTokens ?? maxTokens,
    jsonObject: options?.jsonObject,
    userId: options?.userId,
    userAuthorization: options?.userAuthorization,
  });
}

export async function* iterateDeepSeekStream(
  messages: ChatMessage[],
  maxTokens = 4096,
  options?: Omit<DeepSeekCallOptions, "maxTokens"> & { maxTokens?: number }
): AsyncGenerator<DeepSeekStreamDelta> {
  yield* iterateAiChatStream(messages, maxTokens, {
    maxTokens: options?.maxTokens ?? maxTokens,
    jsonObject: options?.jsonObject,
    userId: options?.userId,
    userAuthorization: options?.userAuthorization,
  });
}

export async function streamDeepSeek(
  messages: ChatMessage[],
  maxTokens = 4096
): Promise<Response> {
  if (!process.env.BACKEND_API_URL && !process.env.NEXT_PUBLIC_API_BASE_URL) {
    return Response.json(
      { error: "AI backend is not configured. Set BACKEND_API_URL on the server." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of iterateDeepSeekStream(messages, maxTokens)) {
          if (delta.content) controller.enqueue(encoder.encode(delta.content));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate a response.";
        controller.enqueue(encoder.encode(`\n\n[Error] ${message}`));
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
