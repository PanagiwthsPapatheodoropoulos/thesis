// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";

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

import SkillsMultiSelect from "../../components/SkillsMultiSelect";

describe("SkillsMultiSelect dedicated", () => {
  beforeEach(() => {
    mocks.getAll.mockReset();
    mocks.create.mockReset();
    mocks.getByName.mockReset();

    mocks.getAll.mockResolvedValue([
      { id: "s1", name: "React", category: "Frontend" },
      { id: "s2", name: "Java", category: "Backend" },
    ]);
    mocks.create.mockResolvedValue({ id: "s3", name: "Rust", category: "Custom" });
    mocks.getByName.mockResolvedValue({ id: "s4", name: "Go", category: "Custom" });
    window.alert = vi.fn();
    if (globalThis.__showToast) {
      globalThis.__showToast.mockClear();
    }
  });

  it("fetches skills and adds existing skill from dropdown", async () => {
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={true} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "React" } });
    fireEvent.mouseDown(screen.getByText("React"));

    expect(onChange).toHaveBeenCalledWith(["s1"]);
  });

  it("creates a new skill on Enter when no exact match", async () => {
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={false} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.change(input, { target: { value: "Rust" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith(["s3"]);
  });

  it("handles 409 create conflict by fetching existing skill by name", async () => {
    mocks.create.mockRejectedValueOnce(new Error("409 already exists"));
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={false} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.change(input, { target: { value: "Go" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(mocks.getByName).toHaveBeenCalledWith("Go"));
    expect(onChange).toHaveBeenCalledWith(["s4"]);
  });

  it("removes a selected skill when remove button clicked", async () => {
    const onChange = vi.fn();
    // Render component with s1 (React) already selected
    render(<SkillsMultiSelect selectedSkills={["s1"]} onChange={onChange} darkMode={false} />);
    await screen.findByText("React");

    // Find and click the remove button
    const removeBtn = screen.getByRole("button");
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("rejects skill creation if input name is shorter than 2 characters", async () => {
    const onChange = vi.fn();
    render(<SkillsMultiSelect selectedSkills={[]} onChange={onChange} darkMode={false} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.change(input, { target: { value: "R" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    if (globalThis.__showToast) {
      expect(globalThis.__showToast).toHaveBeenCalledWith("Skill name must be at least 2 characters", "warning");
    }
  });

  it("handles API failure gracefully when loading skills initially", async () => {
    mocks.getAll.mockRejectedValueOnce(new Error("API failure"));
    render(<SkillsMultiSelect selectedSkills={[]} onChange={vi.fn()} darkMode={false} />);
    
    // It should not crash, and should set allSkills to empty list
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
  });

  it("shows Skill already selected helper message if exact match is already selected", async () => {
    render(<SkillsMultiSelect selectedSkills={["s1"]} onChange={vi.fn()} darkMode={false} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "React" } });

    expect(screen.getByText("Skill already selected")).toBeInTheDocument();
  });

  it("closes the dropdown properly on blur with timeout", async () => {
    render(<SkillsMultiSelect selectedSkills={[]} onChange={vi.fn()} darkMode={false} />);
    const input = await screen.findByPlaceholderText(/Type to search or create skills/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "React" } });
    
    expect(screen.getByText("React")).toBeInTheDocument();
    
    fireEvent.blur(input);
    
    // Wait for the 200ms timeout to execute inside act to capture state updates
    await act(async () => {
      await new Promise(r => setTimeout(r, 250));
    });

    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("skips fetch when availableSkills are provided", async () => {
    const available = [
      { id: "s10", name: "Python", category: "Backend" }
    ];
    render(<SkillsMultiSelect selectedSkills={[]} onChange={vi.fn()} availableSkills={available} />);
    
    // Should not call getAll because availableSkills are provided
    expect(mocks.getAll).not.toHaveBeenCalled();
    
    const input = screen.getByPlaceholderText(/Type to search or create skills/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Python" } });
    expect(screen.getByText("Python")).toBeInTheDocument();
  });
});
