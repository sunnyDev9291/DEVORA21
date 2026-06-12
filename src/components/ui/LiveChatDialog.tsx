"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { CONTACT_INFO } from "@/lib/constants";

export type LiveChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
};

const WELCOME: LiveChatMessage = {
  id: "welcome",
  role: "agent",
  content:
    "Hi there! You're chatting with the Devora21 team. Send a message and we'll pick it up on WhatsApp — we usually reply within a few hours.",
};

interface LiveChatDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function LiveChatDialog({ open, onClose }: LiveChatDialogProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: LiveChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);

    window.setTimeout(() => {
      const reply: LiveChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        content:
          "Thanks! Continue on WhatsApp for a direct reply from our team — your message is ready to send.",
      };
      setMessages((prev) => [...prev, reply]);
      setSending(false);

      const transcript = [...messages.filter((m) => m.id !== "welcome"), userMsg]
        .map((m) => `${m.role === "user" ? "Me" : "Devora21"}: ${m.content}`)
        .join("\n");
      const url = `${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(transcript)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }, 600);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Live Chat" variant="panel">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Devora21 Team · typically replies within hours</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-200/80 dark:border-white/[0.06]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.06]">
              <span className="inline-flex gap-1 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
              </span>
            </div>
          </div>
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
            placeholder="Message the team…"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
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
