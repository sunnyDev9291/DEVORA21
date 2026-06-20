"use client";

import { useEffect, useRef, useState } from "react";

function pdfSourceKey(source: Blob | null | undefined): string | null {
  if (!source) return null;
  return `blob:${source.size}:${source.type}`;
}

export function usePdfPreview(open: boolean, source: Blob | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const sourceKey = pdfSourceKey(source);

  useEffect(() => {
    if (!open || !source) return;

    let cancelled = false;
    const container = containerRef.current;

    (async () => {
      setLoading(true);
      setError("");
      setTotalPages(0);
      if (container) container.innerHTML = "";

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const data = await source.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled || !container) return;

        setTotalPages(pdf.numPages);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          if (cancelled || !container) return;

          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto block bg-white shadow-xl shadow-black/20 mb-6 last:mb-0";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `PDF page ${pageNum}`);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas rendering is not supported in this browser.");

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          container.appendChild(canvas);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Failed to render PDF preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, source, sourceKey]);

  return { containerRef, loading, error, totalPages };
}
