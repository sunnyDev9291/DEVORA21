import type { Metadata } from "next";
import Link from "next/link";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import CTASection from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how Devora21 works — book a free consultation, get assessed, build a plan, and execute with expert support at every step.",
};

const details = [
  {
    step: "01",
    title: "Book a Free Consultation",
    heading: "No pressure. No commitment.",
    body: "Start with a free 30-minute call. There are no sales tactics and no hard pitches — just an honest conversation about where you are and where you want to be. We listen first. We ask the right questions to fully understand your unique situation before suggesting anything.",
    points: [
      "Available via video call, voice call, or WhatsApp",
      "Slots available within 24–48 hours",
      "Zero cost, zero obligation",
    ],
  },
  {
    step: "02",
    title: "We Assess Your Needs",
    heading: "Honest evaluation, tailored to you.",
    body: "After understanding your situation, our team runs a clear-eyed assessment. We look at where you are, what's blocking you, and what the fastest realistic path to your goal looks like. We don't upsell — we tell you exactly what you need.",
    points: [
      "Skills and experience evaluation",
      "Job market and role fit analysis",
      "Gap identification and priority ranking",
    ],
  },
  {
    step: "03",
    title: "We Build a Plan Together",
    heading: "A roadmap built around your goals.",
    body: "You get a concrete, step-by-step action plan specific to your tech stack, experience level, and target outcome. No generic advice. No filler. Just a focused plan that tells you what to do, in what order, and why.",
    points: [
      "Custom timeline and milestones",
      "Specific resources and action items",
      "Regular check-in touchpoints",
    ],
  },
  {
    step: "04",
    title: "Execute & See Results",
    heading: "We work alongside you until you win.",
    body: "This is where the real work happens — and we're with you every step. Whether it's live debugging sessions, mock interviews, resume revisions, or architecture reviews, we stay engaged until you hit your goal and feel confident moving forward.",
    points: [
      "Hands-on sessions, not passive advice",
      "On-demand support when you need it most",
      "Measurable milestones to track progress",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-slate-50 dark:bg-navy-950 pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            The Process
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-5 tracking-tight">
            Simple. Clear. Effective.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            We designed our process to get you results fast — with no wasted time
            and no guesswork.
          </p>
        </div>
      </section>

      <HowItWorksSection />

      {/* Deep-dive detail */}
      <section className="bg-slate-50 dark:bg-navy-950 py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {details.map((item, index) => (
              <div
                key={item.step}
                className={`flex flex-col lg:flex-row gap-10 items-start ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Step badge */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-2xl">{item.step}</span>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1">
                  <h2 className="text-slate-900 dark:text-white text-2xl font-bold mb-1">{item.title}</h2>
                  <p className="text-blue-400 text-sm font-medium mb-4">{item.heading}</p>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{item.body}</p>
                  <ul className="space-y-2">
                    {item.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-300">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white dark:bg-navy-900 py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Your free consultation is one click away.</p>
          <Link
            href="/contact"
            className="inline-flex bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-600/25"
          >
            Book Free Consultation
          </Link>
        </div>
      </section>

      <CTASection />
    </>
  );
}
