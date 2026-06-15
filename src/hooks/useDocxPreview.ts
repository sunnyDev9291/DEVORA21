"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

/** Match Word page breaks — same options for template and download-ready previews. */
const RENDER_OPTIONS = {
  className: "docx",
  inWrapper: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  experimental: true,
  trimXmlDeclaration: true,
  useBase64URL: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  renderAltChunks: true,
} as const;

async function resolveBlob(source: Blob | string): Promise<Blob> {
  if (source instanceof Blob) return source;
  const res = await fetch(source, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load document (${res.status}).`);
  return res.blob();
}

function previewSourceKey(source: Blob | string | null | undefined): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  return `blob:${source.size}:${source.type}`;
}

/** Collect docx-preview page sections exactly as the library renders them. */
function collectPageElements(container: HTMLElement): HTMLElement[] {
  const selectors = [".docx-wrapper > section.docx", ".docx-wrapper > section", "section.docx"];
  for (const selector of selectors) {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (elements.length > 0) return elements;
  }
  return [];
}

export function useDocxPreview(open: boolean, source: Blob | string | null | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);

  const showOnly = useCallback((index: number) => {
    pagesRef.current.forEach((el, i) => {
      el.style.display = i === index ? "" : "none";
    });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pagesRef.current.length - 1));
      setPage(clamped);
      showOnly(clamped);
    },
    [showOnly]
  );

  const sourceKey = previewSourceKey(source);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;

    (async () => {
      setError("");
      setLoading(true);
      setPage(0);
      setTotalPages(0);
      pagesRef.current = [];

      try {
        const blob = await resolveBlob(source);
        const container = previewRef.current;
        const styleContainer = styleRef.current;
        if (!container || cancelled) return;

        container.innerHTML = "";
        if (styleContainer) styleContainer.innerHTML = "";

        await renderAsync(blob, container, styleContainer ?? undefined, RENDER_OPTIONS);
        if (cancelled) return;

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const pageEls = collectPageElements(container);
        if (pageEls.length === 0) {
          throw new Error("No pages found in document preview.");
        }

        pagesRef.current = pageEls;
        setTotalPages(pageEls.length);
        showOnly(0);
        setPage(0);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to render preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sourceKey, source, showOnly]);

  return {
    previewRef,
    styleRef,
    viewportRef,
    pagesRef,
    loading,
    error,
    page,
    totalPages,
    goTo,
  };
}
