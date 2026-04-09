import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  usersAPI: {
    getAll: mocks.getAll,
    getById: mocks.getById,
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("react-router-dom", async (orig) => {
  const mod = await orig();
  return { ...mod, useNavigate: () => vi.fn() };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "ADMIN", username: "user", email: "u@x.com" },
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import SettingsPage from "../../pages/SettingsPage.jsx";

describe("SettingsPage behavior", () => {
  beforeEach(() => {
    mocks.getAll.mockResolvedValue([{ role: "ADMIN" }, { role: "MANAGER" }]);
    mocks.getById.mockResolvedValue({ teamId: null, teamName: null });
  });

  it("loads role counts and user team info", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    expect(mocks.getById).toHaveBeenCalled();
  });

  it("switches tabs in settings UI", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    const securityTab = screen.getByText("Security");
    fireEvent.click(securityTab);
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("shows validation alert when password confirmation mismatches", async () => {
    window.alert = vi.fn();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Security"));

    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: "current123" } });
    fireEvent.change(inputs[1], { target: { value: "new12345" } });
    fireEvent.change(inputs[2], { target: { value: "different" } });
    fireEvent.click(screen.getByText("Update Password"));

    expect(window.alert).toHaveBeenCalledWith("Passwords do not match!");
  });

  it("saves preferences to localStorage", async () => {
    window.alert = vi.fn();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Preferences"));
    fireEvent.click(screen.getByText("Save Preferences"));

    expect(localStorage.getItem("language")).toBeTruthy();
    expect(localStorage.getItem("timezone")).toBeTruthy();
  });

  it("shows validation alert when new password is too short", async () => {
    window.alert = vi.fn();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Security"));
    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: "current123" } });
    fireEvent.change(inputs[1], { target: { value: "short" } });
    fireEvent.change(inputs[2], { target: { value: "short" } });
    fireEvent.click(screen.getByText("Update Password"));
    expect(window.alert).toHaveBeenCalledWith("Password must be at least 8 characters!");
  });

  it("saves notification settings to local storage", async () => {
    window.alert = vi.fn();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Notifications"));
    fireEvent.click(screen.getByText("Save Notification Settings"));
    expect(localStorage.getItem("notificationPrefs")).toBeTruthy();
  });
});

