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
    getSkills: vi.fn().mockResolvedValue([]),
  },
  usersAPI: {
    getAll: mocks.getAllUsers,
    getById: mocks.getUserById,
    delete: mocks.deleteUser,
    updateUsername: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  departmentsAPI: {
    getDepartmentNames: mocks.getDepartmentNames,
  },
  notificationsAPI: {
    create: mocks.createNotification,
  },
  getAuthHeaders: vi.fn(() => ({ Authorization: "Bearer t" })),
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
    await screen.findByTitle("Edit employee", {}, { timeout: 2000 });
    fireEvent.click(screen.getByTitle("Edit employee"));
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Error loading employee data"),
        "error",
      ),
      { timeout: 1000 }
    );
  });

  it("shows alert on delete error path", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await screen.findByText("Remove", {}, { timeout: 2000 });
    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText(/Yes, Remove Employee/i));
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting employee"),
        "error",
      ),
      { timeout: 1000 }
    );
  });

  it("creates employee through selected skills branch", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await screen.findByText("Add Employee", {}, { timeout: 2000 });
    fireEvent.click(screen.getByText("Add Employee"));
    fireEvent.click(screen.getByText("MockAddSkill"));

    // Click the custom user dropdown trigger and select the user option
    fireEvent.click(screen.getByText(/Select a User/i));
    fireEvent.click(screen.getByText("user2"));

    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Brown" } });
    
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 1], { target: { value: "Eng" } });

    fireEvent.click(screen.getByText(/Create Employee Profile/i));
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled(), { timeout: 1000 });
  });

  it("disables create when no departments exist", async () => {
    mocks.getDepartmentNames.mockResolvedValueOnce([]);
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await screen.findByText("Add Employee", {}, { timeout: 2000 });
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
    await screen.findByText("Add Employee", {}, { timeout: 2000 });
    fireEvent.click(screen.getByText("Add Employee"));

    // Click the custom user dropdown trigger and select the user option
    fireEvent.click(screen.getByText(/Select a User/i));
    fireEvent.click(screen.getByText("user2"));

    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "No" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Skill" } });
    
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 1], { target: { value: "Eng" } });

    fireEvent.click(screen.getByText(/Create Employee Profile/i));
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled(), { timeout: 1000 });

    // Wait for modal to appear with shorter wait time
    await waitFor(() => screen.getByText(/Employee Created!/i), { timeout: 1000 });
  });

  it("shows empty state when paginated employees response is empty", async () => {
    mocks.getAllPaginated.mockResolvedValueOnce({ content: [], totalPages: 1, totalElements: 0 });
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await screen.findByText(/No employees found/i, {}, { timeout: 2000 });
  });

  it("saves edit with role change and sends promotion notification", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await screen.findByTitle("Edit employee", {}, { timeout: 2000 });
    fireEvent.click(screen.getByTitle("Edit employee"));
    await waitFor(() => expect(screen.getByText("Edit Employee")).toBeInTheDocument(), { timeout: 1000 });

    const usernameInput = screen.getByDisplayValue("user2");
    fireEvent.change(usernameInput, { target: { value: "user2" } });
    const roleSelect = screen.getByDisplayValue("USER");
    fireEvent.change(roleSelect, { target: { value: "MANAGER" } });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(mocks.createNotification).toHaveBeenCalled(), { timeout: 1000 });
    expect((globalThis as any).__showToast).toHaveBeenCalledWith(
      expect.stringContaining("role updated"),
      "success",
    );
  });
});