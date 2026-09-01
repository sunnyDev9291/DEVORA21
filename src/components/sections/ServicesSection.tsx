import Link from "next/link";
import ServiceCard from "@/components/ui/ServiceCard";
import FadeIn from "@/components/ui/FadeIn";
import { SERVICES } from "@/lib/constants";

interface ServicesSectionProps {
  limit?: number;
  showCTA?: boolean;
}

export default function ServicesSection({ limit, showCTA = true }: ServicesSectionProps) {
  const services = limit ? SERVICES.slice(0, limit) : SERVICES;

  return (
    <section className="bg-gradient-to-b from-warm-50 via-orange-50/50 to-amber-50/30 dark:from-warm-950 dark:via-warm-950 dark:to-warm-900 py-24 sm:py-32" aria-labelledby="services-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-14">
          <h2 id="services-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
            Every Service an Engineer Needs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            From your first application to your next promotion — we cover every
            critical stage of a software engineer&apos;s career.
          </p>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none m-0 p-0">
          {services.map((service, i) => (
            <li key={service.id}>
              <FadeIn delay={i * 80} direction="up">
                <ServiceCard {...service} featured={i === 3} />
              </FadeIn>
            </li>
          ))}
        </ul>

        {showCTA && limit && SERVICES.length > limit && (
          <div className="mt-12 text-center">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-all"
            >
              View All {SERVICES.length} Services
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
