import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryListEditor } from "./entry-list-editor";

interface TestEntry {
  title: string;
  company: string;
}

const fields = [
  { key: "title" as const, label: "Title" },
  { key: "company" as const, label: "Company" },
];
const emptyEntry: TestEntry = { title: "", company: "" };
const summary = (e: TestEntry) => [e.title, e.company].filter(Boolean).join(" · ");

describe("EntryListEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a new blank entry", () => {
    const onChange = vi.fn();
    render(
      <EntryListEditor
        title="Work experience"
        entries={[]}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onChange).toHaveBeenCalledWith([emptyEntry]);
  });

  it("edits a field on an existing entry without touching others", () => {
    const onChange = vi.fn();
    const entries: TestEntry[] = [
      { title: "Engineer", company: "Acme" },
      { title: "Intern", company: "Beta" },
    ];
    render(
      <EntryListEditor
        title="Work experience"
        entries={entries}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    const titleInputs = screen.getAllByLabelText("Title");
    fireEvent.change(titleInputs[0], { target: { value: "Senior Engineer" } });
    expect(onChange).toHaveBeenCalledWith([
      { title: "Senior Engineer", company: "Acme" },
      { title: "Intern", company: "Beta" },
    ]);
  });

  it("asks for confirmation before removing a non-empty entry, and skips removal if declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = vi.fn();
    const entries: TestEntry[] = [{ title: "Engineer", company: "Acme" }];
    render(
      <EntryListEditor
        title="Work experience"
        entries={entries}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a non-empty entry once the user confirms", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onChange = vi.fn();
    const entries: TestEntry[] = [{ title: "Engineer", company: "Acme" }];
    render(
      <EntryListEditor
        title="Work experience"
        entries={entries}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("removes a blank entry without confirmation", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const onChange = vi.fn();
    render(
      <EntryListEditor
        title="Work experience"
        entries={[emptyEntry]}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("reorders entries with move up/down", () => {
    const onChange = vi.fn();
    const entries: TestEntry[] = [
      { title: "First", company: "A" },
      { title: "Second", company: "B" },
    ];
    render(
      <EntryListEditor
        title="Work experience"
        entries={entries}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    expect(onChange).toHaveBeenCalledWith([
      { title: "Second", company: "B" },
      { title: "First", company: "A" },
    ]);
  });

  it("duplicates a structured entry next to the original", () => {
    const onChange = vi.fn();
    const entries: TestEntry[] = [{ title: "Engineer", company: "Acme" }];
    render(
      <EntryListEditor
        title="Work experience"
        entries={entries}
        onChange={onChange}
        fields={fields}
        emptyEntry={emptyEntry}
        entrySummary={summary}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /duplicate engineer/i }));
    expect(onChange).toHaveBeenCalledWith([
      { title: "Engineer", company: "Acme" },
      { title: "Engineer", company: "Acme" },
    ]);
    expect(onChange.mock.calls[0][0][0]).not.toBe(onChange.mock.calls[0][0][1]);
  });
});
