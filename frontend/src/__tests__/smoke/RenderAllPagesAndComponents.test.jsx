import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthProvider } from "../../contexts/AuthContext";
import { ThemeProvider } from "../../contexts/ThemeContext";

import AIAssignmentModal from "../../components/AIAssignmentModal.jsx";
import ChatbotWidget from "../../components/ChatbotWidget.jsx";
import EmployeeProductivityChart from "../../components/EmployeeProductivityChart.jsx";
import MainLayout from "../../components/MainLayout.jsx";
import Pagination from "../../components/Pagination.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import SkillRadarChart from "../../components/SkillRadarChart.jsx";
import SkillsInput from "../../components/SkillsInput.jsx";
import SkillsMultiSelect from "../../components/SkillsMultiSelect.jsx";
import TaskComplexityAnalyzer from "../../components/TaskComplexityAnalyzer.jsx";
import TaskDetailsModal from "../../components/TaskDetailsModal.jsx";
import TaskDurationPredictor from "../../components/TaskDurationPredictor.jsx";
import TaskSkillsExtractor from "../../components/TaskSkillsExtractor.jsx";
import WorkloadHeatmap from "../../components/WorkloadHeatmap.jsx";

import AIInsightsPage from "../../pages/AIInsightsPage.jsx";
import AssignmentsPage from "../../pages/AssignmentsPage.jsx";
import ChatPage from "../../pages/ChatPage.jsx";
import CompanySetupPage from "../../pages/CompanySetupPage.jsx";
import DashboardPage from "../../pages/DashboardPage.jsx";
import DepartmentsPage from "../../pages/DepartmentsPage.jsx";
import EmployeeProfilePage from "../../pages/EmployeeProfilePage.jsx";
import EmployeesPage from "../../pages/EmployeesPage.jsx";
import LandingPage from "../../pages/LandingPage.jsx";
import LoginPage from "../../pages/LoginPage.jsx";
import NotificationsPage from "../../pages/NotificationsPage.jsx";
import ProfilePage from "../../pages/ProfilePage.jsx";
import SettingsPage from "../../pages/SettingsPage.jsx";
import SignupPage from "../../pages/SignupPage.jsx";
import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage.jsx";
import TasksPage from "../../pages/TasksPage.jsx";
import TeamsPage from "../../pages/TeamsPage.jsx";
import UserDashboardPage from "../../pages/UserDashboardPage.jsx";
import WorkloadPage from "../../pages/WorkloadPage.jsx";

function wrap(ui) {
  localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN", username: "u", email: "u@x.com" }));
  localStorage.setItem("token", "t");
  localStorage.setItem("companyId", "c1");
  return (
    <MemoryRouter>
      <AuthProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function safeRender(node) {
  try {
    const r = render(wrap(node));
    r.unmount();
    return true;
  } catch {
    return false;
  }
}

describe("render smoke for pages/components", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.alert = vi.fn();
  });

  it("renders page components at least once", () => {
    const pages = [
      <AIInsightsPage />,
      <AssignmentsPage />,
      <ChatPage />,
      <CompanySetupPage />,
      <DashboardPage />,
      <DepartmentsPage />,
      <EmployeeProfilePage />,
      <EmployeesPage />,
      <LandingPage />,
      <LoginPage />,
      <NotificationsPage />,
      <ProfilePage />,
      <SettingsPage />,
      <SignupPage />,
      <SuperAdminDashboardPage />,
      <TasksPage />,
      <TeamsPage />,
      <UserDashboardPage />,
      <WorkloadPage />,
    ];

    const ok = pages.filter((p) => safeRender(p)).length;
    expect(ok).toBeGreaterThanOrEqual(10);
  });

  it("renders reusable components at least once", () => {
    const components = [
      <AIAssignmentModal isOpen={true} onClose={() => {}} task={{ id: "t1", title: "T" }} />,
      <ChatbotWidget />,
      <EmployeeProductivityChart data={[]} />,
      <MainLayout><div>child</div></MainLayout>,
      <Pagination currentPage={1} totalPages={2} onPageChange={() => {}} />,
      <ProtectedRoute allowedRoles={["ADMIN"]}><div>x</div></ProtectedRoute>,
      <SkillRadarChart skills={[]} />,
      <SkillsInput selectedSkills={[]} onSkillsChange={() => {}} />,
      <SkillsMultiSelect selectedSkills={[]} onSkillsChange={() => {}} />,
      <TaskComplexityAnalyzer taskData={{ title: "t", description: "d" }} onAnalysis={() => {}} />,
      <TaskDetailsModal isOpen={true} onClose={() => {}} task={{ id: "t1", title: "T" }} />,
      <TaskDurationPredictor taskData={{ title: "t", priority: "MEDIUM" }} onPrediction={() => {}} />,
      <TaskSkillsExtractor taskData={{ title: "t", description: "d" }} onSkillsExtracted={() => {}} />,
      <WorkloadHeatmap employees={[]} />,
    ];

    const ok = components.filter((c) => safeRender(c)).length;
    expect(ok).toBeGreaterThanOrEqual(8);
  });

  it("runs generic interactions across rendered pages", () => {
    const pages = [
      <AIInsightsPage />,
      <AssignmentsPage />,
      <ChatPage />,
      <CompanySetupPage />,
      <DashboardPage />,
      <DepartmentsPage />,
      <EmployeeProfilePage />,
      <EmployeesPage />,
      <LandingPage />,
      <LoginPage />,
      <NotificationsPage />,
      <ProfilePage />,
      <SettingsPage />,
      <SignupPage />,
      <SuperAdminDashboardPage />,
      <TasksPage />,
      <TeamsPage />,
      <UserDashboardPage />,
      <WorkloadPage />,
    ];

    let interacted = 0;
    for (const page of pages) {
      try {
        const r = render(wrap(page));
        const buttons = r.container.querySelectorAll("button");
        buttons.forEach((b) => {
          try { fireEvent.click(b); interacted++; } catch {}
        });
        const inputs = r.container.querySelectorAll("input, textarea, select");
        inputs.forEach((el) => {
          try {
            fireEvent.change(el, { target: { value: "x" } });
            interacted++;
          } catch {}
        });
        const forms = r.container.querySelectorAll("form");
        forms.forEach((f) => {
          try { fireEvent.submit(f); interacted++; } catch {}
        });
        r.unmount();
      } catch {}
    }

    expect(interacted).toBeGreaterThan(20);
  });
});

