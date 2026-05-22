"use client";

import { useState } from "react";
import { CONTACT_INFO } from "@/lib/constants";

const services = [
  "ATS-Optimized Resume Support",
  "Job Application Support",
  "Interview Preparation",
  "Technical Interview Prep",
  "Debugging Support",
  "Project Support",
  "Code Review",
  "Architecture Guidance",
  "Real Work Technical Problem Solving",
  "Career Guidance",
  "Not sure yet — just want to talk",
];

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    service: "",
    message: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Build mailto link as fallback
    const subject = encodeURIComponent(`Devora21 Inquiry — ${form.service || "General"}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nService: ${form.service}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:${CONTACT_INFO.email}?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-white text-xl font-bold mb-2">Got it — thanks!</h3>
        <p className="text-slate-400 text-sm max-w-xs">
          We&apos;ll read your message and get back to you within 24 hours. For a faster reply, reach out on WhatsApp.
        </p>
        <a
          href={CONTACT_INFO.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all inline-flex items-center gap-2"
        >
          Continue on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
            Your Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            placeholder="Jane Smith"
            className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="john@example.com"
            className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none transition-all"
          />
        </div>
      </div>

      <div>
        <label htmlFor="service" className="block text-sm font-medium text-slate-300 mb-1.5">
          What are you working on?
        </label>
        <select
          id="service"
          name="service"
          value={form.service}
          onChange={handleChange}
          className="w-full bg-navy-800 border border-white/[0.10] hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all appearance-none"
        >
          <option value="" className="text-slate-500">Pick the closest option...</option>
          {services.map((s) => (
            <option key={s} value={s} className="bg-slate-800">{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">
          What&apos;s going on? <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          value={form.message}
          onChange={handleChange}
          placeholder="Give us a quick overview — where you are, what you're trying to do, and what's blocking you. The more context, the better we can help."
          className="w-full bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none transition-all resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending...
          </>
        ) : (
          "Send Message"
        )}
      </button>
    </form>
  );
}
