import FadeIn from "@/components/ui/FadeIn";
import { HOW_IT_WORKS } from "@/lib/constants";

export default function HowItWorksSection() {
  return (
    <section className="bg-white dark:bg-navy-900 py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            A clear, simple process designed to get you results as fast as possible.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

          {HOW_IT_WORKS.map((item, index) => (
            <FadeIn key={item.step} delay={index * 120} direction="up">
            <div className="relative flex flex-col items-center text-center p-6">
              {/* Step number */}
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-xl">{item.step}</span>
                </div>
                {index < HOW_IT_WORKS.length - 1 && (
                  <div className="lg:hidden absolute top-1/2 -right-3 w-6 h-px bg-blue-500/30" />
                )}
              </div>

              <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-3">{item.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{item.description}</p>
            </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
