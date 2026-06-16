import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";

export type ResumeStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "output"; text: string }
  | { type: "phase"; phase: ResumeGenerationPhase }
  | { type: "done"; content: GeneratedResumeContent; templateName: string }
  | { type: "error"; message: string };

function parseStreamLine(line: string): ResumeStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ResumeStreamEvent;
  } catch {
    return null;
  }
}

export async function consumeResumeStream(
  response: Response,
  handlers: {
    onThinking?: (text: string, full: string) => void;
    onOutput?: (text: string, full: string) => void;
    onPhase?: (phase: ResumeGenerationPhase) => void;
    onDone?: (content: GeneratedResumeContent, templateName: string) => void;
    onError?: (message: string) => void;
  }
): Promise<{ content: GeneratedResumeContent; templateName: string }> {
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `Request failed (${response.status}).`);
  }

  if (!response.body) {
    throw new Error("No response stream from server.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let thinking = "";
  let output = "";
  let result: { content: GeneratedResumeContent; templateName: string } | null = null;

  const handleEvent = (event: ResumeStreamEvent) => {
    switch (event.type) {
      case "thinking":
        thinking += event.text;
        handlers.onThinking?.(event.text, thinking);
        break;
      case "output":
        output += event.text;
        handlers.onOutput?.(event.text, output);
        break;
      case "phase":
        handlers.onPhase?.(event.phase);
        break;
      case "done":
        result = { content: event.content, templateName: event.templateName };
        handlers.onDone?.(event.content, event.templateName);
        break;
      case "error":
        handlers.onError?.(event.message);
        throw new Error(event.message);
      default:
        break;
    }
  };

  const processBufferedLines = (flushRemainder: boolean) => {
    const lines = buffer.split("\n");
    if (flushRemainder) {
      buffer = "";
      for (const line of lines) {
        const event = parseStreamLine(line);
        if (event) handleEvent(event);
      }
      return;
    }

    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event) handleEvent(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    processBufferedLines(false);

    if (done) {
      if (buffer.trim()) {
        const event = parseStreamLine(buffer);
        buffer = "";
        if (event) {
          handleEvent(event);
        } else {
          throw new Error("Resume generation was interrupted. Please try again.");
        }
      }
      break;
    }
  }

  if (!result) {
    throw new Error("Stream ended without resume content. Please try again.");
  }

  return result;
}
