// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAssignmentSuggestions: vi.fn(),
  createAssignment: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    getAssignmentSuggestions: mocks.getAssignmentSuggestions,
  },
  assignmentsAPI: {
    create: mocks.createAssignment,
  },
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import AIAssignmentModal from "../../components/AIAssignmentModal";

describe("AIAssignmentModal dedicated", () => {
  const task = {
    id: "t1",
    title: "Build feature",
    description: "desc",
    priority: "HIGH",
    estimatedHours: 8,
    requiredSkillIds: ["s1"],
    complexityScore: 0.7,
  };

  beforeEach(() => {
    window.alert = vi.fn();
    mocks.getAssignmentSuggestions.mockResolvedValue({
      suggestions: [
        {
          employeeId: "e1",
          employeeName: "Alice Doe",
          fitScore: 0.9,
          confidenceScore: 0.8,
          reasoning: "Best fit",
          workloadPercentage: 45,
          availableHours: 20,
        },
      ],
    });
    mocks.createAssignment.mockResolvedValue({});
  });

  it("loads and renders AI suggestions when opened", async () => {
    render(<AIAssignmentModal task={task} isOpen={true} onClose={() => {}} onAssign={() => {}} />);
    await waitFor(() => expect(mocks.getAssignmentSuggestions).toHaveBeenCalled());
    expect(screen.getByText(/Top 1 Candidates/i)).toBeInTheDocument();
    expect(screen.getByText("Alice Doe")).toBeInTheDocument();
  });

  it("shows error state when suggestions are empty", async () => {
    mocks.getAssignmentSuggestions.mockResolvedValueOnce({ suggestions: [] });
    render(<AIAssignmentModal task={task} isOpen={true} onClose={() => {}} onAssign={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No suitable employees found/i)).toBeInTheDocument());
  });

  it("assigns selected employee and triggers callbacks", async () => {
    const onAssign = vi.fn();
    const onClose = vi.fn();
    render(<AIAssignmentModal task={task} isOpen={true} onClose={onClose} onAssign={onAssign} />);
    await waitFor(() => expect(screen.getByText("Assign")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Assign"));
    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalled());
    expect(onAssign).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

