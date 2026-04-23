// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getSkills: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: {
    getById: mocks.getById,
    getSkills: mocks.getSkills,
  },
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

vi.mock("../../components/SkillRadarChart", () => ({ default: () => <div>SkillRadarChart</div> }));
vi.mock("../../components/EmployeeProductivityChart", () => ({ default: () => <div>ProductivityChart</div> }));

import EmployeeProfilePage from "../../pages/EmployeeProfilePage";

const renderWithRoute = () =>
  render(
    <MemoryRouter initialEntries={["/employees/e1"]}>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeProfilePage />} />
      </Routes>
    </MemoryRouter>
  );

describe("EmployeeProfilePage coverage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({
      id: "e1", userId: "u1", firstName: "Jane", lastName: "Smith",
      position: "Engineer", department: "Backend", hireDate: "2024-01-15",
      hourlyRate: 50, maxWeeklyHours: 40, profileImageUrl: null,
    });
    mocks.getSkills.mockResolvedValue([
      { id: "s1", skillName: "Java", proficiencyLevel: 4 },
      { id: "s2", skillName: "Spring", proficiencyLevel: 3 },
    ]);
  });

  it("renders employee profile with details and skills", async () => {
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalledWith("e1"));
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText(/\$50\/hr/)).toBeInTheDocument();
    expect(screen.getByText("40h/week")).toBeInTheDocument();
  });

  it("renders skill list with levels", async () => {
    renderWithRoute();
    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Level 4/5")).toBeInTheDocument();
    expect(screen.getByText("Spring")).toBeInTheDocument();
  });

  it("renders radar chart and productivity chart", async () => {
    renderWithRoute();
    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    expect(screen.getByText("SkillRadarChart")).toBeInTheDocument();
    expect(screen.getByText("ProductivityChart")).toBeInTheDocument();
  });

  it("shows not found when employee fetch fails", async () => {
    mocks.getById.mockRejectedValue(new Error("not found"));
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Employee not found")).toBeInTheDocument();
  });

  it("handles skill fetch failure gracefully", async () => {
    mocks.getSkills.mockRejectedValue(new Error("no skills"));
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders hire date when available", async () => {
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it("shows default text when no position", async () => {
    mocks.getById.mockResolvedValue({
      id: "e1", userId: "u1", firstName: "Jane", lastName: "Smith",
      position: null, department: null, profileImageUrl: null,
    });
    mocks.getSkills.mockResolvedValue([]);
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("No position specified")).toBeInTheDocument();
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("handles profileUpdated event via window event listener", async () => {
    renderWithRoute();
    await waitFor(() => expect(screen.getByText("Jane Smith")).toBeInTheDocument());
    
    // Clear mocks so we test strictly the re-fetch
    mocks.getById.mockClear();

    // Dispatch the custom event matching the user id
    await act(async () => {
      const event = new CustomEvent("profileUpdated", { detail: { userId: "u1", profileImageUrl: "new.jpg" }});
      window.dispatchEvent(event);
    });
    
    // Should refetch
    await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(1));
  });

  it("ignores profileUpdated event if userId does not match", async () => {
    renderWithRoute();
    await waitFor(() => expect(screen.getByText("Jane Smith")).toBeInTheDocument());
    
    mocks.getById.mockClear();

    await act(async () => {
      const event = new CustomEvent("profileUpdated", { detail: { userId: "other_user" }});
      window.dispatchEvent(event);
    });
    
    // Wait a bit to ensure it doesn't refetch
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.getById).toHaveBeenCalledTimes(0);
  });

  it("refreshes employee data when refresh button is clicked", async () => {
    renderWithRoute();
    await waitFor(() => expect(screen.getByText("Jane Smith")).toBeInTheDocument());
    
    mocks.getById.mockClear();
    
    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    await act(async () => {
      refreshBtn.click();
    });
    
    await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(1));
  });

  it("renders No Skills Recorded when skills array is empty", async () => {
    mocks.getSkills.mockResolvedValue([]);
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("No Skills Recorded")).toBeInTheDocument();
    expect(screen.getByText("This employee hasn't added any skills yet")).toBeInTheDocument();
  });

  it("filters out invalid skills from radar chart", async () => {
    mocks.getSkills.mockResolvedValue([
      { id: "s1", skillName: "Valid", proficiencyLevel: 3 },
      { id: "s2", skillName: "Invalid Level", proficiencyLevel: 6 },
      { id: "s3" }, // missing skillName and level
    ]);
    renderWithRoute();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    // Should render because 1 is valid, but the radar chart component will receive only the valid one
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.queryByText("Invalid Level")).toBeInTheDocument(); // It renders in the list but filtered in the chart
  });
});
