"use client";

import { useState } from "react";
import { FAQS } from "@/lib/constants";

interface FAQSectionProps {
  limit?: number;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-white/[0.14] bg-white dark:bg-transparent">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-slate-900 dark:text-white font-medium text-sm sm:text-base">{question}</span>
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-slate-400 transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQSection({ limit }: FAQSectionProps) {
  const faqs = limit ? FAQS.slice(0, limit) : FAQS;

  return (
    <section className="bg-white dark:bg-navy-900 py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">

          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
            Common Questions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Everything you need to know before getting started.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
