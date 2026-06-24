"use client";

interface ChatClearButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function ChatClearButton({ onClick, disabled = false }: ChatClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-lg border border-slate-200/80 dark:border-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06] dark:hover:text-white"
      aria-label="Clear chat"
    >
      Clear
    </button>
  );
}
