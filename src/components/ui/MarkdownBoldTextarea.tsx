"use client";

import { useCallback, useEffect, useRef } from "react";
import { htmlToMarkdownBold, markdownBoldToHtml } from "@/lib/markdown-bold";

interface MarkdownBoldTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  className?: string;
  rows?: number;
  minHeight?: number;
  maxHeight?: number;
  placeholder?: string;
  "aria-label"?: string;
}

export default function MarkdownBoldTextarea({
  id,
  value,
  onChange,
  onBlur,
  className = "",
  rows = 2,
  minHeight: minHeightProp,
  maxHeight,
  placeholder,
  "aria-label": ariaLabel,
}: MarkdownBoldTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const syncFromValue = useCallback(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;
    if (document.activeElement === el) return;

    syncingRef.current = true;
    el.innerHTML = value ? markdownBoldToHtml(value) : "";
    syncingRef.current = false;
  }, [value]);

  useEffect(() => {
    syncFromValue();
  }, [syncFromValue]);

  const readValue = useCallback(() => {
    const el = editorRef.current;
    if (!el) return value;
    return htmlToMarkdownBold(el);
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;

    syncingRef.current = true;
    onChange(htmlToMarkdownBold(el));
    syncingRef.current = false;
  }, [onChange]);

  const minHeight = Math.max(rows * 24 + 24, 72);

  return (
    <div
      id={id}
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      onInput={emitChange}
      onBlur={() => {
        emitChange();
        onBlur?.(readValue());
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
        emitChange();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          document.execCommand("bold");
          emitChange();
        }
      }}
      className={`markdown-bold-editor ${className}`}
      style={{
        minHeight: minHeightProp ?? minHeight,
        maxHeight,
        overflowY: "auto",
        resize: "vertical",
      }}
    />
  );
}
