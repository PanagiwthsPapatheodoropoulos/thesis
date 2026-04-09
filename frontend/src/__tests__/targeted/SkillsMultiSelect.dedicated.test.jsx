import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  create: vi.fn(),
  getByName: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  skillsAPI: {
    getAll: mocks.getAll,
    create: mocks.create,
    getByName: mocks.getByName,
  },
}));

import SkillsMultiSelect from "../../components/SkillsMultiSelect.jsx";

describe("SkillsMultiSelect dedicated", () => {
  beforeEach(() => {
    mocks.getAll.mockResolvedValue([
      { id: "s1", name: "React", category: "Frontend" },
      { id: "s2", name: "Java", category: "Backend" },
    ]);
    mocks.create.mockResolvedValue({ id: "s3", name: "Rust", category: "Custom" });
    mocks.getByName.mockResolvedValue({ id: "s4", name: "Go", category: "Custom" });
    window.alert = vi.fn();
  });

  it("fetches skills and adds existing skill from dropdown", async () => {
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={true} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type to search or create skills/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "React" } });
    fireEvent.mouseDown(screen.getByText("React"));

    expect(onChange).toHaveBeenCalledWith(["s1"]);
  });

  it("creates a new skill on Enter when no exact match", async () => {
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={false} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type to search or create skills/i);
    fireEvent.change(input, { target: { value: "Rust" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith(["s3"]);
  });

  it("handles 409 create conflict by fetching existing skill by name", async () => {
    mocks.create.mockRejectedValueOnce(new Error("409 already exists"));
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={false} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Type to search or create skills/i);
    fireEvent.change(input, { target: { value: "Go" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(mocks.getByName).toHaveBeenCalledWith("Go"));
    expect(onChange).toHaveBeenCalledWith(["s4"]);
  });
});

