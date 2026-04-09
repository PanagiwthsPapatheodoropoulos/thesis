import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  predictDuration: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    predictDuration: mocks.predictDuration,
  },
}));

import TaskDurationPredictor from "../../components/TaskDurationPredictor.jsx";

describe("TaskDurationPredictor dedicated", () => {
  beforeEach(() => {
    mocks.predictDuration.mockResolvedValue({
      predicted_hours: 6.25,
      confidence_interval_lower: 4.5,
      confidence_interval_upper: 8.0,
      confidence_score: 0.8,
      model_version: "v1",
    });
  });

  it("renders helper message when priority is missing", () => {
    render(<TaskDurationPredictor taskData={{ complexityScore: 0.4, requiredSkillIds: [] }} />);
    expect(screen.getByText(/Select a priority to enable AI duration prediction/i)).toBeInTheDocument();
  });

  it("fetches prediction and renders prediction details", async () => {
    const onPredictionReceived = vi.fn();
    render(
      <TaskDurationPredictor
        taskData={{ priority: "HIGH", complexityScore: 0.7, requiredSkillIds: ["s1", "s2"] }}
        onPredictionReceived={onPredictionReceived}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() => expect(mocks.predictDuration).toHaveBeenCalled());
    expect(screen.getByText(/Predicted Duration/i)).toBeInTheDocument();
    expect(screen.getByText(/Model: v1/i)).toBeInTheDocument();
    expect(onPredictionReceived).toHaveBeenCalledWith(6.25);
  });

  it("shows error branch when prediction API fails", async () => {
    mocks.predictDuration.mockRejectedValueOnce(new Error("network fail"));
    render(
      <TaskDurationPredictor
        taskData={{ priority: "LOW", complexityScore: 0.2, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() => expect(screen.getByText(/Prediction Failed/i)).toBeInTheDocument());
    expect(screen.getByText(/network fail/i)).toBeInTheDocument();
  });

  it("supports recalculation after a successful prediction", async () => {
    render(
      <TaskDurationPredictor
        taskData={{ priority: "MEDIUM", complexityScore: 0.5, requiredSkillIds: ["s1"] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() => expect(mocks.predictDuration).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText(/Recalculate Prediction/i));
    await waitFor(() => expect(mocks.predictDuration).toHaveBeenCalledTimes(2));
  });
});

