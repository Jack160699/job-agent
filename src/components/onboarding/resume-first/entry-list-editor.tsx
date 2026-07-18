"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

export interface EntryFieldConfig<T> {
  key: keyof T;
  label: string;
  type?: "text" | "textarea" | "checkbox";
  placeholder?: string;
}

interface EntryListEditorProps<T> {
  title: string;
  entries: T[];
  onChange: (next: T[]) => void;
  fields: EntryFieldConfig<T>[];
  emptyEntry: T;
  entrySummary: (entry: T) => string;
  addLabel?: string;
  emptyMessage?: string;
}

/**
 * Phase A: generic add/edit/reorder/remove editor for repeated resume
 * sections (experience, education, projects). Removing a non-empty entry
 * always asks for confirmation — accidental data loss on a structured
 * resume is expensive to redo by hand.
 */
export function EntryListEditor<T extends object>({
  title,
  entries,
  onChange,
  fields,
  emptyEntry,
  entrySummary,
  addLabel,
  emptyMessage,
}: EntryListEditorProps<T>) {
  const updateEntry = (idx: number, patch: Partial<T>) => {
    onChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeEntry = (idx: number) => {
    const entry = entries[idx];
    const summary = entrySummary(entry).trim();
    if (
      summary.length > 0 &&
      !window.confirm(`Remove "${summary}"? This can't be undone once you save.`)
    ) {
      return;
    }
    onChange(entries.filter((_, i) => i !== idx));
  };

  const move = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addEntry = () => onChange([...entries, emptyEntry]);

  return (
    <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">{title}</h2>
        <button
          type="button"
          onClick={addEntry}
          className="flex h-8 items-center gap-1 rounded-full border border-[var(--rf-line-strong)] px-3 text-xs font-medium text-[var(--rf-primary)]"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel ?? "Add"}
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-[var(--rf-ink-tertiary)]">
          {emptyMessage ?? "Nothing here yet."}
        </p>
      )}

      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-[var(--rf-surface)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--rf-ink-secondary)]">
                {entrySummary(entry) || `Entry ${idx + 1}`}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded text-[var(--rf-ink-tertiary)] disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={idx === entries.length - 1}
                  onClick={() => move(idx, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded text-[var(--rf-ink-tertiary)] disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${entrySummary(entry) || "entry"}`}
                  onClick={() => removeEntry(idx)}
                  className="flex h-8 w-8 items-center justify-center rounded text-[var(--rf-ink-tertiary)] hover:text-[var(--rf-warning)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => {
                const fieldId = `${title}-${idx}-${String(f.key)}`.replace(/\s+/g, "-");
                return (
                  <div
                    key={String(f.key)}
                    className={f.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"}
                  >
                    {f.type === "checkbox" ? (
                      <label
                        htmlFor={fieldId}
                        className="flex h-11 items-center gap-2 text-sm text-[var(--rf-ink)]"
                      >
                        <input
                          id={fieldId}
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(entry[f.key])}
                          onChange={(e) =>
                            updateEntry(idx, { [f.key]: e.target.checked } as Partial<T>)
                          }
                        />
                        {f.label}
                      </label>
                    ) : (
                      <>
                        <label htmlFor={fieldId} className="text-[11px] text-[var(--rf-ink-tertiary)]">
                          {f.label}
                        </label>
                        {f.type === "textarea" ? (
                          <textarea
                            id={fieldId}
                            className="min-h-20 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 py-2 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
                            value={(entry[f.key] as string) ?? ""}
                            placeholder={f.placeholder}
                            onChange={(e) =>
                              updateEntry(idx, { [f.key]: e.target.value } as Partial<T>)
                            }
                          />
                        ) : (
                          <input
                            id={fieldId}
                            type="text"
                            className="h-11 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
                            value={(entry[f.key] as string) ?? ""}
                            placeholder={f.placeholder}
                            onChange={(e) =>
                              updateEntry(idx, { [f.key]: e.target.value } as Partial<T>)
                            }
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
