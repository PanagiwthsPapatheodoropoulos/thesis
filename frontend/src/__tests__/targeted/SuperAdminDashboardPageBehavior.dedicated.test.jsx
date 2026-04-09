import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage.jsx";

describe("SuperAdminDashboardPage behavior", () => {
  beforeEach(() => {
    localStorage.setItem("token", "t");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [{ id: "c1", name: "ACME", joinCode: "J1", isActive: true, employeeCount: 3 }],
        text: async () => "",
        status: 200,
      }),
    );
    window.alert = vi.fn();
  });

  it("loads companies on mount", async () => {
    render(
      <MemoryRouter>
        <SuperAdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});

