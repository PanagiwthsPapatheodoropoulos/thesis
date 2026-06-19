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
  create: vi.fn(),
  requestTask: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
  updateStatus: vi.fn(),
  getSkillById: vi.fn(),
  getSkillByName: vi.fn(),
  createSkill: vi.fn(),
  extractSkillsFromText: vi.fn(),
  getAssignmentSuggestions: vi.fn(),
  userRole: "ADMIN",
}));

vi.mock("../../utils/api", () => ({
  tasksAPI: {
    getAllPaginated: mocks.getAllPaginated,
    approveTask: mocks.approveTask,
    rejectTask: mocks.rejectTask,
    create: mocks.create,
    requestTask: mocks.requestTask,
    delete: mocks.deleteTask,
    update: mocks.updateTask,
    updateStatus: mocks.updateStatus,
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
  notificationsAPI: {
    create: vi.fn().mockResolvedValue({}),
  },
  aiAPI: {
    extractSkillsFromText: mocks.extractSkillsFromText,
    getAssignmentSuggestions: mocks.getAssignmentSuggestions,
  },
  skillsAPI: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: mocks.getSkillById,
    getByName: mocks.getSkillByName,
    create: mocks.createSkill,
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: mocks.userRole } }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../components/ConfirmDialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("../../components/TaskDetailsModal", () => ({
  __esModule: true,
  default: ({ task, isOpen, onClose, onTaskUpdate, onCloneTask }) => isOpen ? (
    <div data-testid="mock-details-modal">
      <h3>Mock Details Modal</h3>
      <button onClick={() => onCloneTask(task)}>Trigger Clone</button>
      <button onClick={() => onTaskUpdate({ ...task, title: "Updated Title" })}>Trigger Update</button>
      <button onClick={() => onTaskUpdate(null)}>Trigger Delete</button>
      <button onClick={onClose}>Close Details</button>
    </div>
  ) : null,
}));

vi.mock("../../components/AIAssignmentModal", () => ({
  __esModule: true,
  default: ({ task, isOpen, onClose, onAssignmentCreated }) => isOpen ? (
    <div data-testid="mock-assignment-modal">
      <h3>Mock Assignment Modal</h3>
      <button onClick={onAssignmentCreated}>Complete Assignment</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

vi.mock("../../components/AIPrioritizerModal", () => ({
  __esModule: true,
  default: ({ isOpen, tasks, onClose, onApplied }) => isOpen ? (
    <div data-testid="mock-prioritizer-modal">
      <h3>Mock Prioritizer Modal</h3>
      <button onClick={onApplied}>Apply Prioritize</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

vi.mock("../../components/AIBulkPlannerModal", () => ({
  __esModule: true,
  default: ({ isOpen, tasks, onClose, onApplied }) => isOpen ? (
    <div data-testid="mock-planner-modal">
      <h3>Mock Planner Modal</h3>
      <button onClick={onApplied}>Apply Plan</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

vi.mock("../../components/TeamSkillGapRadarModal", () => ({
  __esModule: true,
  default: ({ isOpen, tasks, onClose }) => isOpen ? (
    <div data-testid="mock-radar-modal">
      <h3>Mock Radar Modal</h3>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

import TasksPage from "../../pages/TasksPage";

describe("TasksPage child modal integration and callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userRole = "ADMIN";
    mocks.getAllPaginated.mockResolvedValue({
      content: [
        {
          id: "t1",
          title: "Normal Task",
          description: "This is a normal task description.",
          status: "PENDING",
          priority: "MEDIUM",
          tags: ["urgent"],
          estimatedHours: 10,
        },
      ],
      totalPages: 1,
      totalElements: 1,
      number: 0,
    });
    mocks.getAllTeams.mockResolvedValue([{ id: "team1", name: "Alpha Team" }]);
    mocks.getMyTeams.mockResolvedValue([{ id: "team1", name: "Alpha Team" }]);
    mocks.getAllUsers.mockResolvedValue([
      { id: "u1", teamId: "team1", role: "ADMIN" },
    ]);
    mocks.getAllEmployees.mockResolvedValue([
      { id: "emp1", userId: "u1", firstName: "Admin", lastName: "User" },
    ]);
    mocks.getByUserId.mockResolvedValue({ id: "emp1" });
  });

  it("handles cloning of a task from details modal callback", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("View Details")).toBeInTheDocument());

    // Open Details Modal
    fireEvent.click(screen.getByText("View Details"));
    expect(screen.getByTestId("mock-details-modal")).toBeInTheDocument();

    // Trigger Clone Task from child modal
    fireEvent.click(screen.getByText("Trigger Clone"));
    
    // Create task form should populate and modal open
    expect(screen.getByText("Create New Task")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Normal Task")).toBeInTheDocument();
  });

  it("handles updating/refreshing task list on update task details callback", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("View Details")).toBeInTheDocument());

    // Open Details Modal
    fireEvent.click(screen.getByText("View Details"));
    
    // Click Trigger Update inside child modal
    mocks.getAllPaginated.mockClear();
    fireEvent.click(screen.getByText("Trigger Update"));

    // Verify tasks are refetched
    await waitFor(() => {
      expect(mocks.getAllPaginated).toHaveBeenCalled();
    });
  });

  it("handles closing modal on task deletion callback", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("View Details")).toBeInTheDocument());

    // Open Details Modal
    fireEvent.click(screen.getByText("View Details"));
    
    // Click Trigger Delete inside child modal
    fireEvent.click(screen.getByText("Trigger Delete"));

    // Modal should close
    expect(screen.queryByTestId("mock-details-modal")).not.toBeInTheDocument();
  });

  it("interacts with the create task modal form inputs, dropdowns, and submits", async () => {
    mocks.create.mockResolvedValue({
      id: "t2",
      title: "New Created Task",
      status: "PENDING",
      priority: "CRITICAL",
    });
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("New Task")).toBeInTheDocument());

    // 1. Open the creation modal
    fireEvent.click(screen.getByText("New Task"));
    expect(screen.getByText("Create New Task")).toBeInTheDocument();

    // 2. Fill in Title, Description, and Due Date (required)
    const titleInput = screen.getByPlaceholderText("Task Title *");
    const descTextarea = screen.getByPlaceholderText("Description");
    fireEvent.change(titleInput, { target: { value: "New Created Task" } });
    fireEvent.change(descTextarea, { target: { value: "This is a new test task description" } });
    
    const dueDateInput = document.querySelector('input[type="datetime-local"]');
    fireEvent.change(dueDateInput, { target: { value: "2026-07-01T12:00" } });

    // 3. Click the team dropdown button (initially showing 'Public Task (All Teams)')
    const teamDropdownBtn = screen.getByText("Public Task (All Teams)");
    fireEvent.click(teamDropdownBtn);

    // 4. Click 'Alpha Team' inside the team dropdown (select the second one, since first is in hidden option tag)
    const teamOption = screen.getAllByText("Alpha Team")[1];
    fireEvent.click(teamOption);

    // 5. Click the priority dropdown button (initially showing 'Medium Priority')
    const priorityDropdownBtn = screen.getAllByText("Medium Priority")[1];
    fireEvent.click(priorityDropdownBtn);

    // 6. Click 'Critical Priority' inside the priority dropdown
    const priorityOption = screen.getAllByText("Critical Priority")[1];
    fireEvent.click(priorityOption);

    // 7. Submit the form
    const submitBtn = screen.getByText("Create Task");
    fireEvent.click(submitBtn);

    // Verify task creation was triggered with the selected inputs
    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Created Task",
          description: "This is a new test task description",
          teamId: "team1",
          priority: "CRITICAL",
        })
      );
    });
  });
});
