"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

interface ChipListEditorProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /**
   * Optional suggestion source (e.g. searchLocations, searchJobTitles).
   * When provided, typing shows a keyboard-navigable dropdown of matches;
   * free-text entry (Enter with nothing highlighted) still works exactly
   * as before, so this is purely additive.
   */
  suggestions?: (query: string) => string[];
  /** Debounced server-backed suggestions for larger catalogs. */
  asyncSuggestions?: (query: string) => Promise<string[]>;
}

export function ChipListEditor({
  label,
  values,
  onChange,
  placeholder,
  suggestions,
  asyncSuggestions,
}: ChipListEditorProps) {
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionState, setSuggestionState] = useState<
    "idle" | "loading" | "empty" | "error" | "ready"
  >("idle");
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
    setOptions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const updateDraft = (next: string) => {
    setDraft(next);
    if (asyncSuggestions) {
      setOptions([]);
      setOpen(Boolean(next.trim()));
      setActiveIndex(-1);
      setSuggestionState(next.trim() ? "loading" : "idle");
      return;
    }
    if (!suggestions) return;
    const matches = next.trim()
      ? suggestions(next).filter(
          (opt) => !values.some((v) => v.toLowerCase() === opt.toLowerCase())
        )
      : [];
    setOptions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (!asyncSuggestions || !draft.trim()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      asyncSuggestions(draft.trim())
        .then((matches) => {
          if (!active) return;
          const available = matches.filter(
            (option) =>
              !values.some(
                (value) => value.toLowerCase() === option.toLowerCase()
              )
          );
          setOptions(available);
          setSuggestionState(available.length > 0 ? "ready" : "empty");
          setOpen(true);
        })
        .catch(() => {
          if (!active) return;
          setOptions([]);
          setSuggestionState("error");
          setOpen(true);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [asyncSuggestions, draft, values]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commit(activeIndex >= 0 ? options[activeIndex] : draft);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
    }
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
      <div className="relative flex gap-2">
        <input
          ref={inputRef}
          type="text"
          aria-label={`Add to ${label}`}
          role={suggestions || asyncSuggestions ? "combobox" : undefined}
          aria-expanded={suggestions || asyncSuggestions ? open : undefined}
          aria-controls={suggestions || asyncSuggestions ? listboxId : undefined}
          aria-autocomplete={suggestions || asyncSuggestions ? "list" : undefined}
          aria-activedescendant={
            (suggestions || asyncSuggestions) && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          placeholder={placeholder ?? "Add and press Enter"}
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onFocus={() => {
            if (options.length > 0) setOpen(true);
          }}
          className="h-10 flex-1 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-[var(--rf-bg)] px-3 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          className="h-10 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line-strong)] px-3 text-sm font-medium text-[var(--rf-ink-secondary)] hover:bg-[var(--rf-surface)]"
        >
          Add
        </button>

        {(suggestions || asyncSuggestions) && open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute left-0 right-12 top-11 z-20 max-h-56 overflow-y-auto rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white py-1 shadow-lg"
          >
            {asyncSuggestions && suggestionState === "loading" && (
              <li className="px-3 py-2 text-sm text-[var(--rf-ink-tertiary)]">
                Loading suggestions…
              </li>
            )}
            {asyncSuggestions && suggestionState === "empty" && (
              <li className="px-3 py-2 text-sm text-[var(--rf-ink-tertiary)]">
                No matches. Press Enter to add your own value.
              </li>
            )}
            {asyncSuggestions && suggestionState === "error" && (
              <li className="px-3 py-2 text-sm text-[var(--rf-error)]">
                Suggestions unavailable. You can still add a custom value.
              </li>
            )}
            {options.map((opt, i) => (
              <li
                key={opt}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={
                  "cursor-pointer px-3 py-2 text-sm " +
                  (i === activeIndex
                    ? "bg-[var(--rf-primary-muted)] text-[var(--rf-primary)]"
                    : "text-[var(--rf-ink)] hover:bg-[var(--rf-surface)]")
                }
                onMouseDown={(e) => {
                  // mousedown (not click) so it fires before the input's onBlur
                  e.preventDefault();
                  commit(opt);
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
