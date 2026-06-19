// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { usersAPI, companiesAPI, blocklistAPI } from "../../utils/api";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  user: { id: "u1", role: "ADMIN", username: "user", email: "u@x.com" },
  getMyCompany: vi.fn(),
  blocklistGetAll: vi.fn(),
  navigate: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/api", () => ({
  usersAPI: {
    getAll: mocks.getAll,
    getById: mocks.getById,
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  companiesAPI: {
    getMyCompany: mocks.getMyCompany,
    regenerateJoinCode: vi.fn().mockResolvedValue("NEWCODE123"),
  },
  blocklistAPI: {
    getAll: mocks.blocklistGetAll,
    block: vi.fn().mockResolvedValue({}),
    unblock: vi.fn().mockResolvedValue({}),
  },
}));


vi.mock("react-router-dom", async (orig) => {
  const mod = await orig();
  return { ...mod, useNavigate: () => mocks.navigate };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: mocks.logout,
    updateUser: mocks.updateUser,
  }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

vi.mock("../../components/ConfirmDialog", () => ({
  useConfirm: () => mocks.confirm,
}));


import SettingsPage from "../../pages/SettingsPage";

describe("SettingsPage behavior", () => {
  beforeEach(() => {
    mocks.user.role = "ADMIN";
    mocks.getAll.mockResolvedValue([{ role: "ADMIN" }, { role: "MANAGER" }]);
    mocks.getById.mockResolvedValue({ teamId: null, teamName: null });
    mocks.getMyCompany.mockResolvedValue({ id: "c1", joinCode: "ABCDEF1234" });
    mocks.blocklistGetAll.mockResolvedValue([]);
    mocks.confirm.mockResolvedValue(true);
    companiesAPI.regenerateJoinCode.mockResolvedValue("NEWCODE123");
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

    expect((globalThis as any).__showToast).toHaveBeenCalledWith(
      "Passwords do not match!",
      "warning",
    );
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
    expect((globalThis as any).__showToast).toHaveBeenCalledWith(
      "Password must be at least 8 characters!",
      "warning",
    );
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

  it("toggles join code visibility and regenerates join code", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Security"));
    
    // Check code is initially blurred
    const codeContainer = screen.getByText("ABCDEF1234");
    expect(codeContainer).toHaveClass("blur-sm");
    
    // Click show code
    const showCodeBtn = screen.getByTitle("Show code");
    fireEvent.click(showCodeBtn);
    
    // Check code is now unblurred
    expect(codeContainer).not.toHaveClass("blur-sm");
    expect(showCodeBtn).toHaveAttribute("title", "Hide code");
    
    // Click hide code
    fireEvent.click(showCodeBtn);
    expect(codeContainer).toHaveClass("blur-sm");
    
    // Click regenerate
    const regenBtn = screen.getByText("🔄 Regenerate Code");
    await act(async () => {
      fireEvent.click(regenBtn);
    });
    
    expect(mocks.confirm).toHaveBeenCalled();
    
    // Wait for the mock API to be called
    await waitFor(() => {
      expect(companiesAPI.regenerateJoinCode).toHaveBeenCalled();
    });
    
    // Check new code is set and visible (unblurred) automatically
    await waitFor(() => expect(screen.getByText("NEWCODE123")).toBeInTheDocument());
    expect(screen.getByText("NEWCODE123")).not.toHaveClass("blur-sm");
  });

  it("handles blocklist loading, blocking an email, and unblocking an email", async () => {
    mocks.blocklistGetAll.mockResolvedValueOnce([
      { id: "b1", email: "blocked1@example.com", createdAt: "2026-06-17T20:00:00Z" }
    ]);
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Security"));
    
    await waitFor(() => expect(screen.getByText("blocked1@example.com")).toBeInTheDocument());
    
    const emailInput = screen.getByPlaceholderText("email@example.com");
    fireEvent.change(emailInput, { target: { value: "blocked2@example.com" } });
    
    mocks.blocklistGetAll.mockResolvedValueOnce([
      { id: "b1", email: "blocked1@example.com", createdAt: "2026-06-17T20:00:00Z" },
      { id: "b2", email: "blocked2@example.com", createdAt: "2026-06-17T20:01:00Z" }
    ]);
    
    const blockBtn = screen.getByText("Block");
    fireEvent.click(blockBtn);
    
    await waitFor(() => expect(screen.getByText("blocked2@example.com")).toBeInTheDocument());
    
    const unblockBtns = screen.getAllByTitle("Unblock");
    
    mocks.blocklistGetAll.mockResolvedValueOnce([
      { id: "b2", email: "blocked2@example.com", createdAt: "2026-06-17T20:01:00Z" }
    ]);
    fireEvent.click(unblockBtns[0]);
    
    await waitFor(() => expect(screen.queryByText("blocked1@example.com")).not.toBeInTheDocument());
  });

  it("renders legal tab documents, opens legal modal, and redirects to full legal page", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Legal"));
    
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    
    const quickViewBtns = screen.getAllByText("Quick View");
    fireEvent.click(quickViewBtns[0]);
    
    expect(screen.getByText("Read summary here or open the full legal center.")).toBeInTheDocument();
    
    const openFullPageBtns = screen.getAllByText("Open Full Page");
    fireEvent.click(openFullPageBtns[openFullPageBtns.length - 1]);
    
    expect(mocks.navigate).toHaveBeenCalledWith("/legal?doc=terms");
    
    const closeBtn = screen.getByText("Close");
    fireEvent.click(closeBtn);
    
    expect(screen.queryByText("Read summary here or open the full legal center.")).not.toBeInTheDocument();
  });

  it("renders manager count / team warnings in danger zone", async () => {
    mocks.user.role = "MANAGER";
    mocks.getAll.mockResolvedValueOnce([{ role: "MANAGER" }]);
    mocks.getById.mockResolvedValueOnce({ teamId: "t1", teamName: "My Team" });
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Security"));
    
    expect(screen.getByText("You are the only manager")).toBeInTheDocument();
    expect(screen.getByText("You are currently in a team")).toBeInTheDocument();
    expect(screen.getByText("My Team")).toBeInTheDocument();
    
    mocks.user.role = "ADMIN";
  });

  it("handles errors during username update and profile update", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () => "Username already taken",
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    const usernameInput = screen.getByDisplayValue("user");
    fireEvent.change(usernameInput, { target: { value: "new_user" } });
    
    const saveChangesBtn = screen.getByText("Save Changes");
    fireEvent.click(saveChangesBtn);
    
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Username already taken"),
        "error"
      )
    );
    
    fireEvent.change(usernameInput, { target: { value: "user" } });
    
    const emailInput = screen.getByDisplayValue("u@x.com");
    fireEvent.change(emailInput, { target: { value: "new_email@x.com" } });
    
    vi.spyOn(usersAPI, "update").mockRejectedValueOnce(new Error("Email already registered"));
    
    fireEvent.click(saveChangesBtn);
    
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Email already registered"),
        "error"
      )
    );
  });

  it("handles errors during blocklist, unblock, and regenerate code", async () => {
    mocks.blocklistGetAll.mockResolvedValueOnce([
      { id: "b1", email: "blocked1@example.com", createdAt: "2026-06-17T20:00:00Z" }
    ]);
    vi.spyOn(companiesAPI, "regenerateJoinCode").mockRejectedValueOnce(new Error("Regen failed"));
    
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText("Security"));
    
    const regenBtn = screen.getByText("🔄 Regenerate Code");
    fireEvent.click(regenBtn);
    
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Regen failed"),
        "error"
      )
    );
    
    vi.spyOn(blocklistAPI, "block").mockRejectedValueOnce(new Error("Block failed"));
    
    const emailInput = screen.getByPlaceholderText("email@example.com");
    fireEvent.change(emailInput, { target: { value: "blocked@example.com" } });
    
    const blockBtn = screen.getByText("Block");
    fireEvent.click(blockBtn);
    
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Block failed"),
        "error"
      )
    );
    
    await waitFor(() => expect(screen.getByText("blocked1@example.com")).toBeInTheDocument());
    
    vi.spyOn(blocklistAPI, "unblock").mockRejectedValueOnce(new Error("Unblock failed"));
    
    const unblockBtn = screen.getByTitle("Unblock");
    fireEvent.click(unblockBtn);
    
    await waitFor(() =>
      expect((globalThis as any).__showToast).toHaveBeenCalledWith(
        expect.stringContaining("Unblock failed"),
        "error"
      )
    );
  });
});

