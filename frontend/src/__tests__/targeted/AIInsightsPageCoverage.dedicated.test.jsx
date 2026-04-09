import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getProductivityAnalytics: vi.fn(),
  detectAnomalies: vi.fn(),
  getAllSkills: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("../../components/SkillRadarChart", () => ({
  default: () => <div>SkillRadarChart</div>,
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
  useTheme: () => ({ darkMode: false }),
}));

import AIInsightsPage from "../../pages/AIInsightsPage.jsx";

describe("AIInsightsPage coverage dedicated - expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProductivityAnalytics.mockResolvedValue({
      company_metrics: {
        task_completion_rate: 0.78,
        on_time_delivery_rate: 0.65,
        avg_skill_utilization: 0.8,
        avg_completion_time: 5.2,
        total_tasks_completed: 42,
        total_tasks_overdue: 3,
        skill_diversity_score: 0.72,
      },
      top_performers: [
        { employee_name: "Alice", productivity_score: 9.5, tasks_completed: 15, skills_utilized: 5 },
        { employee_name: "Bob", productivity_score: 8.2, tasks_completed: 12, skills_utilized: 4 },
      ],
      skill_insights: [
        { skill_name: "s1", demand_level: "HIGH", avg_proficiency: 4, usage_count: 15 },
        { skill_name: "s2", demand_level: "MEDIUM", avg_proficiency: 3, usage_count: 8 },
      ],
      recommendations: [
        "⚠️ Consider hiring more backend engineers",
        "✅ Frontend team performance is excellent",
      ],
    });
    mocks.getAllSkills.mockResolvedValue([
      { id: "s1", name: "React" },
      { id: "s2", name: "Python" },
    ]);
    mocks.detectAnomalies.mockResolvedValue({ results: [] });
  });

  it("renders overview tab with completion rate and metrics", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    expect(screen.getByText("AI Insights Dashboard")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument(); // completion rate
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
  });

  it("renders top performers in overview tab", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    expect(screen.getByText("Top Performers")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders skill insights tab with skill data", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Skill Insights"));
    expect(screen.getByText("Skill Usage Across Company")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("renders recommendations tab with items", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Recommendations"));
    expect(screen.getByText(/Consider hiring more backend engineers/)).toBeInTheDocument();
    expect(screen.getByText(/Frontend team performance is excellent/)).toBeInTheDocument();
  });

  it("renders anomalies tab with task anomalies", async () => {
    mocks.detectAnomalies.mockImplementation(({ entityType }) => {
      if (entityType === "TASK") {
        return Promise.resolve({
          results: [{ severity: "HIGH", description: "Task delayed by 3 days", anomaly_score: 0.95 }],
        });
      }
      return Promise.resolve({ results: [] });
    });
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.detectAnomalies).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Anomalies"));
    await waitFor(() => expect(screen.getByText(/Task delayed by 3 days/)).toBeInTheDocument());
  });

  it("handles empty analytics gracefully", async () => {
    mocks.getProductivityAnalytics.mockResolvedValue({
      company_metrics: {},
      top_performers: [],
      skill_insights: [],
      recommendations: [],
    });
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    // Overview renders with zero values — multiple 0% cards exist
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });

  it("shows error state when API fails", async () => {
    mocks.getProductivityAnalytics.mockRejectedValue(new Error("API down"));
    render(<AIInsightsPage />);
    await waitFor(() => expect(screen.getByText("Failed to Load AI Insights")).toBeInTheDocument());
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("refresh button triggers data reload", async () => {
    render(<AIInsightsPage />);
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Refresh Insights"));
    await waitFor(() => expect(mocks.getProductivityAnalytics).toHaveBeenCalledTimes(2));
  });
});
