interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = "or continue with email" }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-navy-900/80 px-3 text-slate-500">{label}</span>
      </div>
    </div>
  );
}
