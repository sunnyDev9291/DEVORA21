interface TestimonialCardProps {
  name: string;
  role: string;
  content: string;
  rating: number;
  initials: string;
}

const avatarColors = [
  "from-orange-500 to-blue-700",
  "from-indigo-500 to-indigo-700",
  "from-violet-500 to-violet-700",
  "from-cyan-500 to-cyan-700",
  "from-sky-500 to-sky-700",
  "from-blue-400 to-sun-400",
];

export default function TestimonialCard({
  name,
  role,
  content,
  rating,
  initials,
}: TestimonialCardProps) {
  const colorIndex = name.charCodeAt(0) % avatarColors.length;

  return (
    <figure className="flex flex-col bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 hover:border-slate-300 dark:hover:border-white/[0.14] transition-all duration-300 shadow-sm dark:shadow-none h-full">
      <div className="flex gap-0.5 mb-4" aria-label={`${rating} out of 5 stars`} role="img">
        {Array.from({ length: rating }).map((_, i) => (
          <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      <blockquote className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 flex-1">
        <p>&ldquo;{content}&rdquo;</p>
      </blockquote>

      <figcaption className="flex items-center gap-3 not-italic">
        <div
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[colorIndex]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <cite className="text-slate-900 dark:text-white text-sm font-semibold not-italic">{name}</cite>
          <p className="text-slate-500 dark:text-slate-500 text-xs">{role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
