// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllEmployees: vi.fn(),
  getAllTasks: vi.fn(),
  getWorkload: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: { getAll: mocks.getAllEmployees, getWorkload: mocks.getWorkload },
  tasksAPI: { getAll: mocks.getAllTasks },
}));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", role: "ADMIN" } }) }));
vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: true }) }));
vi.mock("../../components/WorkloadHeatmap", () => ({ default: () => <div>WorkloadHeatmap</div> }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }) => <div>{children}</div>,
  Pie: ({ children }) => <div>{children}</div>,
  Cell: () => <div />,
  Legend: () => <div />,
}));

import WorkloadPage from "../../pages/WorkloadPage";

describe("WorkloadPage dedicated", () => {
  beforeEach(() => {
    mocks.getAllEmployees.mockResolvedValue([{ id: "e1", profileImageUrl: "" }]);
    mocks.getAllTasks.mockResolvedValue([]);
    mocks.getWorkload.mockResolvedValue([
      { employeeId: "e1", employeeName: "Alice Brown", department: "Eng", activeTasks: 2, completedTasks: 1, pendingTasks: 0, workloadPercentage: 65, status: "OPTIMAL" },
    ]);
  });

  it("renders empty-state table message when workload call fails", async () => {
    mocks.getWorkload.mockRejectedValueOnce(new Error("fail"));
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/No employees match the selected filters/i)).toBeInTheDocument());
  });

  it("applies filter and sort controls", async () => {
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Employee Details/i)).toBeInTheDocument());
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "name" } });
    fireEvent.change(selects[1], { target: { value: "OVERLOADED" } });
    expect(screen.getByText(/No employees match the selected filters/i)).toBeInTheDocument();
  });
});

