import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllPaginated: vi.fn(),
  getAllUsers: vi.fn(),
  getAllEmployees: vi.fn(),
  createTeam: vi.fn(),
  getTeamById: vi.fn(),
  deleteTeam: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  teamsAPI: {
    getAllPaginated: mocks.getAllPaginated,
    getMyTeams: vi.fn().mockResolvedValue([]),
    create: mocks.createTeam,
    getById: mocks.getTeamById,
    delete: mocks.deleteTeam,
  },
  usersAPI: {
    getAll: mocks.getAllUsers,
  },
  employeesAPI: {
    getAll: mocks.getAllEmployees,
    getByUserId: vi.fn().mockResolvedValue({}),
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

describe("TeamsPage file-specific interactions", () => {
  beforeEach(() => {
    window.confirm = vi.fn(() => true);
    mocks.getAllPaginated.mockResolvedValue({ content: [{ id: "t1", name: "Team A", memberCount: 0 }], totalElements: 1, totalPages: 1 });
    mocks.getAllUsers.mockResolvedValue([{ id: "u1", teamId: "t1" }]);
    mocks.getAllEmployees.mockResolvedValue([]);
    mocks.createTeam.mockResolvedValue({ id: "t2", name: "Created Team" });
    mocks.getTeamById.mockResolvedValue({ id: "t1", name: "Team A", members: [] });
    mocks.deleteTeam.mockResolvedValue({});
  });

  it("searches, opens create modal and submits create team", async () => {
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText(/search teams/i), { target: { value: "Team" } });
    fireEvent.click(screen.getByText("New Team"));
    const nameInput = document.querySelectorAll('input[type="text"]')[1] || document.querySelectorAll('input[type="text"]')[0];
    fireEvent.change(nameInput, { target: { value: "Created Team" } });
    fireEvent.submit(nameInput.closest("form"));

    await waitFor(() => expect(mocks.createTeam).toHaveBeenCalled());
  });

  it("opens team details from team card", async () => {
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/View Details/i));
    await waitFor(() => expect(mocks.getTeamById).toHaveBeenCalledWith("t1"));
  });
});

