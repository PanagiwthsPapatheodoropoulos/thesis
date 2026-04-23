// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getByEmployee: vi.fn(),
  accept: vi.fn(),
  authUser: { id: "u1", role: "EMPLOYEE" },
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: { getByUserId: mocks.getByUserId },
  assignmentsAPI: { getByEmployee: mocks.getByEmployee, accept: mocks.accept },
}));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: true }) }));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED" },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: () => () => {} }),
}));

import AssignmentsPage from "../../pages/AssignmentsPage";

describe("AssignmentsPage dedicated", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
    mocks.getByEmployee.mockResolvedValue([
      { id: "a1", taskTitle: "Task A", status: "PENDING", assignedDate: new Date().toISOString(), employeeName: "U", notes: "N" },
      { id: "a2", taskTitle: "Task B", status: "COMPLETED", assignedDate: new Date().toISOString(), employeeName: "U", notes: "" },
    ]);
    mocks.accept.mockResolvedValue({});
  });

  it("shows employee profile required state when profile lookup fails", async () => {
    mocks.getByUserId.mockRejectedValueOnce(new Error("no employee"));
    render(<MemoryRouter><AssignmentsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Employee Profile Required/i)).toBeInTheDocument());
  });

  it("accepts pending assignment and refreshes list", async () => {
    render(<MemoryRouter><AssignmentsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getByEmployee).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Accept"));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith("a1"));
  });
});

