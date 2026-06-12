"use client";

import { useState, useEffect } from "react";
import DocxPreviewModal from "@/components/ui/DocxPreviewModal";
import type { ResumeTemplate } from "@/lib/resume-template";
import type { GeneratedResumeContent, ResumeGenerateResponse } from "@/lib/resume-types";

interface ResumeGeneratorProps {
  selectedTemplate: ResumeTemplate | null;
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function ResumeGenerator({ selectedTemplate }: ResumeGeneratorProps) {
  const [form, setForm] = useState({
    jobTitle: "",
    jobDescription: "",
    customPrompt: "",
  });
  const [content, setContent] = useState<GeneratedResumeContent | null>(null);
  const [docxBase64, setDocxBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Clear stale output when the user picks a different template.
  useEffect(() => {
    setContent(null);
    setDocxBase64("");
    setFileName("");
    setPreviewOpen(false);
  }, [selectedTemplate?.id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!selectedTemplate) {
      setError("Choose a resume template above before generating.");
      return;
    }

    setError("");
    setContent(null);
    setDocxBase64("");
    setLoading(true);

    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          templateName: selectedTemplate.name,
        }),
      });

      const data = (await res.json()) as ResumeGenerateResponse & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);

      setContent(data.content);
      setDocxBase64(data.docxBase64);
      setFileName(data.fileName);
      setPreviewOpen(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!docxBase64) return;
    const blob = base64ToBlob(
      docxBase64,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "resume.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const docxBlob = docxBase64
    ? base64ToBlob(
        docxBase64,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    : null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job Title <span className="text-red-400">*</span>
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              type="text"
              value={form.jobTitle}
              onChange={handleChange}
              placeholder="Senior Backend Engineer"
              className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.10] hover:border-slate-400 dark:hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Job Description
            </label>
            <textarea
              id="jobDescription"
              name="jobDescription"
              rows={8}
              value={form.jobDescription}
              onChange={handleChange}
              placeholder="Paste the full job posting here."
              className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.10] hover:border-slate-400 dark:hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label htmlFor="customPrompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Customized Prompt
            </label>
            <textarea
              id="customPrompt"
              name="customPrompt"
              rows={4}
              value={form.customPrompt}
              onChange={handleChange}
              placeholder="Years of experience, achievements, tech stack, tone..."
              className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.10] hover:border-slate-400 dark:hover:border-white/[0.18] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all resize-none"
            />
          </div>

          {!selectedTemplate && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
              Select a resume template above before generating.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !selectedTemplate}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating &amp; updating template…
              </>
            ) : (
              "Generate Resume"
            )}
          </button>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
        </form>

        <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 min-h-[400px] flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-slate-900 dark:text-white font-semibold">Generated Content</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {selectedTemplate ? (
                  <>
                    Template:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedTemplate.name}
                    </span>
                  </>
                ) : (
                  "No template selected."
                )}
              </p>
            </div>
            {content && docxBase64 && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                >
                  Download
                </button>
              </div>
            )}
          </div>

          {content ? (
            <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300 overflow-y-auto flex-1">
              <section>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Summary</h4>
                <p className="leading-relaxed">{content.summary}</p>
              </section>
              <section>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Skillsets</h4>
                <p className="leading-relaxed">{content.skills}</p>
              </section>
              <section>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Experience</h4>
                <div className="space-y-4">
                  {content.experiences.map((exp) => (
                    <div key={`${exp.company}-${exp.dates}`}>
                      <p className="font-medium text-slate-900 dark:text-white">{exp.company}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mb-2">
                        {exp.role}
                        {exp.dates ? ` · ${exp.dates}` : ""}
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {exp.bullets.map((b) => (
                          <li key={b.slice(0, 40)}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <p className="text-slate-400 dark:text-slate-600 text-sm max-w-xs">
                Generated summary, skillsets, and experience bullets will appear here. The
                selected template is updated automatically and preview opens when ready.
              </p>
            </div>
          )}
        </div>
      </div>

      <DocxPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Updated Resume Preview"
        blob={docxBlob}
        fileName={fileName}
        onDownload={handleDownload}
      />
    </>
  );
}
