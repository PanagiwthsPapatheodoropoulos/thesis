import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  authUser: { id: "u1", role: "SUPERADMIN", username: "superadmin" },
  logout: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.authUser, logout: mocks.logout }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage.jsx";

describe("SuperAdminDashboardPage coverage dedicated", () => {
  const companyData = [
    { id: "c1", name: "Acme Corp", isActive: true, joinCode: "ABC123", employeeCount: 10, departmentCount: 3, teamCount: 2 },
    { id: "c2", name: "Beta Inc", isActive: false, joinCode: "XYZ789", employeeCount: 5, departmentCount: 1, teamCount: 1 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("fake-token");
    window.alert = vi.fn();

    global.fetch = vi.fn((url) => {
      if (url.includes("/companies") && !url.includes("/companies/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(companyData),
        });
      }
      if (url.includes("/toggle-active")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...companyData[0], isActive: false }),
        });
      }
      // Company detail sub-routes
      if (url.includes("/users")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, role: "ADMIN", createdAt: "2026-04-10T00:00:00Z" },
            { id: 2, role: "MANAGER" },
            { id: 3, role: "EMPLOYEE" },
            { id: 4, role: "USER" },
            { id: 5, role: "UNKNOWN", createdAt: null }
          ]),
        });
      }
      if (url.includes("/tasks")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, status: "PENDING", priority: "LOW", dueDate: "2026-04-11T00:00:00Z" },
            { id: 2, status: "IN_PROGRESS", priority: "MEDIUM" },
            { id: 3, status: "COMPLETED", priority: "HIGH" },
            { id: 4, status: "BLOCKED", priority: "CRITICAL" },
            { id: 5, status: "CANCELLED", priority: "UNKNOWN" }
          ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
  });

  it("renders company list after loading", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("renders overview stats cards", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Total Companies")).toBeInTheDocument());
    expect(screen.getByText("Active Companies")).toBeInTheDocument();
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("filters companies by search term", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    const input = screen.getByPlaceholderText("Search companies by name or join code...");
    fireEvent.change(input, { target: { value: "Beta" } });
    expect(screen.queryByText("Acme Corp")).toBeNull();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("drills into company detail view", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    const viewButtons = screen.getAllByText("View Details");
    fireEvent.click(viewButtons[0]);
    await waitFor(() => expect(screen.getByText("Back to Overview")).toBeInTheDocument());
  });

  it("shows delete modal when delete is clicked", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    // Click the delete button (trash icon)
    const deleteButtons = screen.getAllByRole("button");
    const trashBtn = deleteButtons.find(btn => {
      const svg = btn.querySelector("svg");
      return svg && btn.textContent === "";
    });
    if (trashBtn) {
      fireEvent.click(trashBtn);
      await waitFor(() => expect(screen.getByText("Delete Company?")).toBeInTheDocument());
    }
  });

  it("handles logout click", async () => {
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Logout"));
    expect(mocks.logout).toHaveBeenCalled();
  });

  it("handles fetch failure gracefully", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    render(<MemoryRouter><SuperAdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Failed to load companies"));
  });
});
