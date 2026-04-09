import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getByUserId: vi.fn(),
  update: vi.fn(),
  getSkills: vi.fn(),
  usersGetById: vi.fn(),
  usersUpdate: vi.fn(),
  incrementVersion: vi.fn(() => 1),
  authUser: { id: "u1", username: "testuser", email: "test@x.com", role: "EMPLOYEE" },
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  usersAPI: { getById: mocks.usersGetById, update: mocks.usersUpdate },
  employeesAPI: { getByUserId: mocks.getByUserId, update: mocks.update, getSkills: mocks.getSkills },
  incrementProfileImageVersion: mocks.incrementVersion,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.authUser, login: mocks.login, logout: mocks.logout }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

vi.mock("../../components/SkillsInput", () => ({ default: () => <div>SkillsInput</div> }));
vi.mock("../../components/SkillRadarChart", () => ({ default: () => <div>SkillRadarChart</div> }));
vi.mock("../../components/EmployeeProductivityChart", () => ({ default: () => <div>ProductivityChart</div> }));

import ProfilePage from "../../pages/ProfilePage.jsx";

describe("ProfilePage coverage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.dispatchEvent = vi.fn();
    mocks.usersGetById.mockResolvedValue({ id: "u1", email: "test@x.com", username: "testuser", role: "EMPLOYEE", companyName: "Acme" });
    mocks.getByUserId.mockResolvedValue({
      id: "e1", userId: "u1", firstName: "John", lastName: "Doe",
      position: "Dev", department: "Engineering", profileImageUrl: null,
      skills: [{ id: "s1", skillName: "React", proficiencyLevel: 4 }],
    });
    mocks.getSkills.mockResolvedValue([{ id: "s1", skillName: "React", proficiencyLevel: 4 }]);
    mocks.update.mockResolvedValue({});
    mocks.usersUpdate.mockResolvedValue({});
  });

  it("renders profile form with user and employee data", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());
    expect(screen.getByDisplayValue("test@x.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
  });

  it("renders without employee profile", async () => {
    mocks.getByUserId.mockRejectedValue(new Error("no profile"));
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());
    expect(screen.getByText(/No employee profile/i)).toBeInTheDocument();
  });

  it("shows active employee profile status", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());
    expect(screen.getByText(/active employee profile/i)).toBeInTheDocument();
  });

  it("shows skills section and charts when employee has skills", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    expect(screen.getByText("SkillsInput")).toBeInTheDocument();
    expect(screen.getByText("SkillRadarChart")).toBeInTheDocument();
    expect(screen.getByText("ProductivityChart")).toBeInTheDocument();
  });

  it("updates email and saves profile", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("test@x.com"), { target: { value: "new@x.com" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(mocks.usersUpdate).toHaveBeenCalledWith("u1", { email: "new@x.com" }));
  });

  it("shows warning when username is changed", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("testuser"), { target: { value: "newuser" } });
    expect(screen.getByText(/Changing your username will log you out/i)).toBeInTheDocument();
  });

  it("refresh button calls fetchProfile", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalledTimes(2));
  });

  it("displays company info as read-only", async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(mocks.usersGetById).toHaveBeenCalled());
    expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
  });
});
