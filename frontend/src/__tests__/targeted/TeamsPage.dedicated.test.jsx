import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeamsPage from "../../pages/TeamsPage.jsx";

const mocks = vi.hoisted(() => ({
  getByUserId: vi.fn(),
  getAllPaginated: vi.fn(),
  getAllUsers: vi.fn(),
  getAllEmployees: vi.fn(),
  createTeam: vi.fn(),
  getTeamById: vi.fn(),
  deleteTeam: vi.fn(),
  authUser: { id: "u1", role: "ADMIN", companyId: "c1" },
}));

vi.mock("../../utils/api", async () => {
  const actual = await vi.importActual("../../utils/api");
  return {
    ...actual,
    teamsAPI: {
      getAllPaginated: mocks.getAllPaginated,
      getMyTeams: vi.fn().mockResolvedValue([]),
      create: mocks.createTeam,
      getById: mocks.getTeamById,
      delete: mocks.deleteTeam,
    },
    usersAPI: { getAll: mocks.getAllUsers },
    employeesAPI: { getByUserId: mocks.getByUserId, getAll: mocks.getAllEmployees },
    getProfileImageUrl: (u) => u,
  };
});

vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: true }) }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { PROFILE_UPDATED: "PROFILE_UPDATED" },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: () => () => {} }),
}));

describe("TeamsPage dedicated", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    mocks.authUser = { id: "u1", role: "ADMIN", companyId: "c1" };
    mocks.getByUserId.mockResolvedValue({ id: "e1" });
    mocks.getAllPaginated.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0 });
    mocks.getAllUsers.mockResolvedValue([]);
    mocks.getAllEmployees.mockResolvedValue([]);
    mocks.createTeam.mockResolvedValue({ id: "t2" });
    mocks.getTeamById.mockResolvedValue({ id: "t1", name: "Team 1", members: [] });
    mocks.deleteTeam.mockResolvedValue({});
  });

  it("shows employee profile required for plain user without profile", async () => {
    mocks.getByUserId.mockRejectedValueOnce(new Error("no profile"));
    mocks.authUser = { id: "u1", role: "USER", companyId: "c1" };
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/Employee Profile Required/i)).toBeInTheDocument());
  });

  it("shows alert on create team failure", async () => {
    mocks.createTeam.mockRejectedValueOnce(new Error("create failed"));
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("New Team"));
    const nameInput = document.querySelector('input[type="text"][required]');
    if (nameInput) fireEvent.change(nameInput, { target: { value: "Backend Team" } });
    fireEvent.click(screen.getByText("Create Team"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Error creating team")));
  });

  it("renders no-available-employees message in add member modal", async () => {
    mocks.getAllPaginated.mockResolvedValueOnce({
      content: [{ id: "t1", name: "Team 1", description: "D1", memberCount: 0 }],
      totalPages: 1,
      totalElements: 1,
    });
    mocks.getTeamById.mockResolvedValueOnce({ id: "t1", name: "Team 1", members: [] });
    mocks.getAllUsers.mockResolvedValueOnce([{ id: "u1", username: "admin", email: "a@x.com", teamId: null }]);
    mocks.getAllEmployees.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("View Details"));
    await waitFor(() => expect(screen.getByText("Add Member")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Add Member"));
    expect(screen.getByText(/No available employees to add/i)).toBeInTheDocument();
  });

  it("confirms and deletes team from cards", async () => {
    mocks.getAllPaginated.mockResolvedValueOnce({
      content: [{ id: "t1", name: "Team 1", description: "D1", memberCount: 0 }],
      totalPages: 1,
      totalElements: 1,
    });
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(mocks.deleteTeam).toHaveBeenCalledWith("t1"));
  });

  it("adds a member through confirmation modal", async () => {
    mocks.getAllPaginated.mockResolvedValue({
      content: [{ id: "t1", name: "Team 1", description: "D1", memberCount: 0 }],
      totalPages: 1,
      totalElements: 1,
    });
    mocks.getTeamById.mockResolvedValue({
      id: "t1",
      name: "Team 1",
      members: [],
    });
    mocks.getAllUsers.mockResolvedValue([
      { id: "u1", username: "admin", email: "a@x.com", teamId: null },
      { id: "u2", username: "john", email: "j@x.com", teamId: null },
    ]);
    mocks.getAllEmployees.mockResolvedValue([{ id: "e2", userId: "u2", profileImageUrl: null }]);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("View Details"));
    await waitFor(() => expect(screen.getByText("Add Member")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Add Member"));
    fireEvent.click(screen.getByText("john"));
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/teams/t1/members/u2",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("removes member from details modal", async () => {
    mocks.getAllPaginated.mockResolvedValue({
      content: [{ id: "t1", name: "Team 1", description: "D1", memberCount: 1 }],
      totalPages: 1,
      totalElements: 1,
    });
    mocks.getTeamById.mockResolvedValue({
      id: "t1",
      name: "Team 1",
      members: [{ userId: "u2", username: "john", email: "j@x.com", role: "EMPLOYEE" }],
    });
    mocks.getAllUsers.mockResolvedValue([
      { id: "u1", username: "admin", email: "a@x.com", teamId: null },
      { id: "u2", username: "john", email: "j@x.com", teamId: "t1" },
    ]);
    mocks.getAllEmployees.mockResolvedValue([{ id: "e2", userId: "u2", profileImageUrl: null }]);

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAllPaginated).toHaveBeenCalled());
    fireEvent.click(screen.getByText("View Details"));
    await waitFor(() => expect(screen.getByText("john")).toBeInTheDocument());

    const removeButtons = document.querySelectorAll("button");
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/teams/t1/members/u2",
      expect.objectContaining({ method: "DELETE" }),
    ));
  });
});

