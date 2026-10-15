"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CLAUDE_MODEL,
  fetchClaudeModels,
  groupClaudeModelsByFamily,
  readStoredClaudeModel,
  resolveDefaultClaudeModel,
  storeClaudeModel,
  type ClaudeModelOption,
} from "@/lib/claude-models";
import { ui } from "@/lib/ui-styles";

type ClaudeModelSelectorProps = {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Compact single-line layout for tight toolbars. */
  compact?: boolean;
};

export default function ClaudeModelSelector({
  value,
  onChange,
  disabled = false,
  id = "claude-model",
  className = "",
  compact = false,
}: ClaudeModelSelectorProps) {
  const [models, setModels] = useState<ClaudeModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { models: list, defaultModelId } = await fetchClaudeModels(controller.signal);
        if (cancelled) return;
        setModels(list);

        const stored = readStoredClaudeModel();
        const next = resolveDefaultClaudeModel(
          list,
          value || stored || defaultModelId || DEFAULT_CLAUDE_MODEL
        );
        if (next && next !== value) {
          onChangeRef.current(next);
        }
        storeClaudeModel(next);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setLoadError((err as Error).message || "Could not load Claude models.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Load once on mount; selection changes are handled via props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => groupClaudeModelsByFamily(models), [models]);
  const selected = models.find((m) => m.id === value);
  const hint = selected?.description || (loading ? "Loading models…" : "");

  function handleChange(next: string) {
    onChange(next);
    storeClaudeModel(next);
  }

  return (
    <div className={className}>
      <label htmlFor={id} className={ui.label}>
        Claude model
      </label>
      <select
        id={id}
        value={value || DEFAULT_CLAUDE_MODEL}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || loading || models.length === 0}
        className={ui.input}
        aria-describedby={hint || loadError ? `${id}-hint` : undefined}
      >
        {loading && models.length === 0 ? (
          <option value={value || DEFAULT_CLAUDE_MODEL}>Loading models…</option>
        ) : null}
        {groups.map((group) => (
          <optgroup key={group.family} label={group.label}>
            {group.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.isDefault ? " (default)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {!compact && (hint || loadError) ? (
        <p
          id={`${id}-hint`}
          className={`mt-1.5 text-xs ${
            loadError
              ? "text-amber-700 dark:text-amber-300"
              : "text-stone-600 dark:text-stone-400"
          }`}
        >
          {loadError
            ? "Using built-in model list — backend catalog unavailable."
            : hint}
        </p>
      ) : null}
    </div>
  );
}
