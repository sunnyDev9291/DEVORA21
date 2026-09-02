import { CONTACT_INFO } from "@/lib/constants";

const highlights = [
  "Live help during mock interviews and prep sessions",
  "Technical screen walkthroughs and system design practice",
  "Behavioral question coaching in real time",
  "Confidential support from engineers who've been there",
];

const actions = [
  {
    href: CONTACT_INFO.whatsapp,
    title: "Start on WhatsApp",
    description: "Fastest option — we usually reply within minutes.",
    external: true,
    accent: "green",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    href: CONTACT_INFO.calendly,
    title: "Book a Session",
    description: "Pick a 30-minute slot on Calendly.",
    external: true,
    accent: "blue",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
] as const;

const accentStyles = {
  green: {
    card: "border-green-500/25 bg-green-500/[0.05] hover:border-green-500/45 hover:bg-green-500/[0.1]",
    icon: "bg-green-500/15 border-green-500/25 text-green-400",
    arrow: "text-green-400",
  },
  blue: {
    card: "border-orange-500/25 bg-blue-500/[0.05] hover:border-orange-500/45 hover:bg-blue-500/[0.1]",
    icon: "bg-orange-500/15 border-orange-500/25 text-orange-400",
    arrow: "text-orange-400",
  },
} as const;

export default function RealTimeInterviewContent() {
  return (
    <section className="bg-white dark:bg-warm-900 py-20 sm:py-24" aria-labelledby="rti-heading">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="rti-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Interview support, live
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
            Whether you&apos;re practicing for a technical screen or need help the day before
            a real interview, Devora21 connects you with engineers who can coach you in real time.
            Full in-app sessions are coming soon.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 gap-3 mb-12 list-none m-0 p-0" role="list">
          {highlights.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] px-4 py-3.5 text-slate-600 dark:text-slate-300 text-sm"
            >
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </li>
          ))}
        </ul>

        <div className="grid sm:grid-cols-2 gap-4">
          {actions.map((action) => {
            const styles = accentStyles[action.accent];
            return (
              <a
                key={action.title}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 ${styles.card}`}
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-slate-900 dark:text-white font-semibold text-base">{action.title}</p>
                    <svg
                      className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${styles.arrow}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">{action.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
