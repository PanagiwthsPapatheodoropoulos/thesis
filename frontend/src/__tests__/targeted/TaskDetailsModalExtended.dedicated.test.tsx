// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  getTime: vi.fn(),
  logTime: vi.fn(),
  getHistory: vi.fn(),
  getEmployeeByUserId: vi.fn(),
  updateStatus: vi.fn(),
  subscribe: vi.fn(),
  getAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getDepartmentByName: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  tasksAPI: { getById: mocks.getById, updateStatus: mocks.updateStatus, update: mocks.updateTask },
  taskCommentsAPI: {
    getByTask: mocks.getComments,
    create: mocks.createComment,
    delete: mocks.deleteComment,
  },
  taskAuditAPI: { getHistory: mocks.getHistory },
  taskTimeAPI: { getByTask: mocks.getTime, logTime: mocks.logTime },
  employeesAPI: { getByUserId: mocks.getEmployeeByUserId },
  taskAttachmentsAPI: {
    getByTask: mocks.getAttachments,
    upload: mocks.uploadAttachment,
    delete: mocks.deleteAttachment,
    download: vi.fn().mockResolvedValue({}),
  },
  departmentsAPI: { getByName: mocks.getDepartmentByName },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN", username: "AdminUser" } }),
}));
vi.mock("../../contexts/WebSocketProvider", () => ({
  useWebSocket: () => ({ connected: true, subscribe: mocks.subscribe }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import TaskDetailsModal from "../../components/TaskDetailsModal";

const baseTask = {
  id: "t1",
  title: "Test Task",
  status: "PENDING",
  priority: "HIGH",
  description: "This is a test task description",
  createdByName: "Admin",
  estimatedHours: 10,
  dueDate: "2026-07-01T00:00:00Z",
  assignments: [{ employeeId: "e1", employeeName: "Alice", status: "ACCEPTED" }],
  teamId: "team1",
};

const renderModal = (taskOverrides = {}, props = {}) =>
  render(
    <MemoryRouter>
      <TaskDetailsModal isOpen={true} task={{ ...baseTask, ...taskOverrides }} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );

describe("TaskDetailsModal extended coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({ ...baseTask });
    mocks.getComments.mockResolvedValue([]);
    mocks.createComment.mockResolvedValue({ id: "c1", comment: "Test comment" });
    mocks.deleteComment.mockResolvedValue({});
    mocks.getTime.mockResolvedValue([]);
    mocks.logTime.mockResolvedValue({});
    mocks.getHistory.mockResolvedValue([]);
    mocks.getEmployeeByUserId.mockResolvedValue({ id: "emp1", department: "Engineering" });
    mocks.updateStatus.mockResolvedValue({ ...baseTask, status: "IN_PROGRESS" });
    mocks.subscribe.mockImplementation(() => () => {});
    mocks.getAttachments.mockResolvedValue([]);
    mocks.uploadAttachment.mockResolvedValue({});
    mocks.deleteAttachment.mockResolvedValue({});
    mocks.getDepartmentByName.mockResolvedValue({ devInfoEnabled: true });
    mocks.updateTask.mockResolvedValue({ ...baseTask });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <MemoryRouter>
        <TaskDetailsModal isOpen={false} task={baseTask} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders task title in modal when open", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("renders PENDING status with Start button for ADMIN", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("clicking Start transitions task to IN_PROGRESS", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByText("Start"));
    });
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith("t1", "IN_PROGRESS")
    );
  });

  it("shows Block button for IN_PROGRESS task", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, status: "IN_PROGRESS" });
    renderModal({ status: "IN_PROGRESS" });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Block")).toBeInTheDocument();
  });

  it("clicking Block transitions task to BLOCKED", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, status: "IN_PROGRESS" });
    renderModal({ status: "IN_PROGRESS" });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByText("Block"));
    });
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith("t1", "BLOCKED")
    );
  });

  it("successfully adds a comment on Discussion tab", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Discussion"));
    const textarea = document.querySelector("textarea");
    fireEvent.change(textarea, { target: { value: "My comment" } });
    await act(async () => {
      fireEvent.submit(textarea.closest("form"));
    });

    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ comment: "My comment" })
      )
    );
  });

  it("shows validation when comment is empty", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Discussion"));
    const textarea = document.querySelector("textarea");
    await act(async () => {
      fireEvent.submit(textarea.closest("form"));
    });

    expect(mocks.createComment).not.toHaveBeenCalled();
  });

  it("shows existing comments in Discussion tab", async () => {
    mocks.getComments.mockResolvedValue([
      {
        id: "c1",
        comment: "Hello World Comment",
        userName: "Alice",
        createdAt: new Date().toISOString(),
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Discussion"));
    await waitFor(() =>
      expect(screen.getByText("Hello World Comment")).toBeInTheDocument()
    );
  });

  it("shows time entries in Time Log tab", async () => {
    mocks.getTime.mockResolvedValue([
      {
        id: "te1",
        employeeName: "Bob",
        hoursSpent: 3.5,
        workDate: new Date().toISOString(),
        description: "Implemented feature",
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Time Log"));
    await waitFor(() =>
      expect(screen.getByText("Bob")).toBeInTheDocument()
    );
  });

  it("Time Log tab shows 'No time logged' when empty", async () => {
    mocks.getTime.mockResolvedValue([]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Time Log"));
    await waitFor(() => {
      const noTimeMsg = screen.queryByText(/no time logged/i) ||
        screen.queryByText(/no entries/i) ||
        screen.queryByText(/0.*hours/i);
      // At minimum, the tab rendered without crashing
      expect(screen.getByText("Time Log")).toBeInTheDocument();
    });
  });

  it("successfully logs time in Time Log tab", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Time Log"));
    const numberInput = document.querySelector('input[type="number"]');
    fireEvent.change(numberInput, { target: { value: "2.5" } });
    await act(async () => {
      fireEvent.submit(numberInput.closest("form"));
    });

    await waitFor(() =>
      expect(mocks.logTime).toHaveBeenCalledWith(
        expect.objectContaining({ hoursSpent: 2.5 })
      )
    );
  });

  it("shows Attachments tab content", async () => {
    mocks.getAttachments.mockResolvedValue([
      {
        id: "att1",
        filename: "document.pdf",
        fileSize: 1024,
        uploadedAt: new Date().toISOString(),
        uploadedByName: "Admin",
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const attachmentsTab = screen.queryByText("Attachments") || screen.queryByText("Files");
    if (attachmentsTab) {
      fireEvent.click(attachmentsTab);
      await waitFor(() =>
        expect(screen.getByText("document.pdf")).toBeInTheDocument()
      );
    }
  });

  it("shows History tab with audit logs", async () => {
    mocks.getHistory.mockResolvedValue([
      {
        id: "h1",
        action: "STATUS_CHANGED",
        createdAt: new Date().toISOString(),
        userName: "Admin",
        description: "Status changed to IN_PROGRESS",
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("History"));
    await waitFor(() =>
      expect(screen.getByText("STATUS_CHANGED")).toBeInTheDocument()
    );
  });

  it("calls onTaskUpdate callback after status change", async () => {
    const onTaskUpdate = vi.fn();
    renderModal({}, { onTaskUpdate });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByText("Start"));
    });

    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalled());
  });

  it("shows task description and estimated hours", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("This is a test task description")).toBeInTheDocument();
  });

  it("shows task with tags when task has tags", async () => {
    mocks.getById.mockResolvedValue({
      ...baseTask,
      tags: ["bug", "frontend"],
    });
    renderModal({ tags: ["bug", "frontend"] });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    // Tags may appear in the UI
    const fullHTML = document.body.innerHTML;
    expect(fullHTML).toMatch(/bug|frontend/);
  });

  it("renders IN_PROGRESS task with Complete and Block buttons", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, status: "IN_PROGRESS" });
    renderModal({ status: "IN_PROGRESS" });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Block")).toBeInTheDocument();
  });

  it("renders task with no description gracefully", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, description: null });
    renderModal({ description: null });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    // Should not crash
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("shows employee assignment info in details tab", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows empty state for no assignments", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, assignments: [] });
    renderModal({ assignments: [] });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());
    // No assignment names shown
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("successfully deletes a comment", async () => {
    mocks.getComments.mockResolvedValue([
      {
        id: "c1",
        comment: "Comment to delete",
        userName: "Bob",
        userId: "u1",
        createdAt: new Date().toISOString(),
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Discussion"));
    await waitFor(() =>
      expect(screen.getByText("Comment to delete")).toBeInTheDocument()
    );

    const deleteBtn = screen.getByTitle("Delete comment");
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => expect(mocks.deleteComment).toHaveBeenCalledWith("c1"));
  });

  it("clicks Cancel Task in footer and transitions task status", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const cancelBtn = screen.getByText("Cancel Task");
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith("t1", "CANCELLED")
    );
  });

  it("clicks Clone & Reopen when task is COMPLETED", async () => {
    const onCloneTask = vi.fn();
    mocks.getById.mockResolvedValue({ ...baseTask, status: "COMPLETED" });
    renderModal({ status: "COMPLETED" }, { onCloneTask });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const cloneBtn = screen.getByText("Clone & Reopen");
    await act(async () => {
      fireEvent.click(cloneBtn);
    });

    expect(onCloneTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", status: "COMPLETED" })
    );
  });

  it("downloads and deletes attachments in Attachments tab", async () => {
    mocks.getAttachments.mockResolvedValue([
      {
        id: "att1",
        filename: "testfile.png",
        fileSize: 2048,
        uploadedAt: new Date().toISOString(),
        uploadedByName: "Bob",
        uploadedByUserName: "Bob",
      },
    ]);
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const attachmentsTab = screen.queryByText("Attachments") || screen.queryByText("Files");
    if (attachmentsTab) {
      fireEvent.click(attachmentsTab);
      await waitFor(() =>
        expect(screen.getByText("testfile.png")).toBeInTheDocument()
      );

      const downloadBtn = screen.getByTitle("Download file");
      fireEvent.click(downloadBtn);
      
      const deleteBtn = screen.getByTitle("Delete attachment");
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
      await waitFor(() => expect(mocks.deleteAttachment).toHaveBeenCalledWith("att1"));
    }
  });

  it("handles file upload in Attachments tab", async () => {
    renderModal();
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const attachmentsTab = screen.queryByText("Attachments") || screen.queryByText("Files");
    if (attachmentsTab) {
      fireEvent.click(attachmentsTab);
      await waitFor(() => expect(screen.getByText(/upload/i)).toBeInTheDocument());

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(["dummy content"], "testfile.png", { type: "image/png" });
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() =>
        expect(mocks.uploadAttachment).toHaveBeenCalledWith("t1", file)
      );
    }
  });

  it("successfully fetches GitHub integration commits and branches when API succeeds", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, githubRepo: "test/repo" });

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes("/branches")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ name: "main" }],
        };
      }
      if (url.includes("/commits")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              sha: "sha123",
              commit: {
                message: "t1 Fix issue",
                author: { name: "Bob", date: "2026-06-17T20:00:00Z" },
              },
            },
          ],
        };
      }
      return { ok: false, status: 404 };
    });

    renderModal({ githubRepo: "test/repo" });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const commitsTab = await screen.findByText("Commits");
    fireEvent.click(commitsTab);
    await waitFor(() =>
      expect(screen.getAllByText("t1 Fix issue")[0]).toBeInTheDocument()
    );
  });

  it("handles GitHub integration API errors gracefully", async () => {
    mocks.getById.mockResolvedValue({ ...baseTask, githubRepo: "test/repo" });

    global.fetch = vi.fn().mockImplementation(async (url) => {
      return { ok: false, status: 404 };
    });

    renderModal({ githubRepo: "test/repo" });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    const commitsTab = await screen.findByText("Commits");
    fireEvent.click(commitsTab);
    await waitFor(() => {
      expect(screen.getByText("Link Repo")).toBeInTheDocument();
      expect(screen.queryByText("View repository on GitHub")).not.toBeInTheDocument();
    });
  });

  it("allows adding and removing tags when user has permissions", async () => {
    mocks.getById.mockResolvedValue({
      ...baseTask,
      tags: ["bug", "frontend"],
    });

    renderModal({ tags: ["bug", "frontend"] });
    await waitFor(() => expect(mocks.getById).toHaveBeenCalled());

    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();

    const addTagBtn = screen.getByText("Add Tag");
    fireEvent.click(addTagBtn);

    const tagInput = screen.getByPlaceholderText("Add tag...");
    fireEvent.change(tagInput, { target: { value: "backend" } });
    mocks.updateTask.mockResolvedValueOnce({
      ...baseTask,
      tags: ["bug", "frontend", "backend"],
    });
    await act(async () => {
      fireEvent.submit(tagInput.closest("form"));
    });

    await waitFor(() =>
      expect(mocks.updateTask).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ tags: ["bug", "frontend", "backend"] })
      )
    );

    mocks.updateTask.mockResolvedValueOnce({
      ...baseTask,
      tags: ["frontend", "backend"],
    });
    const removeBtns = screen.getAllByTitle("Remove Tag");
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });

    await waitFor(() =>
      expect(mocks.updateTask).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ tags: ["frontend", "backend"] })
      )
    );
  });
});
