"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ChipListEditorProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function ChipListEditor({ label, values, onChange, placeholder }: ChipListEditorProps) {
  const [draft, setDraft] = useState("");

  const addValue = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="list" aria-label={label}>
        {values.map((value) => (
          <span
            key={value}
            role="listitem"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rf-line)] bg-[var(--rf-surface)] py-1.5 pl-3 pr-2 text-xs font-medium text-[var(--rf-ink)]"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value} from ${label}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--rf-ink-tertiary)] hover:bg-[var(--rf-surface-strong)] hover:text-[var(--rf-ink)]"
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-[var(--rf-ink-tertiary)]">None yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          aria-label={`Add to ${label}`}
          placeholder={placeholder ?? "Add and press Enter"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addValue();
            }
          }}
          className="h-10 flex-1 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-[var(--rf-bg)] px-3 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
        />
        <button
          type="button"
          onClick={addValue}
          className="h-10 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line-strong)] px-3 text-sm font-medium text-[var(--rf-ink-secondary)] hover:bg-[var(--rf-surface)]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
