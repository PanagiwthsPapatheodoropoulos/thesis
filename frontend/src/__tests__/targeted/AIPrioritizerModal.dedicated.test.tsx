// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  prioritizeBacklog: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  aiAPI: {
    prioritizeBacklog: mocks.prioritizeBacklog,
  },
  tasksAPI: {
    update: mocks.updateTask,
  },
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import AIPrioritizerModal from "../../components/AIPrioritizerModal";

describe("AIPrioritizerModal dedicated", () => {
  const tasks = [
    { id: "t1", title: "Task 1", description: "desc", priority: "LOW" },
    { id: "t2", title: "Task 2", description: "desc", priority: "LOW" },
  ];

  beforeEach(() => {
    globalThis.__showToast?.mockClear?.();
    mocks.prioritizeBacklog.mockResolvedValue({
      prioritized: [
        {
          task_id: "t1",
          title: "Task 1",
          priority_score: 0.8,
          category: "Backend",
          risk_level: "High",
        },
        {
          task_id: "t2",
          title: "Task 2",
          priority_score: 0.2,
          category: "UX",
          risk_level: "Low",
        },
      ],
    });
    mocks.updateTask.mockResolvedValue({});
  });

  it("does not render or call API when closed", () => {
    render(
      <AIPrioritizerModal
        isOpen={false}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );
    expect(mocks.prioritizeBacklog).not.toHaveBeenCalled();
    expect(screen.queryByText(/AI Backlog Prioritizer/i)).not.toBeInTheDocument();
  });

  it("renders prioritized results when opened", async () => {
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.prioritizeBacklog).toHaveBeenCalled());
    expect(screen.getByText(/AI Backlog Prioritizer/i)).toBeInTheDocument();
    expect(screen.getByText(/Task 1/i)).toBeInTheDocument();
  });

  it("applies priority updates for changed tasks", async () => {
    const onApplied = vi.fn();

    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={onApplied}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Apply AI Priorities/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Apply AI Priorities/i));

    await waitFor(() =>
      expect(mocks.updateTask).toHaveBeenCalledWith("t1", { priority: "CRITICAL" }),
    );
    expect(onApplied).toHaveBeenCalled();
  });

  it("shows toast when priorities already match", async () => {
    mocks.prioritizeBacklog.mockResolvedValueOnce({
      prioritized: [
        { task_id: "t1", title: "Task 1", priority_score: 0.2 },
      ],
    });

    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={[{ id: "t1", title: "Task 1", description: "", priority: "LOW" }]}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.prioritizeBacklog).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Apply AI Priorities/i));

    await waitFor(() => expect(globalThis.__showToast).toHaveBeenCalled());
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("handles items without task_id by matching title", async () => {
    mocks.prioritizeBacklog.mockResolvedValueOnce({
      prioritized: [{ title: "Task 2", priority_score: 0.7 }],
    });
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Task 2/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Apply AI Priorities/i));
    await waitFor(() =>
      expect(mocks.updateTask).toHaveBeenCalledWith("t2", { priority: "HIGH" }),
    );
  });

  it("shows warning toast when some updates fail", async () => {
    mocks.prioritizeBacklog.mockResolvedValueOnce({
      prioritized: [
        { task_id: "t1", title: "Task 1", priority_score: 0.8 },
        { task_id: "t2", title: "Task 2", priority_score: 0.7 },
      ],
    });
    mocks.updateTask.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("fail"));
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );
    await waitFor(() => expect(mocks.prioritizeBacklog).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Apply AI Priorities/i));
    await waitFor(() => expect(mocks.updateTask).toHaveBeenCalledTimes(2));
    expect(globalThis.__showToast).toHaveBeenCalledWith("Updated 1 task priorities.", "success");
    expect(globalThis.__showToast).toHaveBeenCalledWith("1 updates failed.", "warning");
  });

  it("refreshes scores on button click", async () => {
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );
    await waitFor(() => expect(mocks.prioritizeBacklog).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText(/Refresh Scores/i));
    await waitFor(() => expect(mocks.prioritizeBacklog).toHaveBeenCalledTimes(2));
  });

  it("renders error message when prioritizer fails", async () => {
    mocks.prioritizeBacklog.mockRejectedValueOnce(new Error("AI unavailable"));
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={tasks}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(/AI unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/Apply AI Priorities/i)).toBeDisabled();
  });

  it("shows empty state and skips API when opened without tasks", async () => {
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={[]}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Select tasks to generate a priority list/i)).toBeInTheDocument(),
    );
    expect(mocks.prioritizeBacklog).not.toHaveBeenCalled();
  });

  it("falls back to Untitled Task for invalid AI item title", async () => {
    mocks.prioritizeBacklog.mockResolvedValueOnce({
      prioritized: [{ task_id: null, title: "", priority_score: 0.5 }],
    });
    render(
      <AIPrioritizerModal
        isOpen={true}
        tasks={[{ id: "tx", title: "Placeholder", description: "", priority: "LOW" }]}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Untitled Task/i)).toBeInTheDocument());
    expect(screen.getByText(/Suggest MEDIUM/i)).toBeInTheDocument();
  });
});
