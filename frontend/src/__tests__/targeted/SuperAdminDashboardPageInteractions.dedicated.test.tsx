// @ts-nocheck
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

import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage";

describe("SuperAdminDashboardPage interactions", () => {
  beforeEach(() => {
    localStorage.setItem("token", "t");
    const json = vi
      .fn()
      .mockResolvedValueOnce([{ id: "c1", name: "ACME", joinCode: "J1", employeeCount: 3, departmentCount: 1, teamCount: 1 }])
      .mockResolvedValueOnce([{ id: "u1" }]) // users
      .mockResolvedValueOnce([{ id: "task1", status: "PENDING" }]) // tasks
      .mockResolvedValueOnce([{ id: "e1" }]) // employees
      .mockResolvedValueOnce([{ id: "d1" }]) // departments
      .mockResolvedValueOnce([{ id: "t1" }]); // teams

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

  it("opens company details and verifies key elements", async () => {
    render(
      <MemoryRouter>
        <SuperAdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("ACME")).toBeInTheDocument());
    fireEvent.click(screen.getByText("View Details"));
    await waitFor(() => expect(screen.getByText("Join Code:")).toBeInTheDocument());
  });
});
