"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import ChatClearButton from "@/components/ui/ChatClearButton";
import { useChatScroll } from "@/hooks/useChatScroll";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const WELCOME: AiChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hello! How can I help you today?",
};

interface AiChatDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AiChatDialog({ open, onClose }: AiChatDialogProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { listRef, handleScroll, pinToBottom } = useChatScroll([messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleClear() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError("");
    setInput("");
    setMessages([WELCOME]);
    pinToBottom();
  }

  const hasConversation = messages.some((m) => m.id !== "welcome");

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    pinToBottom();

    const userMsg: AiChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
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
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClose() {
    abortRef.current?.abort();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="DeepSeek" variant="panel">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 dark:border-white/[0.06] bg-violet-500/[0.06] shrink-0">
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">claude-sonnet-4-6</span>
        <ChatClearButton onClick={handleClear} disabled={loading || !hasConversation} />
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-br-md"
                  : "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-200/80 dark:border-white/[0.06]"
              }`}
            >
              {msg.content || (loading && msg.role === "assistant" ? (
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

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-slate-200 dark:border-white/[0.08] p-3"
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message DeepSeek…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </Modal>
  );
}
