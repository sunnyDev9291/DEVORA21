"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import ChatClearButton from "@/components/ui/ChatClearButton";
import { useChatScroll } from "@/hooks/useChatScroll";
import {
  RESUME_CHAT_QUICK_PROMPTS,
  type ResumeChatProfileContext,
} from "@/lib/resume-chat-prompt";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export type ResumeChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function buildWelcome(): ResumeChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "I use your profile and current resume draft to help fill job application fields and prep interview answers in real time. Paste a form question or field label, or pick a quick prompt below.",
  };
}

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
  const [messages, setMessages] = useState<ResumeChatMessage[]>([buildWelcome()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { listRef, handleScroll, pinToBottom } = useChatScroll([messages, loading]);

  useEffect(() => {
    setMessages([buildWelcome()]);
    setError("");
    setInput("");
    pinToBottom();
  }, [generationKey, pinToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleClear() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError("");
    setInput("");
    setMessages([buildWelcome()]);
    pinToBottom();
  }

  const hasConversation = messages.some((m) => m.id !== "welcome");

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
    const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];

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

  const profileLabel = profile?.fullName?.trim() || profile?.email?.trim() || "";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Resume Q&A · Application assist"
      align="top"
      priority
      className="max-w-2xl h-[min(72vh,680px)]"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between gap-3 px-4 py-2 border-b border-slate-200 dark:border-white/[0.06] bg-blue-500/[0.06] shrink-0">
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{targetLabel}</span>
            {profileLabel && (
              <span className="text-[11px] text-blue-600/80 dark:text-blue-300/80 truncate">
                Profile: {profileLabel}
              </span>
            )}
          </div>
          <ChatClearButton onClick={handleClear} disabled={loading || !hasConversation} />
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-200/80 dark:border-white/[0.06]"
                }`}
              >
                {msg.content ||
                  (loading && msg.role === "assistant" ? (
                    <span className="inline-flex gap-1 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                    </span>
                  ) : null)}
              </div>
            </div>
          ))}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {content && (
          <div className="shrink-0 border-t border-slate-200 dark:border-white/[0.06] px-3 pt-3 pb-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Quick prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RESUME_CHAT_QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors hover:border-blue-500/30 hover:bg-blue-500/[0.06] hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="shrink-0 border-t border-slate-200 dark:border-white/[0.08] p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                content
                  ? "Paste a job site field or question, e.g. “Describe your relevant experience”…"
                  : "Generate a resume first…"
              }
              rows={2}
              disabled={loading || !content}
              className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || !content}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
