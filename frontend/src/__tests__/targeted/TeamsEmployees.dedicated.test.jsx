import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllPaginatedTeams: vi.fn(),
  getMyTeams: vi.fn(),
  getAllUsers: vi.fn(),
  getAllEmployees: vi.fn(),
  getAllPaginatedEmployees: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  teamsAPI: {
    getAllPaginated: mocks.getAllPaginatedTeams,
    getMyTeams: mocks.getMyTeams,
    create: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({ members: [] }),
    delete: vi.fn().mockResolvedValue({}),
  },
  usersAPI: {
    getAll: mocks.getAllUsers,
    getById: vi.fn().mockResolvedValue({ role: "EMPLOYEE" }),
    delete: vi.fn().mockResolvedValue({}),
  },
  employeesAPI: {
    getAll: mocks.getAllEmployees,
    getByUserId: vi.fn().mockResolvedValue({}),
    getAllPaginated: mocks.getAllPaginatedEmployees,
    create: vi.fn().mockResolvedValue({ id: "e1" }),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN" } }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {},
  useWebSocket: () => ({ connected: true, ready: true, subscribe: () => () => {} }),
}));

import TeamsPage from "../../pages/TeamsPage.jsx";
import EmployeesPage from "../../pages/EmployeesPage.jsx";

describe("Teams/Employees targeted behavior", () => {
  beforeEach(() => {
    mocks.getAllPaginatedTeams.mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 });
    mocks.getMyTeams.mockResolvedValue([]);
    mocks.getAllUsers.mockResolvedValue([]);
    mocks.getAllEmployees.mockResolvedValue([]);
    mocks.getAllPaginatedEmployees.mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 });
  });

  it("TeamsPage fetches list sources", async () => {
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginatedTeams).toHaveBeenCalled());
    expect(mocks.getAllUsers).toHaveBeenCalled();
  });

  it("EmployeesPage fetches paginated employees and users", async () => {
    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginatedEmployees).toHaveBeenCalled());
    expect(mocks.getAllUsers).toHaveBeenCalled();
  });
});

