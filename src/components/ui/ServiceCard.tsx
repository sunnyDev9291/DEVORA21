import Link from "next/link";

interface ServiceCardProps {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  featured?: boolean;
}

export default function ServiceCard({
  id,
  icon,
  title,
  description,
  features,
  featured = false,
}: ServiceCardProps) {
  return (
    <div
      className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
        featured
          ? "bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border-blue-500/30 hover:border-blue-400/50"
          : "bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] shadow-sm dark:shadow-none"
      }`}
    >
      {featured && (
        <span className="absolute top-4 right-4 bg-blue-500/20 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-500/20">
          Popular
        </span>
      )}

      <div className="text-3xl mb-4">{icon}</div>

      <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-2 leading-snug">{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5 flex-1">{description}</p>

      <ul className="space-y-2 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <svg
              className="w-4 h-4 text-blue-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href={`/contact?service=${id}`}
        className="mt-auto text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors group-hover:gap-2.5"
      >
        Get started
        <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  );
}
