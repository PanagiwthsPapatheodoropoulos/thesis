// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  bulkOptimize: vi.fn(),
  createAssignment: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    bulkOptimize: mocks.bulkOptimize,
  },
  assignmentsAPI: {
    create: mocks.createAssignment,
  },
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import AIBulkPlannerModal from "../../components/AIBulkPlannerModal";

describe("AIBulkPlannerModal dedicated", () => {
  const tasks = [
    { id: "t1", title: "Task 1", status: "PENDING", isArchived: false },
    { id: "t2", title: "Task 2", status: "PENDING", isArchived: false },
  ];

  beforeEach(() => {
    globalThis.__showToast?.mockClear?.();
    mocks.bulkOptimize.mockResolvedValue({
      assignments: [
        {
          task_id: "t1",
          task_title: "Task 1",
          employee_id: "e1",
          employee_name: "Alice",
          fit_score: 0.9,
          confidence_score: 0.8,
        },
        {
          task_id: "t2",
          task_title: "Task 2",
          employee_id: null,
          employee_name: "Unassigned",
          fit_score: 0.4,
          confidence_score: 0.3,
        },
      ],
    });
    mocks.createAssignment.mockResolvedValue({});
  });

  it("does not call AI endpoint when modal is closed", () => {
    render(
      <AIBulkPlannerModal
        isOpen={false}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    expect(mocks.bulkOptimize).not.toHaveBeenCalled();
    expect(screen.queryByText(/AI Bulk Assignment Planner/i)).not.toBeInTheDocument();
  });

  it("renders plan items and applies valid assignments", async () => {
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalled());
    expect(screen.getByText(/AI Bulk Assignment Planner/i)).toBeInTheDocument();
    expect(screen.getByText(/Task 1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Apply Plan/i));

    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(1));
    expect(mocks.createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "t1", employeeId: "e1" }),
    );
  });

  it("shows toast when no valid assignments exist", async () => {
    mocks.bulkOptimize.mockResolvedValueOnce({
      assignments: [
        {
          task_id: "t1",
          task_title: "Task 1",
          employee_id: null,
          employee_name: "Unassigned",
        },
      ],
    });

    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Apply Plan/i));

    await waitFor(() => expect(globalThis.__showToast).toHaveBeenCalled());
    expect(mocks.createAssignment).not.toHaveBeenCalled();
  });

  it("toggles optimization mode and regenerates with updated flag", async () => {
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await screen.findByText(/Task 1/i);
    fireEvent.click(screen.getByLabelText(/Balance team workload/i));
    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalledTimes(2));
    expect(mocks.bulkOptimize).toHaveBeenLastCalledWith(
      expect.objectContaining({ optimizeWorkload: false }),
    );
  });

  it("regenerates the plan when Regenerate is clicked", async () => {
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await screen.findByText(/Task 1/i);
    fireEvent.click(screen.getByText(/Regenerate/i));
    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalledTimes(2));
  });

  it("shows excluded tasks banner for completed or archived tasks", async () => {
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={[
          ...tasks,
          { id: "t3", title: "Done", status: "COMPLETED", isArchived: false },
          { id: "t4", title: "Archived", status: "PENDING", isArchived: true },
        ]}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalled());
    expect(screen.getByText(/2 tasks were skipped/i)).toBeInTheDocument();
  });

  it("renders API error state when plan generation fails", async () => {
    mocks.bulkOptimize.mockRejectedValueOnce(new Error("planner unavailable"));
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/planner unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/Apply Plan/i)).toBeDisabled();
  });

  it("shows empty guidance and skips AI call when all tasks are ineligible", async () => {
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={[
          { id: "t9", title: "Done", status: "COMPLETED", isArchived: false },
          { id: "t10", title: "Archived", status: "PENDING", isArchived: true },
        ]}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Select active tasks/i)).toBeInTheDocument());
    expect(mocks.bulkOptimize).not.toHaveBeenCalled();
    expect(screen.getByText(/Apply Plan/i)).toBeDisabled();
  });

  it("reports mixed apply results and still calls onApplied", async () => {
    const onApplied = vi.fn();
    mocks.bulkOptimize.mockResolvedValueOnce({
      assignments: [
        {
          task_id: "t1",
          task_title: "Task 1",
          employee_id: "e1",
          employee_name: "Alice",
          fit_score: 0.9,
          confidence_score: 0.8,
        },
        {
          task_id: "t2",
          task_title: "Task 2",
          employee_id: "e2",
          employee_name: "Bob",
          fit_score: 0.7,
          confidence_score: 0.6,
        },
      ],
    });
    mocks.createAssignment
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("failed"));
    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={onApplied}
      />,
    );

    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Apply Plan/i));
    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(2));
    expect(globalThis.__showToast).toHaveBeenCalledWith("Created 1 assignments.", "success");
    expect(globalThis.__showToast).toHaveBeenCalledWith("1 assignments failed.", "warning");
    expect(onApplied).toHaveBeenCalled();
  });

  it("shows skipped toast when some assignments lack assignees", async () => {
    const onApplied = vi.fn();
    mocks.bulkOptimize.mockResolvedValueOnce({
      assignments: [
        {
          task_id: "t1",
          task_title: "Task 1",
          employee_id: "e1",
          employee_name: "Alice",
          fit_score: 0.9,
          confidence_score: 0.8,
        },
        {
          task_id: "t2",
          task_title: "Task 2",
          employee_id: null,
          employee_name: "Unassigned",
        },
      ],
    });

    render(
      <AIBulkPlannerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={onApplied}
      />,
    );

    await waitFor(() => expect(mocks.bulkOptimize).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Apply Plan/i));
    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(1));
    expect(globalThis.__showToast).toHaveBeenCalledWith("Created 1 assignments.", "success");
    expect(globalThis.__showToast).toHaveBeenCalledWith(
      "Skipped 1 items without a valid assignee.",
      "warning",
    );
    expect(onApplied).toHaveBeenCalled();
  });
});
