// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAllEmployees: vi.fn(),
  suggestTeamSkills: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: {
    getAll: mocks.getAllEmployees,
  },
  aiAPI: {
    suggestTeamSkills: mocks.suggestTeamSkills,
  },
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import TeamSkillGapRadarModal from "../../components/TeamSkillGapRadarModal";

describe("TeamSkillGapRadarModal dedicated", () => {
  const tasks = [{ id: "t1", title: "Task 1", description: "desc" }];

  beforeEach(() => {
    mocks.getAllEmployees.mockResolvedValue([
      { skills: [{ skillName: "React" }, { name: "Node" }] },
    ]);
    mocks.suggestTeamSkills.mockResolvedValue({
      suggestions: [
        {
          skill_name: "GraphQL",
          category: "Backend",
          frequency: 2,
          priority_score: 0.8,
        },
      ],
    });
  });

  it("does not trigger analysis when there are no tasks", () => {
    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={[]} />);
    expect(mocks.getAllEmployees).not.toHaveBeenCalled();
    expect(mocks.suggestTeamSkills).not.toHaveBeenCalled();
  });

  it("renders suggestions list when AI returns results", async () => {
    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);

    await waitFor(() => expect(mocks.suggestTeamSkills).toHaveBeenCalled());
    expect(screen.getByText(/Suggested Training Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/GraphQL/i)).toBeInTheDocument();
  });

  it("renders no gaps message when suggestions are empty", async () => {
    mocks.suggestTeamSkills.mockResolvedValueOnce({ suggestions: [] });

    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);

    await waitFor(() => expect(mocks.suggestTeamSkills).toHaveBeenCalled());
    expect(screen.getByText(/No Skill Gaps Detected/i)).toBeInTheDocument();
  });

  it("shows error state when analysis fails", async () => {
    mocks.suggestTeamSkills.mockRejectedValueOnce(new Error("fail"));

    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);

    await waitFor(() => expect(screen.getByText(/Analysis Failed/i)).toBeInTheDocument());
  });

  it("sends deduplicated existing skills in payload", async () => {
    mocks.getAllEmployees.mockResolvedValueOnce([
      { skills: [{ skillName: "React" }, { name: "React" }, { name: "Node" }] },
      { skills: [{ skillName: "Node" }, { skillName: "TypeScript" }] },
    ]);

    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);
    await waitFor(() => expect(mocks.suggestTeamSkills).toHaveBeenCalled());
    const payload = mocks.suggestTeamSkills.mock.calls[0][0];
    expect(payload.team_tasks).toEqual([{ title: "Task 1", description: "desc" }]);
    expect(new Set(payload.existing_skills)).toEqual(new Set(["React", "Node", "TypeScript"]));
  });

  it("retries analysis from error state", async () => {
    mocks.suggestTeamSkills
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({
        suggestions: [{ skill_name: "Testing", category: "QA", frequency: 1, priority_score: 0.6 }],
      });

    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);
    await waitFor(() => expect(screen.getByText(/Analysis Failed/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Try Again/i));
    await waitFor(() => expect(screen.getByText(/Testing/i)).toBeInTheDocument());
  });

  it("handles employee fetch failure by showing error state", async () => {
    mocks.getAllEmployees.mockRejectedValueOnce(new Error("employee fetch failed"));
    render(<TeamSkillGapRadarModal isOpen={true} onClose={() => {}} tasks={tasks} />);
    await waitFor(() => expect(screen.getByText(/Analysis Failed/i)).toBeInTheDocument());
    expect(screen.getByText(/employee fetch failed/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<TeamSkillGapRadarModal isOpen={true} onClose={onClose} tasks={tasks} />);
    await waitFor(() => expect(mocks.suggestTeamSkills).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/^Close$/i));
    expect(onClose).toHaveBeenCalled();
  });
});
