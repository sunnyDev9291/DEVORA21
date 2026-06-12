"use client";

import { useState } from "react";
import LiveChatDialog from "@/components/ui/LiveChatDialog";
import AiChatDialog from "@/components/ui/AiChatDialog";

export default function ChatWidgets() {
  const [liveOpen, setLiveOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  function toggleLive() {
    setAiOpen(false);
    setLiveOpen((v) => !v);
  }

  function toggleAi() {
    setLiveOpen(false);
    setAiOpen((v) => !v);
  }

  return (
    <>
      {/* DeepSeek — direct model chat */}
      <button
        type="button"
        onClick={toggleAi}
        aria-label={aiOpen ? "Close DeepSeek chat" : "Open DeepSeek chat"}
        aria-expanded={aiOpen}
        className={`fixed bottom-[5.5rem] right-6 z-[101] flex items-center gap-2 text-white text-sm font-semibold pl-3.5 pr-4 h-11 rounded-full shadow-xl transition-all duration-200 hover:-translate-y-1 hover:scale-105 ${
          aiOpen
            ? "bg-slate-700 hover:bg-slate-600 shadow-slate-700/30"
            : "bg-violet-600 hover:bg-violet-500 shadow-violet-600/30 hover:shadow-violet-500/40"
        }`}
      >
        {aiOpen ? (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            DeepSeek
          </>
        )}
      </button>

      {/* Live Chat — person to person */}
      <button
        type="button"
        onClick={toggleLive}
        aria-label={liveOpen ? "Close live chat" : "Open live chat"}
        aria-expanded={liveOpen}
        className={`fixed bottom-6 right-6 z-[101] flex items-center gap-2.5 text-white text-sm font-semibold pl-4 pr-5 h-12 rounded-full shadow-xl transition-all duration-200 hover:-translate-y-1 hover:scale-105 ${
          liveOpen
            ? "bg-slate-700 hover:bg-slate-600 shadow-slate-700/30"
            : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 hover:shadow-blue-500/40"
        }`}
      >
        {liveOpen ? (
          <>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </>
        ) : (
          <>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Live Chat
          </>
        )}
      </button>

      <LiveChatDialog open={liveOpen} onClose={() => setLiveOpen(false)} />
      <AiChatDialog open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
