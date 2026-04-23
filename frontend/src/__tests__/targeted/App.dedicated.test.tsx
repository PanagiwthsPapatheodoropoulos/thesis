// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const authState = vi.hoisted(() => ({
  user: null,
  loading: false,
  authReady: true,
}));

vi.mock("../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock("../../contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }) => <>{children}</>,
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  WebSocketProvider: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/MainLayout", () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock("../../components/ChatbotWidget", () => ({
  default: () => <div>ChatbotWidget</div>,
}));

vi.mock("../../pages/LoginPage", () => ({ default: () => <div>LoginPage</div> }));
vi.mock("../../pages/SignupPage", () => ({ default: () => <div>SignupPage</div> }));
vi.mock("../../pages/LandingPage", () => ({ default: () => <div>LandingPage</div> }));
vi.mock("../../pages/DashboardPage", () => ({ default: () => <div>DashboardPage</div> }));
vi.mock("../../pages/UserDashboardPage", () => ({ default: () => <div>UserDashboardPage</div> }));
vi.mock("../../pages/TasksPage", () => ({ default: () => <div>TasksPage</div> }));
vi.mock("../../pages/EmployeesPage", () => ({ default: () => <div>EmployeesPage</div> }));
vi.mock("../../pages/DepartmentsPage", () => ({ default: () => <div>DepartmentsPage</div> }));
vi.mock("../../pages/TeamsPage", () => ({ default: () => <div>TeamsPage</div> }));
vi.mock("../../pages/AssignmentsPage", () => ({ default: () => <div>AssignmentsPage</div> }));
vi.mock("../../pages/NotificationsPage", () => ({ default: () => <div>NotificationsPage</div> }));
vi.mock("../../pages/SettingsPage", () => ({ default: () => <div>SettingsPage</div> }));
vi.mock("../../pages/ProfilePage", () => ({ default: () => <div>ProfilePage</div> }));
vi.mock("../../pages/ChatPage", () => ({ default: () => <div>ChatPage</div> }));
vi.mock("../../pages/EmployeeProfilePage", () => ({ default: () => <div>EmployeeProfilePage</div> }));
vi.mock("../../pages/WorkloadPage", () => ({ default: () => <div>WorkloadPage</div> }));
vi.mock("../../pages/CompanySetupPage", () => ({ default: () => <div>CompanySetupPage</div> }));
vi.mock("../../pages/AIInsightsPage", () => ({ default: () => <div>AIInsightsPage</div> }));
vi.mock("../../pages/SuperAdminDashboardPage", () => ({ default: () => <div>SuperAdminDashboardPage</div> }));

import App from "../../App";

describe("App dedicated route branches", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.authReady = true;
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows verifying session spinner when auth not ready", () => {
    authState.loading = true;
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(screen.getByText(/Verifying session/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated protected route to login", async () => {
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    await waitFor(() => expect(screen.getByText("LoginPage")).toBeInTheDocument());
  });

  it("renders user dashboard route for USER role inside layout", async () => {
    authState.user = { id: "u1", role: "USER" };
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    await waitFor(() => expect(screen.getByText("UserDashboardPage")).toBeInTheDocument());
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  });

  it("redirects super admin dashboard route and hides chatbot", async () => {
    authState.user = { id: "u1", role: "SUPER_ADMIN" };
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    await waitFor(() => expect(screen.getByText("SuperAdminDashboardPage")).toBeInTheDocument());
    expect(screen.queryByText("ChatbotWidget")).not.toBeInTheDocument();
  });

  it("redirects disallowed ai insights access to dashboard", async () => {
    authState.user = { id: "u1", role: "EMPLOYEE" };
    window.history.pushState({}, "", "/ai-insights");
    render(<App />);
    await waitFor(() => expect(screen.getByText("DashboardPage")).toBeInTheDocument());
  });

  it("clears local storage on landing without user or active session", async () => {
    const clearSpy = vi.spyOn(Storage.prototype, "clear");
    window.history.pushState({}, "", "/");
    render(<App />);
    await waitFor(() => expect(screen.getByText("LandingPage")).toBeInTheDocument());
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
