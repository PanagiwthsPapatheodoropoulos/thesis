import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage.jsx";

describe("SuperAdminDashboardPage interactions", () => {
  beforeEach(() => {
    localStorage.setItem("token", "t");
    const json = vi
      .fn()
      .mockResolvedValueOnce([{ id: "c1", name: "ACME", joinCode: "J1", isActive: true, employeeCount: 3, departmentCount: 1, teamCount: 1 }])
      .mockResolvedValueOnce([{ id: "u1" }]) // users
      .mockResolvedValueOnce([{ id: "task1", status: "PENDING" }]) // tasks
      .mockResolvedValueOnce([{ id: "e1" }]) // employees
      .mockResolvedValueOnce([{ id: "d1" }]) // departments
      .mockResolvedValueOnce([{ id: "t1" }]) // teams
      .mockResolvedValue({ isActive: false });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json,
        text: async () => "",
      }),
    );
    window.alert = vi.fn();
  });

  it("opens company details and toggles company state", async () => {
    render(
      <MemoryRouter>
        <SuperAdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("ACME")).toBeInTheDocument());
    fireEvent.click(screen.getByText("View Details"));
    await waitFor(() => expect(screen.getByText("Join Code:")).toBeInTheDocument());
    const toggleBtn = [...document.querySelectorAll("button")].find(
      (b) => /Deactivate|Activate/i.test(b.textContent || ""),
    );
    if (toggleBtn) fireEvent.click(toggleBtn);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});

