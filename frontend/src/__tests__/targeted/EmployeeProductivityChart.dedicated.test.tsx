// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  Line: () => <div>Line</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
}));

import EmployeeProductivityChart from "../../components/EmployeeProductivityChart";

describe("EmployeeProductivityChart dedicated", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          assignedEmployeeId: "e1",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          completedDate: new Date().toISOString(),
        },
        {
          assignments: [{ employeeId: "e1", status: "IN_PROGRESS" }],
          status: "IN_PROGRESS",
          createdAt: new Date().toISOString(),
        },
      ]),
    }));
  });

  it("loads productivity data and renders summary stats", async () => {
    render(<EmployeeProductivityChart employeeId="e1" darkMode={true} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText(/Productivity Trends/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Showing data for the last 30 days/i)).toBeInTheDocument();
  });

  it("switches time range and refetches data", async () => {
    render(<EmployeeProductivityChart employeeId="e1" darkMode={false} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("60d"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Showing data for the last 60 days/i)).toBeInTheDocument();
  });

  it("shows empty-state message when API call fails", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    render(<EmployeeProductivityChart employeeId="e1" darkMode={true} />);
    await waitFor(() => expect(screen.getByText(/No productivity data available yet/i)).toBeInTheDocument());
  });
});

