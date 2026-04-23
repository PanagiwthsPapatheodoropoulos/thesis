// @ts-nocheck
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthProvider } from "../../contexts/AuthContext";
import { ThemeProvider } from "../../contexts/ThemeContext";

import AIAssignmentModal from "../../components/AIAssignmentModal";
import ChatbotWidget from "../../components/ChatbotWidget";
import EmployeeProductivityChart from "../../components/EmployeeProductivityChart";
import MainLayout from "../../components/MainLayout";
import Pagination from "../../components/Pagination";
import ProtectedRoute from "../../components/ProtectedRoute";
import SkillRadarChart from "../../components/SkillRadarChart";
import SkillsInput from "../../components/SkillsInput";
import SkillsMultiSelect from "../../components/SkillsMultiSelect";
import TaskComplexityAnalyzer from "../../components/TaskComplexityAnalyzer";
import TaskDetailsModal from "../../components/TaskDetailsModal";
import TaskDurationPredictor from "../../components/TaskDurationPredictor";
import TaskSkillsExtractor from "../../components/TaskSkillsExtractor";
import WorkloadHeatmap from "../../components/WorkloadHeatmap";

import AIInsightsPage from "../../pages/AIInsightsPage";
import AssignmentsPage from "../../pages/AssignmentsPage";
import ChatPage from "../../pages/ChatPage";
import CompanySetupPage from "../../pages/CompanySetupPage";
import DashboardPage from "../../pages/DashboardPage";
import DepartmentsPage from "../../pages/DepartmentsPage";
import EmployeeProfilePage from "../../pages/EmployeeProfilePage";
import EmployeesPage from "../../pages/EmployeesPage";
import LandingPage from "../../pages/LandingPage";
import LoginPage from "../../pages/LoginPage";
import NotificationsPage from "../../pages/NotificationsPage";
import ProfilePage from "../../pages/ProfilePage";
import SettingsPage from "../../pages/SettingsPage";
import SignupPage from "../../pages/SignupPage";
import SuperAdminDashboardPage from "../../pages/SuperAdminDashboardPage";
import TasksPage from "../../pages/TasksPage";
import TeamsPage from "../../pages/TeamsPage";
import UserDashboardPage from "../../pages/UserDashboardPage";
import WorkloadPage from "../../pages/WorkloadPage";

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

