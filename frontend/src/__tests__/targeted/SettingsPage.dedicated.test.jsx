import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  logout: vi.fn(),
  updateAuthUser: vi.fn(),
  mockUser: { id: "u1", username: "john", email: "john@x.com", role: "ADMIN", companyName: "Acme" } // Προσθήκη
}));

vi.mock("../../utils/api", () => ({
  usersAPI: {
    getAll: mocks.getAllUsers,
    getById: mocks.getUserById,
    update: mocks.updateUser,
    delete: mocks.deleteUser,
  },
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.mockUser, // Τώρα επιστρέφει πάντα το ΊΔΙΟ αντικείμενο
    logout: mocks.logout,
    updateUser: mocks.updateAuthUser,
  }),
}));
vi.mock("../../contexts/ThemeContext", () => ({ useTheme: () => ({ darkMode: true }) }));

import SettingsPage from "../../pages/SettingsPage.jsx";

describe("SettingsPage dedicated", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    mocks.getAllUsers.mockResolvedValue([{ role: "ADMIN" }, { role: "MANAGER" }, { role: "MANAGER" }]);
    mocks.getUserById.mockResolvedValue({ teamId: null, teamName: null });
    mocks.updateUser.mockResolvedValue({});
    mocks.deleteUser.mockResolvedValue({});
    localStorage.setItem("token", "t1");
  });

  it("updates email-only profile and calls auth updater", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    const emailInput = screen.getByDisplayValue("john@x.com");
    fireEvent.change(emailInput, { target: { value: "new@x.com" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalled());
    expect(mocks.updateAuthUser).toHaveBeenCalled();
  });

  it("shows last-admin guard and disables delete action", async () => {
    mocks.getAllUsers.mockResolvedValueOnce([{ role: "ADMIN" }]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Security"));
    expect(screen.getByText(/You are the only administrator/i)).toBeInTheDocument();
    const deleteBtn = screen.getByText("Delete My Account").closest("button");
    expect(deleteBtn).toBeDisabled();
  });

  it("shows validation alert when passwords do not match", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Security"));
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordInputs[0], { target: { value: "oldpass123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "newpass123" } });
    fireEvent.change(passwordInputs[2], { target: { value: "different123" } });
    fireEvent.click(screen.getByText("Update Password"));
    expect(window.alert).toHaveBeenCalledWith("Passwords do not match!");
  });

  it("saves notification preferences with server fallback alert on failure", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Notifications"));
    fireEvent.click(screen.getByText("Save Notification Settings"));
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Saved locally")),
    );
  });

  it("updates username and forces logout flow", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, text: async () => "" });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    const usernameInput = screen.getByDisplayValue("john");
    fireEvent.change(usernameInput, { target: { value: "john_new" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Username updated"));
  });

  it("leaves team from leave-team modal flow", async () => {
    mocks.getUserById.mockResolvedValueOnce({ teamId: "t1", teamName: "Core Team" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getUserById).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Leave Team"));
    const leaveButtons = screen.getAllByText("Leave Team", { selector: "button" });
    fireEvent.click(leaveButtons[leaveButtons.length - 1]);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/teams/t1/members/u1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("deletes account through confirmation modal", async () => {
    // ΠΡΟΣΘΗΚΗ: Βάζουμε 2 admins για να μην μπλοκάρει το delete button!
    mocks.getAllUsers.mockResolvedValueOnce([{ role: "ADMIN" }, { role: "ADMIN" }]);
    mocks.getUserById.mockResolvedValueOnce({ teamId: null, teamName: null });
    
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.getAllUsers).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Security"));
    const deleteButton = screen.getByText("Delete My Account").closest("button");
    await waitFor(() => expect(deleteButton).not.toBeDisabled());
    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByText("Yes, Delete My Account"));
    
    await waitFor(() => expect(mocks.deleteUser).toHaveBeenCalledWith("u1"));
  });
});

