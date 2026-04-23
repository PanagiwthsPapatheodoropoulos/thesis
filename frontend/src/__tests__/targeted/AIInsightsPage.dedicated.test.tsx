// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../components/SkillRadarChart", () => ({
  default: () => <div>SkillRadarChart</div>,
}));

const mocks = vi.hoisted(() => ({
  getProductivityAnalytics: vi.fn(),
  detectAnomalies: vi.fn(),
  getAllSkills: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    getProductivityAnalytics: mocks.getProductivityAnalytics,
    detectAnomalies: mocks.detectAnomalies,
  },
  skillsAPI: {
    getAll: mocks.getAllSkills,
  },
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {
    TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
    TASK_CREATED: "TASK_CREATED",
    TASK_APPROVED: "TASK_APPROVED",
    ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
    ASSIGNMENT_ACCEPTED: "ASSIGNMENT_ACCEPTED",
  },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: mocks.subscribe }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import AIInsightsPage from "../../pages/AIInsightsPage";

describe("AIInsightsPage dedicated", () => {
  beforeEach(() => {
    mocks.getProductivityAnalytics.mockResolvedValue({});
    mocks.getAllSkills.mockResolvedValue([]);
    mocks.detectAnomalies.mockResolvedValue({ results: [] });
  });

  it("renders error state and retries successfully", async () => {
    mocks.getProductivityAnalytics
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({});

    render(<AIInsightsPage />);
    await waitFor(() => expect(screen.getByText(/Failed to Load AI Insights/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Try Again/i));
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalledTimes(2));
  });

  it("renders anomalies clear state when all anomaly endpoints are empty", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.detectAnomalies).toHaveBeenCalledTimes(5));
    fireEvent.click(screen.getByText("Anomalies"));
    expect(screen.getByText(/No anomalies detected/i)).toBeInTheDocument();
  });

  it("renders recommendations fallback and supports manual refresh", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("Recommendations"));
    expect(screen.getByText(/No Recommendations Available/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Refresh Insights/i));
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalledTimes(2));
  });

  it("renders skill insights tab content when skill data exists", async () => {
    mocks.getAllSkills.mockResolvedValueOnce([{ id: "s1", name: "React" }]);
    mocks.getProductivityAnalytics.mockResolvedValueOnce({
      skill_insights: [
        { skill_name: "s1", demand_level: "HIGH", avg_proficiency: 4, usage_count: 10 },
      ],
    });

    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Skill Insights"));
    expect(screen.getByText(/Skill Usage Across Company/i)).toBeInTheDocument();
    expect(screen.getAllByText(/HIGH DEMAND/i).length).toBeGreaterThan(0);
  });
});

