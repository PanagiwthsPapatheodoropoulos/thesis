// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllPaginated: vi.fn(),
  getDepartmentNames: vi.fn(),
  getAllUsers: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  getUserById: vi.fn(),
  createNotification: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: {
    getAllPaginated: mocks.getAllPaginated,
    create: mocks.createEmployee,
    update: mocks.updateEmployee,
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
vi.mock("../../components/SkillsInput", () => ({ default: () => <div>SkillsInput</div> }));

import EmployeesPage from "../../pages/EmployeesPage";

describe("EmployeesPage interactions", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    mocks.getAllPaginated.mockResolvedValue({
      content: [{ id: "e1", userId: "u2", firstName: "A", lastName: "B", position: "Dev", department: "Eng", skills: [] }],
      totalPages: 1,
      totalElements: 1,
    });
    mocks.getDepartmentNames.mockResolvedValue(["Eng"]);
    mocks.getAllUsers.mockResolvedValue([{ id: "u2", role: "USER", companyId: "c1", username: "user2" }]);
    mocks.getUserById.mockResolvedValue({ id: "u2", username: "user2", role: "USER" });
    mocks.createEmployee.mockResolvedValue({ id: "e2" });
    mocks.updateEmployee.mockResolvedValue({});
    mocks.createNotification.mockResolvedValue({});
    mocks.deleteUser.mockResolvedValue({});
  });

  it("loads employees and opens add employee modal", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText(/search employees/i), { target: { value: "A" } });
    fireEvent.click(screen.getByText("Add Employee"));
    expect(screen.getByText("Add New Employee")).toBeInTheDocument();
  });

  it("opens remove modal and confirms employee deletion", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Remove"));
    expect(screen.getByText("Remove Employee")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Yes, Remove Employee/i));
    await waitFor(() => expect(mocks.deleteUser).toHaveBeenCalledWith("u2"));
  });

  it("opens edit flow and loads user profile for selected employee", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByTitle("Edit employee"));
    await waitFor(() => expect(mocks.getUserById).toHaveBeenCalledWith("u2"));
    await waitFor(() => expect(mocks.getUserById).toHaveBeenCalledTimes(1));
  });

  it("opens create modal and creates employee profile", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Add Employee"));
    await waitFor(() => expect(screen.getByText("Add New Employee")).toBeInTheDocument());
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[selects.length - 2], { target: { value: "u2" } });
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Brown" } });
    fireEvent.change(selects[selects.length - 1], { target: { value: "Eng" } });
    const createBtn = screen.getByText(/Create Employee Profile/i);
    fireEvent.click(createBtn);
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalled());
  });
});

