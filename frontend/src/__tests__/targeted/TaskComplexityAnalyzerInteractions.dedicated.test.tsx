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

  it("renders in dark mode correctly", () => {
    render(<TaskComplexityAnalyzer title="Valid title" description="desc" darkMode={true} />);
    expect(screen.getByText(/Analyze Task Complexity with AI/i)).toBeInTheDocument();
  });

  it("handles low complexity score and green indicator color", async () => {
    mocks.analyzeTaskComplexity.mockResolvedValueOnce({
      complexity_score: 0.3,
      category: "Simple",
      risk_level: "LOW",
      effort_hours_estimate: 2.0,
      reasoning: "Very basic task",
      blocking_factors: [],
      required_expertise: ["HTML"],
    });

    render(<TaskComplexityAnalyzer title="Simple title" description="easy" />);
    fireEvent.click(screen.getByText(/Analyze Task Complexity with AI/i));
    await waitFor(() => expect(screen.getByText("30%")).toBeInTheDocument());
    expect(screen.getByText("30%")).toHaveClass("text-green-500");
  });

  it("handles medium complexity score and orange indicator color", async () => {
    mocks.analyzeTaskComplexity.mockResolvedValueOnce({
      complexity_score: 0.6,
      category: "Medium",
      risk_level: "MEDIUM",
      effort_hours_estimate: 8.0,
      reasoning: "Standard CRUD",
    });

    render(<TaskComplexityAnalyzer title="Medium task title" description="standard" />);
    fireEvent.click(screen.getByText(/Analyze Task Complexity with AI/i));
    await waitFor(() => expect(screen.getByText("60%")).toBeInTheDocument());
    expect(screen.getByText("60%")).toHaveClass("text-orange-500");
  });

  it("handles missing optional values in response gracefully", async () => {
    mocks.analyzeTaskComplexity.mockResolvedValueOnce({
      complexity_score: 0.5,
    });

    render(<TaskComplexityAnalyzer title="Uncertain title" description="desc" />);
    fireEvent.click(screen.getByText(/Analyze Task Complexity with AI/i));
    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("0.0h")).toBeInTheDocument();
    expect(screen.getByText("No reasoning provided")).toBeInTheDocument();
  });
});
