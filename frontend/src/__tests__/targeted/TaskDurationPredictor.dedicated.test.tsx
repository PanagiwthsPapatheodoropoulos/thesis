// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  predictDuration: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  companiesAPI: { getJoinCode: vi.fn() },
  aiAPI: {
    predictDuration: mocks.predictDuration,
  },
}));

import TaskDurationPredictor from "../../components/TaskDurationPredictor";

describe("TaskDurationPredictor dedicated", () => {
  beforeEach(() => {
    mocks.predictDuration.mockReset();
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
    await screen.findByText(/Predicted Duration/i);
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
    await screen.findByText(/Recalculate Prediction/i);

    fireEvent.click(screen.getByText(/Recalculate Prediction/i));
    await waitFor(() => expect(mocks.predictDuration).toHaveBeenCalledTimes(2));
  });

  it("renders long task recommendation tip when predicted duration > 8", async () => {
    mocks.predictDuration.mockResolvedValueOnce({
      predicted_hours: 12.0,
      confidence_interval_lower: 10.0,
      confidence_interval_upper: 14.0,
      confidence_score: 0.9,
      model_version: "v1",
    });

    render(
      <TaskDurationPredictor
        taskData={{ priority: "HIGH", complexityScore: 0.9, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() =>
      expect(
        screen.getByText(/This task may take longer than expected. Consider breaking it into smaller subtasks./i)
      ).toBeInTheDocument()
    );
  });

  it("renders short task recommendation tip when predicted duration < 4", async () => {
    mocks.predictDuration.mockResolvedValueOnce({
      predicted_hours: 2.5,
      confidence_interval_lower: 1.0,
      confidence_interval_upper: 4.0,
      confidence_score: 0.85,
      model_version: "v1",
    });

    render(
      <TaskDurationPredictor
        taskData={{ priority: "LOW", complexityScore: 0.1, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() =>
      expect(
        screen.getByText(/This appears to be a quick task. Great for filling gaps in schedules./i)
      ).toBeInTheDocument()
    );
  });

  it("renders average task recommendation tip when predicted duration is between 4 and 8", async () => {
    mocks.predictDuration.mockResolvedValueOnce({
      predicted_hours: 5.5,
      confidence_interval_lower: 4.0,
      confidence_interval_upper: 7.0,
      confidence_score: 0.8,
      model_version: "v1",
    });

    render(
      <TaskDurationPredictor
        taskData={{ priority: "MEDIUM", complexityScore: 0.5, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() =>
      expect(
        screen.getByText(/This task has average complexity. Plan accordingly./i)
      ).toBeInTheDocument()
    );
  });

  it("handles error inside the returned API response object", async () => {
    mocks.predictDuration.mockResolvedValueOnce({
      error: "AI service offline",
    });

    render(
      <TaskDurationPredictor
        taskData={{ priority: "MEDIUM", complexityScore: 0.5, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() =>
      expect(screen.getByText(/AI service offline/i)).toBeInTheDocument()
    );
  });

  it("handles missing predicted_hours in API response", async () => {
    mocks.predictDuration.mockResolvedValueOnce({
      model_version: "v1",
    });

    render(
      <TaskDurationPredictor
        taskData={{ priority: "MEDIUM", complexityScore: 0.5, requiredSkillIds: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/Get AI Prediction/i));
    await waitFor(() =>
      expect(screen.getByText(/Prediction not available/i)).toBeInTheDocument()
    );
  });
});
