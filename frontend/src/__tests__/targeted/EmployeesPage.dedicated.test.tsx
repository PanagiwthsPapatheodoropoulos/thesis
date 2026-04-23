// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllPaginated: vi.fn(),
  getDepartmentNames: vi.fn(),
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  createEmployee: vi.fn(),
  deleteUser: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: {
    getAllPaginated: mocks.getAllPaginated,
    create: mocks.createEmployee,
    update: vi.fn().mockResolvedValue({}),
  },
  usersAPI: {
    getAll: mocks.getAllUsers,
    getById: mocks.getUserById,
    delete: mocks.deleteUser,
  },
  departmentsAPI: {
    getDepartmentNames: mocks.getDepartmentNames,
  },
  notificationsAPI: {
    create: mocks.createNotification,
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN", companyId: "c1" } }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { PROFILE_UPDATED: "PROFILE_UPDATED" },
  useWebSocket: () => ({ ready: true, subscribe: () => () => {} }),
}));
vi.mock("../../components/SkillsInput", () => ({
  default: ({ onSkillsChange }) => (
    <button type="button" onClick={() => onSkillsChange([{ skillName: "React", proficiencyLevel: 3 }])}>
      MockAddSkill
    </button>
  ),
}));

import EmployeesPage from "../../pages/EmployeesPage";

describe("EmployeesPage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    mocks.getAllPaginated.mockResolvedValue({
      content: [{ id: "e1", userId: "u2", firstName: "A", lastName: "B", position: "Dev", department: "Eng", skills: [] }],
      totalPages: 1,
      totalElements: 1,
    });
    mocks.getDepartmentNames.mockResolvedValue(["Eng"]);
    mocks.getAllUsers.mockResolvedValue([{ id: "u2", role: "USER", companyId: "c1", username: "user2", email: "u2@x.com" }]);
    mocks.getUserById.mockResolvedValue({ id: "u2", username: "user2", role: "USER" });
    mocks.createEmployee.mockResolvedValue({ id: "e2" });
    mocks.deleteUser.mockRejectedValueOnce(new Error("delete failed"));
    mocks.createNotification.mockResolvedValue({});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => "",
    });
  });

  it("shows alert when edit data fetch fails", async () => {
    mocks.getUserById.mockRejectedValueOnce(new Error("load failed"));
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByTitle("Edit employee"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Error loading employee data")));
  });

  it("shows alert on delete error path", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText(/Yes, Remove Employee/i));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Error deleting employee")));
  });

  it("creates employee through selected skills branch", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Add Employee"));
    fireEvent.click(screen.getByText("MockAddSkill"));

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 2], { target: { value: "u2" } });
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Brown" } });
    fireEvent.change(selects[selects.length - 1], { target: { value: "Eng" } });

    fireEvent.click(screen.getByText(/Create Employee Profile/i));
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled());
  });

  it("disables create when no departments exist", async () => {
    mocks.getDepartmentNames.mockResolvedValueOnce([]);
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Add Employee"));
    expect(screen.getByText(/No departments found/i)).toBeInTheDocument();
    const createBtn = screen.getByText("Create Departments First").closest("button");
    expect(createBtn).toBeDisabled();
  });

  it("creates employee through no-skills branch and shows success modal", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Add Employee"));

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 2], { target: { value: "u2" } });
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "No" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Skill" } });
    fireEvent.change(selects[selects.length - 1], { target: { value: "Eng" } });

    fireEvent.click(screen.getByText(/Create Employee Profile/i));
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Employee Created!/i)).toBeInTheDocument());
  });

  it("shows empty state when paginated employees response is empty", async () => {
    mocks.getAllPaginated.mockResolvedValueOnce({ content: [], totalPages: 1, totalElements: 0 });
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/No employees found/i)).toBeInTheDocument());
  });

  it("saves edit with role change and sends promotion notification", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByTitle("Edit employee"));
    await waitFor(() => expect(screen.getByText("Edit Employee")).toBeInTheDocument());

    const usernameInput = screen.getByDisplayValue("user2");
    fireEvent.change(usernameInput, { target: { value: "user2_new" } });
    fireEvent.change(screen.getByDisplayValue("USER"), { target: { value: "MANAGER" } });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(mocks.createNotification).toHaveBeenCalled());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("role updated"));
    expect(global.fetch).toHaveBeenCalled();
  });
});

