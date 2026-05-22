import TestimonialCard from "@/components/ui/TestimonialCard";
import { TESTIMONIALS } from "@/lib/constants";

interface TestimonialsSectionProps {
  limit?: number;
}

export default function TestimonialsSection({ limit }: TestimonialsSectionProps) {
  const testimonials = limit ? TESTIMONIALS.slice(0, limit) : TESTIMONIALS;

  return (
    <section className="bg-navy-950 py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Success Stories
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Engineers Who Leveled Up
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Real results from real software engineers who worked with Devora21.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>
      </div>
    </section>
  );
}
