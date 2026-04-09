import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getUnread: vi.fn(),
  getUnreadCount: vi.fn(),
  getAllTasks: vi.fn(),
  getTaskById: vi.fn(),
  getComments: vi.fn(),
  getTimeByTask: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  notificationsAPI: {
    getUnread: mocks.getUnread,
    markAsRead: vi.fn().mockResolvedValue({}),
    markAllAsRead: vi.fn().mockResolvedValue({}),
  },
  chatAPI: {
    getUnreadCount: mocks.getUnreadCount,
  },
  tasksAPI: {
    getAll: mocks.getAllTasks,
    getById: mocks.getTaskById,
    updateStatus: vi.fn().mockResolvedValue({}),
  },
  taskCommentsAPI: {
    getByTask: mocks.getComments,
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  taskTimeAPI: {
    getByTask: mocks.getTimeByTask,
    logTime: vi.fn().mockResolvedValue({}),
  },
  taskAuditAPI: {
    getHistory: vi.fn().mockResolvedValue([]),
  },
  assignmentsAPI: {
    getByTask: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN" }, logout: vi.fn() }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true, toggleDarkMode: vi.fn() }),
}));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {},
  useWebSocket: () => ({ connected: true, ready: true, subscribe: () => () => {} }),
}));

import MainLayout from "../../components/MainLayout.jsx";
import TaskDetailsModal from "../../components/TaskDetailsModal.jsx";

describe("MainLayout and TaskDetailsModal behavior", () => {
  beforeEach(() => {
    mocks.getUnread.mockResolvedValue([]);
    mocks.getUnreadCount.mockResolvedValue(0);
    mocks.getAllTasks.mockResolvedValue([]);
    mocks.getTaskById.mockResolvedValue({ id: "t1", title: "Task" });
    mocks.getComments.mockResolvedValue([]);
    mocks.getTimeByTask.mockResolvedValue([]);
  });

  it("MainLayout fetches notifications and chat unread counts", async () => {
    render(
      <MemoryRouter>
        <MainLayout>
          <div>child</div>
        </MainLayout>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getUnread).toHaveBeenCalled());
    expect(mocks.getUnreadCount).toHaveBeenCalled();
  });

  it("TaskDetailsModal fetches task details/comments/time data when open", async () => {
    render(
      <MemoryRouter>
        <TaskDetailsModal isOpen={true} onClose={() => {}} task={{ id: "t1", title: "Task" }} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getTaskById).toHaveBeenCalled());
    expect(mocks.getComments).toHaveBeenCalled();
  });
});

