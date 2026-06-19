// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";

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
      <button onClick={() => onCloneTask(task)}>Clone Task</button>
      <button onClick={() => onTaskUpdate(null)}>Delete via Update</button>
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

describe("TasksPage interactions", () => {
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
        },
        {
          id: "t2",
          title: "[REQUEST] Pending Request",
          description: "This is a requested task.",
          status: "PENDING",
          priority: "HIGH",
          createdByName: "Employee User",
          createdBy: "u2",
        },
      ],
      totalPages: 1,
      totalElements: 2,
      number: 0,
    });
    mocks.getAllTeams.mockResolvedValue([{ id: "team1", name: "Alpha Team" }]);
    mocks.getMyTeams.mockResolvedValue([{ id: "team1", name: "Alpha Team" }]);
    mocks.getAllUsers.mockResolvedValue([
      { id: "u1", teamId: "team1", role: "ADMIN" },
      { id: "u2", teamId: "team1", role: "EMPLOYEE" },
    ]);
    mocks.getAllEmployees.mockResolvedValue([
      { id: "emp1", userId: "u2", firstName: "Employee", lastName: "User" },
    ]);
    mocks.getByUserId.mockResolvedValue({ id: "emp1" });
    mocks.create.mockResolvedValue({});
    mocks.requestTask.mockResolvedValue({});
    mocks.approveTask.mockResolvedValue({});
    mocks.rejectTask.mockResolvedValue({});
    mocks.deleteTask.mockResolvedValue({});
    mocks.updateTask.mockResolvedValue({});
    mocks.updateStatus.mockResolvedValue({});
    mocks.extractSkillsFromText.mockResolvedValue({ extracted_skills: [] });
    mocks.getAssignmentSuggestions.mockResolvedValue({ suggestions: [] });
  });

  it("renders tasks, filters, and supports searches", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());

    expect(screen.getByText("Normal Task")).toBeInTheDocument();
    expect(screen.getByText("Pending Request")).toBeInTheDocument();

    // Search input
    const searchInput = screen.getByPlaceholderText("Search tasks...");
    fireEvent.change(searchInput, { target: { value: "Normal" } });

    // Status filter
    const statusSelect = screen.getByDisplayValue("All Statuses");
    fireEvent.change(statusSelect, { target: { value: "PENDING" } });

    // Priority filter
    const prioritySelect = screen.getByDisplayValue("All Priorities");
    fireEvent.change(prioritySelect, { target: { value: "HIGH" } });

    // Sorting selection
    const sortSelect = screen.getByDisplayValue("Newest First");
    fireEvent.change(sortSelect, { target: { value: "dueDate-asc" } });

    await waitFor(() => {
      expect(mocks.getAllPaginated).toHaveBeenLastCalledWith(
        0,
        6,
        "dueDate",
        "asc",
        {
          search: "Normal",
          status: "PENDING",
          priority: "HIGH",
        }
      );
    });
  });

  it("handles approving, rejecting, and deleting tasks as ADMIN", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Approve")).toBeInTheDocument());

    // Click Approve
    fireEvent.click(screen.getByText("Approve"));
    expect(mocks.approveTask).toHaveBeenCalledWith("t2");

    // Click Reject
    fireEvent.click(screen.getByText("Reject"));
    await waitFor(() => {
      expect(mocks.rejectTask).toHaveBeenCalledWith("t2");
    });

    // Click Delete on Normal Task
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(mocks.deleteTask).toHaveBeenCalledWith("t1");
    });
  });

  it("supports creating tasks and triggers AI suggestions and workload checks", async () => {
    const { container } = render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("New Task")).toBeInTheDocument());

    // Open creation modal
    fireEvent.click(screen.getByText("New Task"));
    expect(screen.getByText("Create New Task")).toBeInTheDocument();

    // Fill fields
    fireEvent.change(screen.getByPlaceholderText("Task Title *"), { target: { value: "AI Supported Task" } });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "Writing Java and React development code in backend." },
    });
    fireEvent.change(screen.getByPlaceholderText("Hours"), { target: { value: "12" } });
    
    const dueDateInput = container.querySelector('input[type="datetime-local"]');
    fireEvent.change(dueDateInput, { target: { value: "2026-12-31T23:59" } });

    // Select Team using the select element
    const teamSelect = Array.from(container.querySelectorAll('select')).find(sel => 
      Array.from(sel.options).some(opt => opt.text.includes("All Teams Can See"))
    );
    fireEvent.change(teamSelect, { target: { value: "team1" } });

    // Select Employee using the select element
    await waitFor(() => {
      const employeeSelect = Array.from(container.querySelectorAll('select')).find(sel => 
        Array.from(sel.options).some(opt => opt.text.includes("Entire Team"))
      );
      expect(employeeSelect).toBeInTheDocument();
      fireEvent.change(employeeSelect, { target: { value: "emp1" } });
    });

    // Mock exists/resolve skill mocks
    mocks.getSkillByName.mockResolvedValue({ id: "s1" });

    // Trigger form submit
    fireEvent.submit(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalled();
    });
  });

  it("supports user requests as EMPLOYEE and handles status updates", async () => {
    mocks.userRole = "EMPLOYEE";
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Request Task")).toBeInTheDocument());

    // Check Start Task button
    const startTaskBtn = screen.getByRole("button", { name: /start task/i });
    fireEvent.click(startTaskBtn);
    expect(mocks.updateStatus).toHaveBeenCalledWith("t1", "IN_PROGRESS");
  });

  it("handles direct tag management additions and removals", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("urgent")).toBeInTheDocument());

    // Click direct add tag button
    const addTagBtn = screen.getAllByTitle("Add Tag directly")[0];
    fireEvent.click(addTagBtn);

    // Input tag name
    const tagInput = screen.getByPlaceholderText("Tag...");
    fireEvent.change(tagInput, { target: { value: "frontend" } });
    fireEvent.submit(screen.getByText("Add"));

    expect(mocks.updateTask).toHaveBeenCalledWith("t1", { tags: ["urgent", "frontend"] });

    // Remove tag
    const removeTagBtn = screen.getByTitle("Remove Tag");
    fireEvent.click(removeTagBtn);
    expect(mocks.updateTask).toHaveBeenCalledWith("t1", { tags: [] });
  });

  it("handles Details modal interactions and task cloning", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getAllByText("View Details")[0]).toBeInTheDocument());

    // Click View Details
    const viewDetailsBtns = screen.getAllByText("View Details");
    fireEvent.click(viewDetailsBtns[0]);

    expect(screen.getByTestId("mock-details-modal")).toBeInTheDocument();

    // Clone Task
    fireEvent.click(screen.getByText("Clone Task"));
    expect(screen.getByText("Create New Task")).toBeInTheDocument();
  });

  it("supports bulk actions (bulk status updates, bulk delete, bulk AI planning)", async () => {
    render(<TasksPage />);
    await waitFor(() => expect(screen.getByText("Bulk Actions")).toBeInTheDocument());

    // Click Bulk Actions
    fireEvent.click(screen.getByText("Bulk Actions"));

    // Checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    // Check action buttons exist
    expect(screen.getByText("Start (2)")).toBeInTheDocument();
    expect(screen.getByText("Complete (2)")).toBeInTheDocument();
    expect(screen.getByText("Delete (2)")).toBeInTheDocument();
    expect(screen.getByText("Prioritize (2)")).toBeInTheDocument();
    expect(screen.getByText("AI Plan (2)")).toBeInTheDocument();
    expect(screen.getByText("Skill Radar (2)")).toBeInTheDocument();

    // Click Start (2)
    fireEvent.click(screen.getByText("Start (2)"));
    expect(mocks.updateStatus).toHaveBeenCalledTimes(2);

    // Trigger AI Prioritize
    fireEvent.click(screen.getByText("Prioritize (2)"));
    expect(screen.getByTestId("mock-prioritizer-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply Prioritize"));

    // Trigger AI Plan
    fireEvent.click(screen.getByText("AI Plan (2)"));
    expect(screen.getByTestId("mock-planner-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply Plan"));

    // Trigger Skill Radar
    fireEvent.click(screen.getByText("Skill Radar (2)"));
    expect(screen.getByTestId("mock-radar-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));

    // Delete All
    fireEvent.click(screen.getByText("Delete (2)"));
    await waitFor(() => {
      expect(mocks.deleteTask).toHaveBeenCalledTimes(2);
    });
  });
});
