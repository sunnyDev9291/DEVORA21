"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

/** US Letter at 96 DPI — fallback when layout metrics are unreliable */
const LETTER_W = 816;
const LETTER_H = 1056;

function readPageDimensions(pageEl: HTMLElement) {
  const inlineW = parseFloat(pageEl.style.width || pageEl.style.minWidth);
  const inlineH = parseFloat(pageEl.style.height || pageEl.style.minHeight);

  let w = inlineW > 0 ? inlineW : pageEl.clientWidth;
  let h = inlineH > 0 ? inlineH : pageEl.clientHeight;

  if (pageEl.classList.contains("docx")) {
    w = inlineW > 0 ? inlineW : Math.max(pageEl.clientWidth, pageEl.scrollWidth);
    h = inlineH > 0 ? inlineH : Math.max(pageEl.clientHeight, pageEl.scrollHeight);
  } else {
    const rect = pageEl.getBoundingClientRect();
    w = Math.max(w, pageEl.scrollWidth, pageEl.offsetWidth, rect.width);
    h = Math.max(h, pageEl.scrollHeight, pageEl.offsetHeight, rect.height);
  }

  if (w < 500) w = LETTER_W;
  if (h < 500) h = LETTER_H;

  return { w, h };
}

export function useDocxFitScale(
  viewportRef: RefObject<HTMLElement | null>,
  pagesRef: RefObject<HTMLElement[]>,
  page: number,
  ready: boolean
) {
  const [fitScale, setFitScale] = useState(1);
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const pageEl = pagesRef.current[page] ?? pagesRef.current[0];
    if (!viewport || !pageEl) return;

    const { w: pw, h: ph } = readPageDimensions(pageEl);
    if (!pw || !ph) return;

    setPageSize({ w: pw, h: ph });

    const vw = viewport.clientWidth;
    const paddingX = 32;
    const scaleW = (Math.max(vw - paddingX, 1)) / pw;
    setFitScale(Math.max(0.2, Math.min(scaleW, 4)));
  }, [viewportRef, pagesRef, page]);

  useLayoutEffect(() => {
    if (!ready) {
      setPageSize({ w: 0, h: 0 });
      setFitScale(1);
      return;
    }

    measure();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(viewport);

    const pageEl = pagesRef.current[page];
    if (pageEl) ro.observe(pageEl);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ready, page, measure, viewportRef, pagesRef]);

  return { pageSize, fitWidthScale: fitScale };
}
