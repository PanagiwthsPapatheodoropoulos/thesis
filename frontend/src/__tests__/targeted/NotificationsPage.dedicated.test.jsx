import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  user: { id: "u1", role: "ADMIN" },
  getByUser: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("../../utils/api", () => ({
  notificationsAPI: {
    getByUser: state.getByUser,
    markAsRead: state.markAsRead,
    markAllAsRead: state.markAllAsRead,
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {
    NEW_NOTIFICATION: "NEW_NOTIFICATION",
    NOTIFICATION_READ: "NOTIFICATION_READ",
  },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: state.subscribe }),
}));

import NotificationsPage from "../../pages/NotificationsPage.jsx";

describe("NotificationsPage dedicated", () => {
  beforeEach(() => {
    state.user = { id: "u1", role: "ADMIN" };
    state.getByUser.mockResolvedValue([
      {
        id: "n1",
        title: "Welcome",
        message: "hello",
        severity: "INFO",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "n2",
        title: "Done",
        message: "ok",
        severity: "SUCCESS",
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    state.markAsRead.mockResolvedValue({});
    state.markAllAsRead.mockResolvedValue({});
    state.subscribe.mockImplementation(() => () => {});
  });

  it("loads notifications and supports unread/read filtering", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(state.getByUser).toHaveBeenCalledWith("u1"));

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();

    fireEvent.click(screen.getByText("UNREAD (1)"));
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("READ"));
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("marks all notifications as read", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(state.getByUser).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Mark All Read/i));
    await waitFor(() => expect(state.markAllAsRead).toHaveBeenCalledWith("u1"));
  });

  it("marks a single notification as read", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(state.getByUser).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Mark Read"));
    await waitFor(() => expect(state.markAsRead).toHaveBeenCalledWith("n1"));
  });

  it("applies websocket NEW_NOTIFICATION and mark_all_read events", async () => {
    state.subscribe.mockImplementation((event, cb) => {
      if (event === "NEW_NOTIFICATION") {
        cb({
          id: "n3",
          title: "Live",
          message: "arrived",
          severity: "WARNING",
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
      if (event === "NOTIFICATION_READ") {
        cb({ action: "mark_all_read" });
      }
      return () => {};
    });

    render(<NotificationsPage />);
    await waitFor(() => expect(state.subscribe).toHaveBeenCalled());
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/All read/i)).toBeInTheDocument();
  });
});

