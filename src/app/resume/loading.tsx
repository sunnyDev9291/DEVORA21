export default function ResumeLoading() {
  return (
    <div className="bg-slate-50 dark:bg-navy-950 py-12 sm:py-16" aria-busy="true" aria-label="Loading resume builder">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
        <div className="flex justify-center gap-4 mb-10">
          {[1, 2, 3].map((step) => (
            <div key={step} className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10" />
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-navy-900 overflow-hidden">
          <div className="h-24 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-100 dark:bg-white/[0.03]" />
          <div className="p-8 space-y-4">
            <div className="h-10 rounded-xl bg-slate-200 dark:bg-white/10 w-2/3" />
            <div className="h-32 rounded-xl bg-slate-200 dark:bg-white/10" />
            <div className="h-32 rounded-xl bg-slate-200 dark:bg-white/10" />
            <div className="h-12 rounded-xl bg-blue-200 dark:bg-blue-500/20 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
