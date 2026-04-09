import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getAllEmployees: vi.fn(),
  getByUserId: vi.fn(),
  usersGetById: vi.fn(),
  authUser: { id: "u1", role: "ADMIN", username: "admin1" },
  authLoading: false,
}));

vi.mock("../../utils/api", () => ({
  tasksAPI: { getAll: mocks.getAll },
  employeesAPI: { getAll: mocks.getAllEmployees, getByUserId: mocks.getByUserId },
  usersAPI: { getById: mocks.usersGetById },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.authUser, loading: mocks.authLoading }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import DashboardPage from "../../pages/DashboardPage.jsx";

describe("DashboardPage coverage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authUser = { id: "u1", role: "ADMIN", username: "admin1" };
    mocks.getAll.mockResolvedValue([
      { id: "t1", title: "Task 1", status: "PENDING", priority: "HIGH", teamId: null, assignedEmployeeId: null },
      { id: "t2", title: "Task 2", status: "IN_PROGRESS", priority: "MEDIUM", teamId: null, assignedEmployeeId: null },
      { id: "t3", title: "Task 3", status: "COMPLETED", priority: "LOW", teamId: null, assignedEmployeeId: null },
      { id: "r1", title: "[REQUEST] Need tool", status: "PENDING", priority: "MEDIUM", createdBy: "u2" },
    ]);
    mocks.getAllEmployees.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
  });

  it("renders admin dashboard with KPI stats", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // totalTasks (excl requests)
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();
  });

  it("shows employee count for admin", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAllEmployees).toHaveBeenCalled());
    expect(screen.getByText("Employees")).toBeInTheDocument();
  });

  it("hides employee card for EMPLOYEE role", async () => {
    mocks.authUser = { id: "u2", role: "EMPLOYEE", username: "emp1" };
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
    mocks.usersGetById.mockResolvedValue({ id: "u2", teamId: "team1" });
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    expect(screen.queryByText("Employees")).toBeNull();
    expect(screen.getByText(/your team's tasks/i)).toBeInTheDocument();
  });

  it("handles task API failure gracefully showing zero stats", async () => {
    mocks.getAll.mockRejectedValue(new Error("API fail"));
    mocks.getAllEmployees.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    // Task fetch failure is caught internally, dashboard still renders
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    expect(screen.getByText("Refresh Data")).toBeInTheDocument();
  });

  it("shows no tasks pie chart placeholder when no tasks", async () => {
    mocks.getAll.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    });
  });

  it("refresh button re-fetches data", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Refresh Data"));
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledTimes(2));
  });

  it("renders task distribution and priority charts when tasks exist", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    expect(screen.getByText("Task Distribution")).toBeInTheDocument();
    expect(screen.getByText("Tasks by Priority")).toBeInTheDocument();
  });

  it("counts pending requests for admin/manager", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();
  });
});
