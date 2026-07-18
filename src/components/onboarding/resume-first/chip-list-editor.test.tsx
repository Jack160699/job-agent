import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipListEditor } from "./chip-list-editor";

describe("ChipListEditor", () => {
  it("adds a new value on Enter without duplicating existing ones", () => {
    const onChange = vi.fn();
    render(<ChipListEditor label="Skills" values={["React"]} onChange={onChange} />);

    const input = screen.getByLabelText("Add to Skills");
    fireEvent.change(input, { target: { value: "TypeScript" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["React", "TypeScript"]);

    onChange.mockClear();
    fireEvent.change(input, { target: { value: "React" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a value when its remove button is clicked", () => {
    const onChange = vi.fn();
    render(<ChipListEditor label="Skills" values={["React", "SQL"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove React from Skills" }));
    expect(onChange).toHaveBeenCalledWith(["SQL"]);
  });

  it("shows a placeholder when there are no values yet", () => {
    render(<ChipListEditor label="Skills" values={[]} onChange={vi.fn()} />);
    expect(screen.getByText("None yet")).toBeInTheDocument();
  });

  it("shows keyboard-navigable suggestions and selects one with Enter", () => {
    const onChange = vi.fn();
    const suggestions = vi.fn((q: string) =>
      ["Bhilai, Chhattisgarh, India", "Bhind, Madhya Pradesh, India", "Bhiwandi, Maharashtra, India"].filter(
        (s) => s.toLowerCase().startsWith(q.toLowerCase())
      )
    );
    render(
      <ChipListEditor label="Locations" values={[]} onChange={onChange} suggestions={suggestions} />
    );

    const input = screen.getByLabelText("Add to Locations");
    fireEvent.change(input, { target: { value: "Bhi" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["Bhilai, Chhattisgarh, India"]);
  });

  it("still commits free-text input when no suggestion is highlighted", () => {
    const onChange = vi.fn();
    const suggestions = vi.fn(() => ["Somewhere Else"]);
    render(
      <ChipListEditor label="Locations" values={[]} onChange={onChange} suggestions={suggestions} />
    );

    const input = screen.getByLabelText("Add to Locations");
    fireEvent.change(input, { target: { value: "Custom Place" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["Custom Place"]);
  });
});
