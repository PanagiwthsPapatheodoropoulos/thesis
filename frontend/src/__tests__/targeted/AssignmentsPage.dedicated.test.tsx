// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getByEmployee: vi.fn(),
  accept: vi.fn(),
  authUser: { id: "u1", role: "EMPLOYEE" },
  triggerTaskDeleted: null,
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: { getByUserId: mocks.getByUserId },
  companiesAPI: { getJoinCode: vi.fn() },
  assignmentsAPI: { getByEmployee: mocks.getByEmployee, accept: mocks.accept },
}));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: true }) }));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED", TASK_DELETED: "TASK_DELETED" },
  useWebSocket: () => ({ 
    connected: true, 
    ready: true, 
    subscribe: (event, callback) => {
      if (event === "TASK_DELETED") {
        mocks.triggerTaskDeleted = callback;
      }
      return () => {};
    }
  }),
}));

import AssignmentsPage from "../../pages/AssignmentsPage";

describe("AssignmentsPage dedicated", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    mocks.triggerTaskDeleted = null;
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
    mocks.getByEmployee.mockResolvedValue([
      { id: "a1", taskId: "t1", taskTitle: "Task A", status: "PENDING", assignedDate: new Date().toISOString(), employeeName: "U", notes: "N" },
      { id: "a2", taskId: "t2", taskTitle: "Task B", status: "COMPLETED", assignedDate: new Date().toISOString(), employeeName: "U", notes: "" },
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

  it("removes assignment when task is deleted via WebSocket", async () => {
    render(<MemoryRouter><AssignmentsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Task A")).toBeInTheDocument());
    
    // Simulate receiving TASK_DELETED event for Task A's taskId ("t1")
    if (mocks.triggerTaskDeleted) {
      act(() => {
        mocks.triggerTaskDeleted("t1");
      });
    }
    
    await waitFor(() => expect(screen.queryByText("Task A")).not.toBeInTheDocument());
    expect(screen.getByText("Task B")).toBeInTheDocument();
  });
});
