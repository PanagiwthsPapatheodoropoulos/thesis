import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

function renderAt(route, element) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>{element}</Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("../../contexts/AuthContext");
  });

  it("shows a loading screen while auth is not ready", async () => {
    vi.doMock("../../contexts/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: true, authReady: false }),
    }));
    const { default: ProtectedRoute } = await import("../../components/ProtectedRoute.jsx");

    renderAt(
      "/private",
      <Route
        path="/private"
        element={
          <ProtectedRoute>
            <div>PRIVATE</div>
          </ProtectedRoute>
        }
      />,
    );

    expect(screen.getByText("Verifying session...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to /login", async () => {
    vi.doMock("../../contexts/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false, authReady: true }),
    }));
    const { default: ProtectedRoute } = await import("../../components/ProtectedRoute.jsx");

    renderAt(
      "/private",
      <>
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>PRIVATE</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>LOGIN</div>} />
      </>,
    );

    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  it("redirects when role is not allowed", async () => {
    vi.doMock("../../contexts/AuthContext", () => ({
      useAuth: () => ({ user: { role: "EMPLOYEE" }, loading: false, authReady: true }),
    }));
    const { default: ProtectedRoute } = await import("../../components/ProtectedRoute.jsx");

    renderAt(
      "/private",
      <>
        <Route
          path="/private"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <div>PRIVATE</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </>,
    );

    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
  });

  it("renders children when authenticated and role is allowed", async () => {
    vi.doMock("../../contexts/AuthContext", () => ({
      useAuth: () => ({ user: { role: "ADMIN" }, loading: false, authReady: true }),
    }));
    const { default: ProtectedRoute } = await import("../../components/ProtectedRoute.jsx");

    renderAt(
      "/private",
      <Route
        path="/private"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <div>PRIVATE</div>
          </ProtectedRoute>
        }
      />,
    );

    expect(screen.getByText("PRIVATE")).toBeInTheDocument();
  });
});

