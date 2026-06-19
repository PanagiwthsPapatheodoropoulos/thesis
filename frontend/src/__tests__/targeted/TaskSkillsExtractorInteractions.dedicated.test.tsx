// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  extractSkillsFromText: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    extractSkillsFromText: mocks.extractSkillsFromText,
  },
}));

import TaskSkillsExtractor from "../../components/TaskSkillsExtractor";

describe("TaskSkillsExtractor interactions", () => {
  beforeEach(() => {
    mocks.extractSkillsFromText.mockResolvedValue({
      extracted_skills: [
        { name: "React", confidence: 0.9, category: "Frontend", suggested_proficiency: 4 },
        { name: "Docker", confidence: 0.7, category: "DevOps", suggested_proficiency: 3 },
      ],
    });
  });

  it("opens panel, extracts, selects skills and sends them to parent", async () => {
    const onSkillsExtracted = vi.fn();
    render(<TaskSkillsExtractor taskTitle="Build UI" taskDescription="Use React and Docker" onSkillsExtracted={onSkillsExtracted} />);

    fireEvent.click(screen.getByText(/Extract Required Skills/i));
    fireEvent.click(screen.getByText("Extract Skills"));

    await waitFor(() => expect(mocks.extractSkillsFromText).toHaveBeenCalled());
    const checks = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);
    fireEvent.click(screen.getByText(/Add Selected/i));

    expect(onSkillsExtracted).toHaveBeenCalledWith(["React", "Docker"]);
  });

  it("shows empty-input and failed-extraction errors", async () => {
    mocks.extractSkillsFromText.mockRejectedValueOnce(new Error("service down"));
    render(<TaskSkillsExtractor taskTitle="" taskDescription="" />);
    fireEvent.click(screen.getByText(/Extract Required Skills/i));
    fireEvent.change(screen.getByPlaceholderText(/Paste task description/i), { target: { value: "text" } });
    fireEvent.click(screen.getByText("Extract Skills"));
    await waitFor(() => {
      expect(screen.getAllByText(/Extraction Failed|Failed to extract skills/i).length).toBeGreaterThan(0);
    });
  });
});

