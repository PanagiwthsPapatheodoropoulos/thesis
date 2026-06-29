// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllEmployees: vi.fn(),
  getAllTasks: vi.fn(),
  getWorkload: vi.fn(),
  toastShow: vi.fn(),
  userRole: "ADMIN",
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: { getAll: mocks.getAllEmployees, getWorkload: mocks.getWorkload, getDepartmentWorkloads: vi.fn().mockResolvedValue([]) },
  companiesAPI: { getJoinCode: vi.fn() },
  tasksAPI: { getAll: mocks.getAllTasks },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: mocks.userRole } })
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true })
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.toastShow }),
}));

vi.mock("../../components/WorkloadHeatmap", () => ({
  default: () => <div>WorkloadHeatmap</div>
}));

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
  ReferenceLine: () => <div />,
}));

import WorkloadPage from "../../pages/WorkloadPage";

describe("WorkloadPage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userRole = "ADMIN";
    mocks.getAllEmployees.mockResolvedValue([
      { id: "e1", profileImageUrl: "http://image.png/e1.jpg", userId: "u1" },
      { id: "e2", profileImageUrl: "", userId: "u2" },
    ]);
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

  it("renders basic dashboard stats cards, charts, and table elements", async () => {
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Alice Brown")).toBeInTheDocument());

    expect(screen.getAllByText("Eng")[0]).toBeInTheDocument();
    expect(screen.getByText("OPTIMAL")).toBeInTheDocument();

    // Check stats calculations
    expect(screen.getAllByText("65.0%")[0]).toBeInTheDocument(); // average workload

    // Check image render
    const img = screen.getByAltText("Alice Brown");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "http://image.png/e1.jpg");
  });

  it("handles auto-refresh toggle", async () => {
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Live")).toBeInTheDocument());

    const liveBtn = screen.getByText("Live");
    fireEvent.click(liveBtn);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("refetches workload data when profileUpdated event is dispatched", async () => {
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getWorkload).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("profileUpdated"));
    });

    await waitFor(() => expect(mocks.getWorkload).toHaveBeenCalledTimes(2));
  });

  it("supports sorting by different criteria (activeTasks, completedTasks, name)", async () => {
    mocks.getWorkload.mockResolvedValue([
      { employeeId: "e1", employeeName: "Charlie", department: "HR", activeTasks: 1, completedTasks: 5, pendingTasks: 0, workloadPercentage: 40, status: "OPTIMAL" },
      { employeeId: "e2", employeeName: "Bob", department: "Eng", activeTasks: 4, completedTasks: 2, pendingTasks: 0, workloadPercentage: 95, status: "OVERLOADED" },
    ]);

    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());

    const selects = document.querySelectorAll("select");
    const sortBySelect = selects[0];

    // Sort by active
    fireEvent.change(sortBySelect, { target: { value: "active" } });
    // First row should now be Bob (activeTasks: 4)
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Bob");

    // Sort by completed
    fireEvent.change(sortBySelect, { target: { value: "completed" } });
    // First row should now be Charlie (completedTasks: 5)
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Charlie");

    // Sort by name
    fireEvent.change(sortBySelect, { target: { value: "name" } });
    // Bob is first alphabetically
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Bob");
  });

  it("supports filtering by workload status", async () => {
    mocks.getWorkload.mockResolvedValue([
      { employeeId: "e1", employeeName: "Charlie", department: "HR", activeTasks: 1, completedTasks: 5, pendingTasks: 0, workloadPercentage: 40, status: "UNDERLOADED" },
      { employeeId: "e2", employeeName: "Bob", department: "Eng", activeTasks: 4, completedTasks: 2, pendingTasks: 0, workloadPercentage: 95, status: "OVERLOADED" },
    ]);

    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Charlie")).toBeInTheDocument());

    const selects = document.querySelectorAll("select");
    const filterSelect = selects[1];

    // Filter by Overloaded
    fireEvent.change(filterSelect, { target: { value: "OVERLOADED" } });
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("handles AI rebalance modal flow when no suggestions exist", async () => {
    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("AI Rebalance")).toBeInTheDocument());

    fireEvent.click(screen.getByText("AI Rebalance"));
    expect(screen.getByText("AI Workload Rebalancer")).toBeInTheDocument();
    expect(screen.getByText("Workload is Balanced!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "" })); // close button
    expect(screen.queryByText("AI Workload Rebalancer")).not.toBeInTheDocument();
  });

  it("handles AI rebalance suggestions and allows applying reassignments", async () => {
    mocks.getWorkload.mockResolvedValue([
      { employeeId: "e1", employeeName: "Overloaded Emp", department: "Eng", activeTasks: 5, completedTasks: 0, pendingTasks: 0, workloadPercentage: 110, status: "OVERLOADED" },
      { employeeId: "e2", employeeName: "Underloaded Emp", department: "Eng", activeTasks: 0, completedTasks: 0, pendingTasks: 0, workloadPercentage: 10, status: "UNDERLOADED" },
    ]);

    render(<MemoryRouter><WorkloadPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("AI Rebalance")).toBeInTheDocument());

    fireEvent.click(screen.getByText("AI Rebalance"));
    expect(screen.getByText("AI Workload Rebalancer")).toBeInTheDocument();
    
    // Check suggestions text or elements
    expect(screen.getAllByText(/Overloaded Emp/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Underloaded Emp/)[0]).toBeInTheDocument();

    // Click Apply Suggestions button
    const applyBtn = screen.getByRole("button", { name: /Apply Suggestions/i });
    fireEvent.click(applyBtn);

    expect(mocks.toastShow).toHaveBeenCalledWith(
      "Rebalance suggestions applied successfully! Task reassignments are now queued.",
      "success",
      5000
    );
    expect(screen.queryByText("AI Workload Rebalancer")).not.toBeInTheDocument();
  });
});
