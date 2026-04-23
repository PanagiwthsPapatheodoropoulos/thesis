// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAllPaginated: vi.fn(),
  getAllTeams: vi.fn(),
  getMyTeams: vi.fn(),
  getAllUsers: vi.fn(),
  getAllEmployees: vi.fn(),
  getByUserId: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  tasksAPI: {
    getAllPaginated: mocks.getAllPaginated,
    approveTask: vi.fn().mockResolvedValue({}),
    rejectTask: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    requestTask: vi.fn().mockResolvedValue({}),
  },
  teamsAPI: {
    getAll: mocks.getAllTeams,
    getMyTeams: mocks.getMyTeams,
  },
  employeesAPI: {
    getAll: mocks.getAllEmployees,
    getByUserId: mocks.getByUserId,
  },
  usersAPI: {
    getAll: mocks.getAllUsers,
  },
  notificationsAPI: {},
  aiAPI: {},
  skillsAPI: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN" } }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

vi.mock("../../components/TaskDetailsModal", () => ({ default: () => <div>TaskDetailsModal</div> }));
vi.mock("../../components/AIAssignmentModal", () => ({ default: () => <div>AIAssignmentModal</div> }));
vi.mock("../../components/TaskDurationPredictor", () => ({ default: () => <div>TaskDurationPredictor</div> }));
vi.mock("../../components/SkillsMultiSelect", () => ({ default: () => <div>SkillsMultiSelect</div> }));
vi.mock("../../components/TaskComplexityAnalyzer", () => ({ default: () => <div>TaskComplexityAnalyzer</div> }));
vi.mock("../../components/TaskSkillsExtractor", () => ({ default: () => <div>TaskSkillsExtractor</div> }));

import TasksPage from "../../pages/TasksPage";

describe("TasksPage interactions", () => {
  beforeEach(() => {
    mocks.getAllPaginated.mockResolvedValue({
      content: [{ id: "t1", title: "[REQUEST] Test", status: "PENDING", priority: "MEDIUM" }],
      totalPages: 1,
      totalElements: 1,
      number: 0,
    });
    mocks.getAllTeams.mockResolvedValue([]);
    mocks.getMyTeams.mockResolvedValue([]);
    mocks.getAllUsers.mockResolvedValue([]);
    mocks.getAllEmployees.mockResolvedValue([]);
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
  });

  it("loads tasks, refreshes, and opens create modal", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    const beforeRefreshCalls = mocks.getAllPaginated.mock.calls.length;
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(mocks.getAllPaginated.mock.calls.length).toBeGreaterThan(beforeRefreshCalls));

    fireEvent.click(screen.getByText("New Task"));
    expect(screen.getByText("Create New Task")).toBeInTheDocument();
  });
});

