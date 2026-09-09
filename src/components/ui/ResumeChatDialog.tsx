"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import ChatClearButton from "@/components/ui/ChatClearButton";
import CopyIconButton from "@/components/ui/CopyIconButton";
import { useChatScroll } from "@/hooks/useChatScroll";
import type { ResumeChatProfileContext } from "@/lib/resume-chat-prompt";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export type ResumeChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface ResumeChatDialogProps {
  open: boolean;
  onClose: () => void;
  content: GeneratedResumeContent | null;
  profile?: ResumeChatProfileContext;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  /** Reset conversation when the draft is regenerated. */
  generationKey?: number;
}

export default function ResumeChatDialog({
  open,
  onClose,
  content,
  profile,
  jobTitle = "",
  companyName = "",
  jobDescription = "",
  generationKey = 0,
}: ResumeChatDialogProps) {
  const [messages, setMessages] = useState<ResumeChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { listRef, handleScroll, pinToBottom } = useChatScroll([messages, loading]);

  useEffect(() => {
    setMessages([]);
    setError("");
    setInput("");
    pinToBottom();
  }, [generationKey, pinToBottom]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function handleClear() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError("");
    setInput("");
    setMessages([]);
    pinToBottom();
  }

  const hasConversation = messages.length > 0;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !content) return;

    setError("");
    setInput("");
    pinToBottom();

    const userMsg: ResumeChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    const history = [...messages, userMsg];

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/resume/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          profile,
          jobTitle,
          companyName,
          jobDescription,
          messages: history.map(({ role, content: body }) => ({ role, content: body })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status}).`);
      }

      if (!res.body) throw new Error("No response stream from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = (err as Error).message || "Something went wrong.";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
      abortRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    await sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleClose() {
    abortRef.current?.abort();
    onClose();
  }

  const targetLabel =
    jobTitle.trim() && companyName.trim()
      ? `${jobTitle.trim()} · ${companyName.trim()}`
      : jobTitle.trim() || "Your resume draft";

  const canSend = Boolean(content) && !loading && Boolean(input.trim());

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Resume Q&A"
      align="center"
      priority
      className="!max-h-[min(94dvh,920px)] max-w-4xl h-[min(92dvh,880px)]"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50/40 dark:bg-warm-950/30">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-orange-200/40 px-5 py-2.5 dark:border-orange-500/15">
          <p className="min-w-0 truncate text-sm text-stone-600 dark:text-stone-300">{targetLabel}</p>
          <ChatClearButton onClick={handleClear} disabled={loading || !hasConversation} />
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
        >
          {!hasConversation && !loading ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-4 text-center">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                How can I help with this application?
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                Ask anything using your resume draft, profile, and job details — field answers,
                interview points, or a pasted form question.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {messages.map((msg) => {
                const isStreamingAssistant =
                  loading && msg.role === "assistant" && !msg.content.trim();

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[min(100%,42rem)] rounded-2xl rounded-br-md bg-orange-600 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="flex max-w-[min(100%,42rem)] flex-col gap-1.5">
                        <div className="rounded-2xl rounded-bl-md border border-orange-200/50 bg-white px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-stone-800 dark:border-orange-500/15 dark:bg-warm-900/80 dark:text-stone-100">
                          {msg.content ||
                            (isStreamingAssistant ? (
                              <span className="inline-flex gap-1.5 text-stone-400">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                              </span>
                            ) : null)}
                        </div>
                        {msg.content.trim() ? (
                          <CopyIconButton
                            text={msg.content}
                            label="Copy answer"
                            className="h-8 w-fit self-start px-2.5"
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
              {error ? (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="shrink-0 border-t border-orange-200/40 bg-white/80 px-4 py-4 backdrop-blur-sm dark:border-orange-500/15 dark:bg-warm-950/50 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-orange-200/70 bg-white p-2 shadow-sm dark:border-orange-500/20 dark:bg-warm-900/90">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                content
                  ? "Message Resume Q&A…"
                  : "Generate a resume first…"
              }
              rows={1}
              disabled={loading || !content}
              className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-[15px] leading-snug text-stone-900 outline-none placeholder:text-stone-400 disabled:opacity-60 dark:text-stone-50"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-stone-400 dark:text-stone-500">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </Modal>
  );
}
