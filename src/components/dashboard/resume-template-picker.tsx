"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RESUME_TEMPLATES,
  type ResumeLength,
  type ResumeTemplateId,
} from "@/lib/resumes/templates";

export function ResumeTemplatePicker() {
  const [template, setTemplate] = useState<ResumeTemplateId>("ats-classic");
  const [length, setLength] = useState<ResumeLength>("two-page");
  const selected = RESUME_TEMPLATES.find((item) => item.id === template)!;
  const query = useMemo(
    () =>
      new URLSearchParams({
        template,
        length,
      }).toString(),
    [length, template]
  );

  return (
    <section
      aria-labelledby="resume-template-heading"
      className="mt-4 space-y-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3"
    >
      <div>
        <h3 id="resume-template-heading" className="text-sm font-semibold text-[var(--ink)]">
          Resume template
        </h3>
        <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
          The template changes presentation only. Your resume data stays the same.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="resume-template" className="text-xs font-medium text-[var(--ink-secondary)]">
            Template
          </label>
          <select
            id="resume-template"
            value={template}
            onChange={(event) => setTemplate(event.target.value as ResumeTemplateId)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
          >
            {RESUME_TEMPLATES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="resume-length" className="text-xs font-medium text-[var(--ink-secondary)]">
            Length
          </label>
          <select
            id="resume-length"
            value={length}
            onChange={(event) => setLength(event.target.value as ResumeLength)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
          >
            <option value="one-page">One page</option>
            <option value="two-page">Up to two pages</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--ink-tertiary)]">{selected.description}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild type="button" size="sm" variant="outline">
          <a
            href={`/api/resumes/master/pdf?${query}&preview=1`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Preview PDF
          </a>
        </Button>
        <Button asChild type="button" size="sm">
          <a href={`/api/resumes/master/pdf?${query}`}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Download PDF
          </a>
        </Button>
      </div>
    </section>
  );
}
