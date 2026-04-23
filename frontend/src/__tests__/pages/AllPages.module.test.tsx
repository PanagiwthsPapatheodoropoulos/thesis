// @ts-nocheck
import { describe, it, expect } from "vitest";

const pageModules = [
  "../../pages/AIInsightsPage.jsx",
  "../../pages/AssignmentsPage.jsx",
  "../../pages/ChatPage.jsx",
  "../../pages/CompanySetupPage.jsx",
  "../../pages/DashboardPage.jsx",
  "../../pages/DepartmentsPage.jsx",
  "../../pages/EmployeeProfilePage.jsx",
  "../../pages/EmployeesPage.jsx",
  "../../pages/LandingPage.jsx",
  "../../pages/LoginPage.jsx",
  "../../pages/NotificationsPage.jsx",
  "../../pages/ProfilePage.jsx",
  "../../pages/SettingsPage.jsx",
  "../../pages/SignupPage.jsx",
  "../../pages/SuperAdminDashboardPage.jsx",
  "../../pages/TasksPage.jsx",
  "../../pages/TeamsPage.jsx",
  "../../pages/UserDashboardPage.jsx",
  "../../pages/WorkloadPage.jsx",
];

describe("all pages modules", () => {
  it("loads every page module", async () => {
    for (const path of pageModules) {
      const mod = await import(path);
      const exported = mod.default ?? Object.values(mod)[0];
      expect(exported).toBeTruthy();
    }
  });
});

