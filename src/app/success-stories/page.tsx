import type { Metadata } from "next";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import CTASection from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "Success Stories",
  description:
    "Real results from real software engineers who worked with Devora21 — from landing first jobs to salary negotiations to production bug fixes.",
};

const caseStudies = [
  {
    tag: "Job Search + Interview Prep",
    name: "Marcus T.",
    outcome: "3x Salary Increase in 8 Weeks",
    story:
      "Marcus had been applying to engineering roles for 6 months with no traction. His resume wasn't passing ATS filters, and he was freezing during technical interviews. We rewrote his resume from scratch with targeted ATS keywords for senior-level backend roles, rebuilt his LinkedIn profile, and ran 4 weeks of intensive technical and behavioral interview coaching. Eight weeks later, Marcus had three offers and accepted a Senior SWE role at a fintech company at 3x his previous salary.",
    results: ["ATS-optimized resume", "60+ mock interview questions drilled", "3 competing offers", "3x salary increase"],
    tech: "Python · Node.js · AWS · PostgreSQL",
  },
  {
    tag: "Production Debugging",
    name: "Priya K.",
    outcome: "Critical Auth Bug Resolved in 90 Minutes",
    story:
      "Priya's team deployed a new authentication flow on a Friday evening. By 11pm, users were getting logged out mid-session and the on-call engineer was stuck. She reached out to Devora21 via WhatsApp. Within 20 minutes we were on a call, walking through logs and session management code together. We identified a race condition in the token refresh logic, confirmed the root cause, implemented a fix, and had it deployed in production within 90 minutes of first contact.",
    results: ["Root cause identified in 20 min", "Fix deployed in 90 min", "Zero data loss", "Post-mortem documentation provided"],
    tech: "Next.js · JWT · Redis · PostgreSQL",
  },
  {
    tag: "Code Quality + Architecture",
    name: "Jason R.",
    outcome: "Promoted to Mid-Level Engineer in 4 Months",
    story:
      "Jason was stuck at junior level, writing code that worked but was fragile and hard to maintain. Through weekly code review sessions and two architecture deep-dives, we showed him how to think in abstractions, write for readability, and design small systems properly. Four months later, his team lead nominated him for a mid-level promotion, citing a dramatic improvement in code quality and initiative.",
    results: ["Weekly code review sessions", "2 architecture design workshops", "Promoted in 4 months", "Team lead recognition"],
    tech: "React · TypeScript · Node.js · REST APIs",
  },
  {
    tag: "Career Transition",
    name: "Sarah N.",
    outcome: "$40K Raise + Title Change",
    story:
      "Sarah had been in the same senior engineer role for three years with no promotion path in sight. After a career assessment session, we identified that she was being significantly underpaid relative to her market value and skill set. We built her a negotiation strategy, helped her document her impact, and coached her through a difficult compensation conversation. She walked away with a $40,000 annual raise and a Staff Engineer title.",
    results: ["Market rate analysis", "Promotion pitch documentation", "Negotiation coaching", "$40K raise + Staff title"],
    tech: "Java · Spring Boot · Kubernetes · GCP",
  },
];

export default function SuccessStoriesPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Proven Results
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
            Engineers Who Leveled Up
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Real stories from real engineers. No fabricated case studies — just
            outcomes we&apos;re proud of.
          </p>
        </div>
      </section>

      {/* Case studies */}
      <section className="bg-navy-900 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {caseStudies.map((cs) => (
            <div
              key={cs.name}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 hover:border-white/[0.14] transition-all"
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full">
                  {cs.tag}
                </span>
                <span className="text-slate-600 text-xs font-mono">{cs.tech}</span>
              </div>
              <h2 className="text-white text-xl font-bold mb-1">{cs.outcome}</h2>
              <p className="text-slate-500 text-sm mb-4">Client: {cs.name}</p>
              <p className="text-slate-400 leading-relaxed mb-6">{cs.story}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cs.results.map((r) => (
                  <div key={r} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <TestimonialsSection />
      <CTASection />
    </>
  );
}
