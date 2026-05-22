import type { Metadata } from "next";
import Link from "next/link";
import CTASection from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "About",
  description:
    "Devora21 is a software engineering job support and tech consulting company built by engineers, for engineers. Learn about our mission and values.",
};

const values = [
  {
    icon: "🎯",
    title: "Results Over Advice",
    description:
      "We don't give generic tips. We work with you until the problem is solved and the goal is reached.",
  },
  {
    icon: "🔒",
    title: "Confidentiality First",
    description:
      "Your career, your code, your company — everything stays between us. No exceptions.",
  },
  {
    icon: "⚡",
    title: "Honest & Direct",
    description:
      "We tell you what you need to hear, not what you want to hear. Real guidance means real honesty.",
  },
  {
    icon: "🤝",
    title: "Engineers Supporting Engineers",
    description:
      "We've been in the trenches. We know what it's like to face a tough interview, a broken deployment, or a stalled career.",
  },
  {
    icon: "📈",
    title: "Long-Term Thinking",
    description:
      "We help you solve today's problem while building the skills and habits that make you stronger long-term.",
  },
  {
    icon: "🌍",
    title: "Built for the US Market",
    description:
      "Our services are designed specifically for software engineers navigating the US tech job market and workplace.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 pt-32 pb-20 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Who We Are
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight">
            Engineers Supporting Engineers
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Devora21 was built out of a simple observation: software engineers face real,
            hard challenges — in job searches, in technical interviews, and in their
            day-to-day work — and most of the support available is generic, outdated, or
            completely disconnected from how the tech industry actually works.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-navy-900 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
                Our Mission
              </p>
              <h2 className="text-3xl font-bold text-white mb-5 leading-tight">
                Helping engineers win — at getting hired and at the job itself.
              </h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                We&apos;re not a bootcamp. We&apos;re not a job board. We&apos;re a professional team that
                works directly with software engineers to solve the real problems standing
                between them and their goals.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Whether that&apos;s a resume that isn&apos;t getting responses, a technical interview
                they can&apos;t crack, a production bug they can&apos;t fix, or a career that isn&apos;t
                moving — we step in with the expertise, the tools, and the hands-on support
                to change the outcome.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "50+", label: "Engineers Helped" },
                { value: "90%", label: "Interview Success Rate" },
                { value: "10+", label: "Services Offered" },
                { value: "24h", label: "Avg Response Time" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center"
                >
                  <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-slate-500 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-navy-950 py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
              Our Values
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              What We Stand For
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((v) => (
              <div
                key={v.title}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.14] transition-all"
              >
                <span className="text-2xl mb-4 block">{v.icon}</span>
                <h3 className="text-white font-semibold mb-2">{v.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we serve */}
      <section className="bg-navy-900 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-5 tracking-tight">
            Who We Work With
          </h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            We work with software engineers at every stage — from new graduates who need
            their first break, to senior engineers navigating a transition, to working
            developers who need hands-on technical backup on real problems.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "New Graduates",
              "Junior Engineers",
              "Mid-Level Engineers",
              "Senior Engineers",
              "Career Changers",
              "Bootcamp Grads",
              "Remote Engineers",
              "Engineers Returning to Work",
            ].map((label) => (
              <span
                key={label}
                className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium px-4 py-2 rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-950 py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Have a question about us?</h2>
          <p className="text-slate-400 mb-6">We&apos;re happy to chat — no commitment required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25"
            >
              Book Free Consultation
            </Link>
            <Link
              href="/faq"
              className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl transition-all"
            >
              Read Our FAQ
            </Link>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
