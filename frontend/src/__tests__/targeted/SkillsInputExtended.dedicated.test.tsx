// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

const showToastMock = vi.fn();
vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

import SkillsInput from "../../components/SkillsInput";

describe("SkillsInput extended coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showToastMock.mockClear();
    localStorage.setItem("token", "test-token");
  });

  it("renders read-only mode with no Add Skill button", () => {
    render(
      <SkillsInput
        initialSkills={[{ id: "s1", skillName: "React", skillCategory: "Programming", proficiencyLevel: 4 }]}
        readOnly={true}
      />
    );
    expect(screen.queryByText("Add Skill")).not.toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("shows Add Skill button in edit mode", () => {
    render(<SkillsInput initialSkills={[]} />);
    expect(screen.getByText("Add Skill")).toBeInTheDocument();
  });

  it("shows input form when Add Skill is clicked", () => {
    render(<SkillsInput initialSkills={[]} />);
    fireEvent.click(screen.getByText("Add Skill"));
    expect(screen.getByPlaceholderText("e.g., Java, Leadership")).toBeInTheDocument();
  });

  it("shows warning when adding skill with empty name", async () => {
    render(<SkillsInput initialSkills={[]} />);
    fireEvent.click(screen.getByText("Add Skill"));
    // The submit button now shows "Add Skill" too - click via role
    const submitBtn = document.querySelector("button[type='button'].flex-1");
    if (submitBtn) fireEvent.click(submitBtn);
    else {
      // Fallback: find the second "Add Skill" button
      const buttons = screen.getAllByText("Add Skill");
      if (buttons.length > 1) fireEvent.click(buttons[1]);
    }
    expect(showToastMock).toHaveBeenCalledWith("Please enter a skill name", "warning");
  });

  it("adds skill to local state when no employeeId provided", async () => {
    const onSkillsChange = vi.fn();
    render(<SkillsInput initialSkills={[]} onSkillsChange={onSkillsChange} />);

    fireEvent.click(screen.getByText("Add Skill"));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), {
      target: { value: "TypeScript" },
    });
    const submitBtn = document.querySelector("button[type='button'].flex-1");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() =>
      expect(onSkillsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ skillName: "TypeScript" }),
        ])
      )
    );
  });

  it("cancels adding skill and resets form", () => {
    render(<SkillsInput initialSkills={[]} />);
    fireEvent.click(screen.getByText("Add Skill"));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), {
      target: { value: "SomeName" },
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText("e.g., Java, Leadership")).not.toBeInTheDocument();
  });

  it("removes skill from local state when no employeeId", async () => {
    const onSkillsChange = vi.fn();
    render(
      <SkillsInput
        initialSkills={[{ id: "temp-1", skillName: "React", skillCategory: "Programming", proficiencyLevel: 3 }]}
        onSkillsChange={onSkillsChange}
      />
    );

    // The remove button contains an X icon and has class ml-1
    const removeBtn = document.querySelector("button.ml-1");
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    await waitFor(() =>
      expect(onSkillsChange).toHaveBeenCalledWith([])
    );
  });

  it("shows No skills added yet message when empty", () => {
    render(<SkillsInput initialSkills={[]} />);
    expect(screen.getByText("No skills added yet")).toBeInTheDocument();
  });

  it("adds skill via Enter key press", async () => {
    const onSkillsChange = vi.fn();
    render(<SkillsInput initialSkills={[]} onSkillsChange={onSkillsChange} />);

    fireEvent.click(screen.getByText("Add Skill"));
    const input = screen.getByPlaceholderText("e.g., Java, Leadership");
    fireEvent.change(input, { target: { value: "Vue.js" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    });

    await waitFor(() =>
      expect(onSkillsChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ skillName: "Vue.js" })])
      )
    );
  });

  it("adds skill with persistent employeeId when skill created successfully", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-skill-id" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "emp-skill-1",
          skillId: "new-skill-id",
          skillName: "Kubernetes",
          skillCategory: "DevOps",
          proficiencyLevel: 4,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "emp-skill-1", skillName: "Kubernetes", skillCategory: "DevOps", proficiencyLevel: 4 },
        ],
      });

    const onSkillsChange = vi.fn();
    render(
      <SkillsInput
        employeeId="emp1"
        initialSkills={[]}
        onSkillsChange={onSkillsChange}
      />
    );

    fireEvent.click(screen.getByText("Add Skill"));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), {
      target: { value: "Kubernetes" },
    });
    const submitBtn = document.querySelector("button[type='button'].flex-1");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled(), { timeout: 5000 });
  });

  it("shows error when skill creation fails with non-409 status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    render(
      <SkillsInput
        employeeId="emp1"
        initialSkills={[]}
        onSkillsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Add Skill"));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), {
      target: { value: "Docker" },
    });
    const submitBtn = document.querySelector("button[type='button'].flex-1");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringContaining("Error adding skill"),
        "error"
      )
    );
  });

  it("handles removing a persisted skill with employeeId", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const onSkillsChange = vi.fn();
    render(
      <SkillsInput
        employeeId="emp1"
        initialSkills={[{ id: "s1", skillId: "s1", skillName: "Docker", skillCategory: "DevOps", proficiencyLevel: 3 }]}
        onSkillsChange={onSkillsChange}
      />
    );

    const removeBtn = document.querySelector("button.ml-1");
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled(), { timeout: 5000 });
  });

  it("adjusts proficiency level via range input", () => {
    render(<SkillsInput initialSkills={[]} />);
    fireEvent.click(screen.getByText("Add Skill"));
    
    const rangeInput = document.querySelector('input[type="range"]');
    fireEvent.change(rangeInput, { target: { value: "5" } });
    expect(screen.getByText("Proficiency Level: 5")).toBeInTheDocument();
  });

  it("shows multiple skills correctly", () => {
    const initialSkills = [
      { id: "s1", skillName: "React", skillCategory: "Programming", proficiencyLevel: 4 },
      { id: "s2", skillName: "TypeScript", skillCategory: "Programming", proficiencyLevel: 3 },
      { id: "s3", skillName: "CSS", skillCategory: "Design", proficiencyLevel: 2 },
    ];
    render(<SkillsInput initialSkills={initialSkills} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("CSS")).toBeInTheDocument();
  });
});
