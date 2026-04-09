// TasksPage.coverage.test.jsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllPaginated: vi.fn(),
  getAllTeams: vi.fn(),
  getAllUsers: vi.fn(),
  getAllEmployees: vi.fn(),
  getByUserId: vi.fn(),
  createTask: vi.fn(),
  requestTask: vi.fn(),
  updateStatus: vi.fn(),
  deleteTask: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  authUser: { id: "u1", role: "ADMIN" },
}));

vi.mock("../../utils/api", () => ({
  tasksAPI: {
    getAllPaginated: mocks.getAllPaginated,
    create: mocks.createTask,
    requestTask: mocks.requestTask,
    updateStatus: mocks.updateStatus,
    delete: mocks.deleteTask,
    approveTask: mocks.approveTask,
    rejectTask: mocks.rejectTask,
  },
  teamsAPI: { getAll: mocks.getAllTeams, getMyTeams: vi.fn().mockResolvedValue([]) },
  employeesAPI: { getAll: mocks.getAllEmployees, getByUserId: mocks.getByUserId },
  usersAPI: { getAll: mocks.getAllUsers },
  notificationsAPI: { create: vi.fn().mockResolvedValue({}) },
  aiAPI: { getAssignmentSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }) },
  skillsAPI: {
    getById: vi.fn().mockRejectedValue(new Error("not found")),
    getByName: vi.fn().mockRejectedValue(new Error("not found")),
    create: vi.fn().mockResolvedValue({ id: "skill1" }),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: false }) }));
vi.mock("../../components/TaskDetailsModal", () => ({ default: () => <div>TaskDetailsModal</div> }));
vi.mock("../../components/AIAssignmentModal", () => ({ default: () => <div>AIAssignmentModal</div> }));
vi.mock("../../components/TaskDurationPredictor", () => ({ default: () => <div>TaskDurationPredictor</div> }));
vi.mock("../../components/SkillsMultiSelect", () => ({ default: () => <div>SkillsMultiSelect</div> }));
vi.mock("../../components/TaskComplexityAnalyzer", () => ({ default: () => <div>TaskComplexityAnalyzer</div> }));
vi.mock("../../components/TaskSkillsExtractor", () => ({ default: () => <div>TaskSkillsExtractor</div> }));

import TasksPage from "../../pages/TasksPage.jsx";

const pendingTask = { id: "t1", title: "Task 1", status: "PENDING", priority: "MEDIUM", description: "d", assignments: [] };
const inProgressTask = { id: "t2", title: "Task 2", status: "IN_PROGRESS", priority: "HIGH", description: "d", assignments: [] };

const singlePage = (content) => ({
  content,
  totalPages: 1,
  totalElements: content.length,
  number: 0,
});

describe("TasksPage coverage — uncovered branches", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    mocks.authUser = { id: "u1", role: "ADMIN" };
    mocks.getAllPaginated.mockResolvedValue(singlePage([pendingTask]));
    mocks.getAllTeams.mockResolvedValue([{ id: "team1", name: "Alpha Team" }]);
    mocks.getAllUsers.mockResolvedValue([{ id: "u2", username: "Bob", teamId: "team1" }]);
    mocks.getAllEmployees.mockResolvedValue([{ id: "e1", firstName: "Alice", lastName: "Smith", userId: "u2" }]);
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
    mocks.createTask.mockResolvedValue({ id: "t2" });
    mocks.updateStatus.mockResolvedValue({});
    mocks.deleteTask.mockResolvedValue({});
    mocks.approveTask.mockResolvedValue({});
    mocks.rejectTask.mockResolvedValue({});
  });

  it("changes sort order via sort dropdown", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    const callsBefore = mocks.getAllPaginated.mock.calls.length;
    const selects = document.querySelectorAll("select");
    // Sort select has options like "createdAt-desc"
    const sortSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === "createdAt-asc")
    );
    expect(sortSelect).toBeTruthy();
    fireEvent.change(sortSelect, { target: { value: "dueDate-asc" } });

    await waitFor(() =>
      expect(mocks.getAllPaginated.mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("clicks Start Task on a pending unassigned task", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Start Task"));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith("t1", "IN_PROGRESS"));
  });

  it("clicks Complete on an in-progress task and triggers notification path", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { ...inProgressTask, createdBy: "u2", teamId: "team1" }
    ]));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Complete"));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith("t2", "COMPLETED"));
  });

  it("shows alert when updateStatus fails", async () => {
    mocks.updateStatus.mockRejectedValueOnce(new Error("fail"));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Start Task"));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
  });

  it("bulk Start selected tasks", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { id: "b1", title: "B1", status: "PENDING", priority: "LOW", description: "d", assignments: [] },
      { id: "b2", title: "B2", status: "PENDING", priority: "LOW", description: "d", assignments: [] },
    ]));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Bulk Actions"));
    const checks = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);

    fireEvent.click(screen.getByText(/Start \(\d+\)/i));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith("b1", "IN_PROGRESS"));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith("b2", "IN_PROGRESS"));
  });

  it("bulk Complete selected tasks", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { id: "c1", title: "C1", status: "PENDING", priority: "LOW", description: "d", assignments: [] },
    ]));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Bulk Actions"));
    const checks = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checks[0]);

    fireEvent.click(screen.getByText(/Complete \(\d+\)/i));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith("c1", "COMPLETED"));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
  });

  it("exits bulk mode via toggle button", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Bulk Actions"));
    expect(screen.getByText("Exit Bulk Mode")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Exit Bulk Mode"));
    expect(screen.getByText("Bulk Actions")).toBeInTheDocument();
  });

  it("reject task shows confirm then calls rejectTask", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { id: "r1", title: "[REQUEST] Do work", status: "PENDING", priority: "MEDIUM", description: "d", createdByName: "emp" }
    ]));
    window.confirm = vi.fn(() => true);
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Reject/i));
    await waitFor(() => expect(mocks.rejectTask).toHaveBeenCalledWith("r1"));
    expect(window.alert).toHaveBeenCalled();
  });

  it("reject task aborts when confirm is false", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { id: "r1", title: "[REQUEST] Do work", status: "PENDING", priority: "MEDIUM", description: "d", createdByName: "emp" }
    ]));
    window.confirm = vi.fn(() => false);
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Reject/i));
    expect(mocks.rejectTask).not.toHaveBeenCalled();
  });

  it("opens create modal in employee request mode", async () => {
    mocks.authUser = { id: "u2", role: "EMPLOYEE" };
    mocks.getAllPaginated.mockResolvedValue(singlePage([]));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Request Task"));
    expect(screen.getByText("Request New Task")).toBeInTheDocument();
    // Employee sees advisory notice
    expect(screen.getByText(/reviewed by managers/i)).toBeInTheDocument();
  });

  it("closes create modal via X button", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("New Task"));
    expect(screen.getByText("Create New Task")).toBeInTheDocument();

    const closeBtn = Array.from(document.querySelectorAll("button")).find(b =>
      b.querySelector(".lucide-x")
    );
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    await waitFor(() =>
      expect(screen.queryByText("Create New Task")).not.toBeInTheDocument()
    );
  });

  it("selects a team in create modal and shows employee dropdown", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("New Task"));
    await waitFor(() => expect(screen.getByText("Create New Task")).toBeInTheDocument());

    // Find the team select inside the modal
    const teamSelect = Array.from(document.querySelectorAll("select")).find(s =>
      Array.from(s.options).some(o => o.text === "Alpha Team")
    );
    expect(teamSelect).toBeTruthy();
    fireEvent.change(teamSelect, { target: { value: "team1" } });

    // Employee dropdown should appear after team selection
    await waitFor(() => {
      const empSelect = Array.from(document.querySelectorAll("select")).find(s =>
        Array.from(s.options).some(o => o.text.includes("Alice"))
      );
      expect(empSelect).toBeTruthy();
    });
  });

  it("creates task with form submission", async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("New Task"));
    await waitFor(() => expect(screen.getByText("Create New Task")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Task Title *"), { target: { value: "My New Task" } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getByText("Create Task"));

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalled());
  });

  it("shows error alert when create task fails", async () => {
    mocks.createTask.mockRejectedValueOnce(new Error("Server error"));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("New Task"));
    await waitFor(() => expect(screen.getByText("Create New Task")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Task Title *"), { target: { value: "Failing Task" } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]'), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getByText("Create Task"));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Server error")));
  });

  it("shows no tasks found message", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([]));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    expect(screen.getByText(/No tasks found/i)).toBeInTheDocument();
  });

  it("shows delete error alert when delete fails", async () => {
    mocks.deleteTask.mockRejectedValueOnce(new Error("delete fail"));
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
  });

  it("bulk delete aborts when confirm returns false", async () => {
    mocks.getAllPaginated.mockResolvedValue(singlePage([
      { id: "d1", title: "D1", status: "PENDING", priority: "LOW", description: "d", assignments: [] },
    ]));
    window.confirm = vi.fn(() => false);
    render(<MemoryRouter><TasksPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Bulk Actions"));
    const checks = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checks[0]);

    fireEvent.click(screen.getByText(/Delete \(\d+\)/i));
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });
});