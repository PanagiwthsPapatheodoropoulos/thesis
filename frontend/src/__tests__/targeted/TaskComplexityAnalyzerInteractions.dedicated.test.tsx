// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  analyzeTaskComplexity: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    analyzeTaskComplexity: mocks.analyzeTaskComplexity,
  },
}));

import TaskComplexityAnalyzer from "../../components/TaskComplexityAnalyzer";

describe("TaskComplexityAnalyzer interactions", () => {
  beforeEach(() => {
    mocks.analyzeTaskComplexity.mockResolvedValue({
      complexity_score: 0.82,
      category: "Complex",
      risk_level: "HIGH",
      effort_hours_estimate: 15.5,
      reasoning: "Many dependencies",
      blocking_factors: ["Unclear API", "Legacy coupling"],
      required_expertise: ["Java", "React"],
    });
  });

  it("shows helper when title is too short", () => {
    render(<TaskComplexityAnalyzer title="ab" description="x" />);
    expect(screen.getByText(/Enter a task title/i)).toBeInTheDocument();
  });

  it("analyzes complexity and renders risk/skills", async () => {
    const onComplexityDetected = vi.fn();
    render(<TaskComplexityAnalyzer title="Implement billing module" description="Complex integration" onComplexityDetected={onComplexityDetected} />);
    fireEvent.click(screen.getByText(/Analyze Task Complexity with AI/i));
    await waitFor(() => expect(mocks.analyzeTaskComplexity).toHaveBeenCalled());
    expect(screen.getByText(/AI Complexity Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk Factors/i)).toBeInTheDocument();
    expect(screen.getByText(/Required Skills/i)).toBeInTheDocument();
    expect(onComplexityDetected).toHaveBeenCalledWith(0.82);
  });

  it("shows error for invalid response", async () => {
    mocks.analyzeTaskComplexity.mockResolvedValueOnce({});
    render(<TaskComplexityAnalyzer title="Valid title" description="desc" />);
    fireEvent.click(screen.getByText(/Analyze Task Complexity with AI/i));
    await waitFor(() => expect(screen.getByText(/Analysis Failed/i)).toBeInTheDocument());
  });
});

