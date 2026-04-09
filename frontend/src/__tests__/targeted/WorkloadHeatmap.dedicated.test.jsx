import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import WorkloadHeatmap from "../../components/WorkloadHeatmap.jsx";

const sampleData = [
  {
    employeeId: "e1",
    employeeName: "Alice Smith",
    department: "Engineering",
    workloadPercentage: 92,
    activeTasks: 7,
    completedTasks: 12,
  },
  {
    employeeId: "e2",
    employeeName: "Bob Jones",
    department: "Engineering",
    workloadPercentage: 35,
    activeTasks: 2,
    completedTasks: 4,
  },
  {
    employeeId: "e3",
    employeeName: "Chris Doe",
    department: null,
    workloadPercentage: 15,
    activeTasks: 1,
    completedTasks: 9,
  },
];

describe("WorkloadHeatmap dedicated", () => {
  it("renders departments and employee tiles", () => {
    render(<WorkloadHeatmap workloadData={sampleData} />);
    expect(screen.getByText(/Engineering \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unassigned \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("switches metric selector to active tasks", () => {
    render(<WorkloadHeatmap workloadData={sampleData} />);
    const metricSelect = screen.getByDisplayValue("Workload %");
    fireEvent.change(metricSelect, { target: { value: "active" } });
    expect(screen.getByDisplayValue("Active Tasks")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("switches metric selector to completed tasks and shows legend", () => {
    render(<WorkloadHeatmap workloadData={sampleData} />);
    const metricSelect = screen.getByDisplayValue("Workload %");
    fireEvent.change(metricSelect, { target: { value: "completed" } });
    expect(screen.getByDisplayValue("Completed Tasks")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Legend:")).toBeInTheDocument();
  });
});

