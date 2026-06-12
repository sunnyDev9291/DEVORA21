import TestimonialCard from "@/components/ui/TestimonialCard";
import FadeIn from "@/components/ui/FadeIn";
import { TESTIMONIALS } from "@/lib/constants";

interface TestimonialsSectionProps {
  limit?: number;
}

export default function TestimonialsSection({ limit }: TestimonialsSectionProps) {
  const testimonials = limit ? TESTIMONIALS.slice(0, limit) : TESTIMONIALS;

  return (
    <section className="bg-slate-50 dark:bg-navy-950 py-24 sm:py-32" aria-labelledby="testimonials-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-14">
          <h2 id="testimonials-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
            Engineers Who Leveled Up
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            Real results from real software engineers who worked with Devora21.
          </p>
        </header>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 list-none m-0 p-0">
          {testimonials.map((t, i) => (
            <li key={t.name}>
              <FadeIn delay={i * 100} direction="up">
                <TestimonialCard {...t} />
              </FadeIn>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
