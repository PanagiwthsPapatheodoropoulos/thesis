// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const navigate = vi.fn();
const state = vi.hoisted(() => ({
  user: { id: "u1", username: "john", role: "USER" },
  logout: vi.fn(),
  getByUserId: vi.fn(),
  getNotifications: vi.fn(),
  joinCompany: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("react-router-dom", async (orig) => {
  const mod = await orig();
  return { ...mod, useNavigate: () => navigate };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user, logout: state.logout }),
}));

vi.mock("../../utils/api", () => ({
  employeesAPI: {
    getByUserId: state.getByUserId,
  },
  companiesAPI: { getJoinCode: vi.fn() },
  notificationsAPI: {
    getByUser: state.getNotifications,
  },
  usersAPI: {
    joinCompany: state.joinCompany,
  },
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {
    USER_PROMOTED: "USER_PROMOTED",
    NEW_NOTIFICATION: "NEW_NOTIFICATION",
  },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: state.subscribe }),
}));

import UserDashboardPage from "../../pages/UserDashboardPage";

describe("UserDashboardPage dedicated", () => {
  beforeEach(() => {
    state.user = { id: "u1", username: "john", role: "USER" };
    state.logout = vi.fn();
    state.getByUserId.mockRejectedValue(new Error("no profile"));
    state.getNotifications.mockResolvedValue([
      { id: "n1", title: "Hi", message: "Waiting", createdAt: new Date().toISOString(), type: "INFO" },
    ]);
    state.joinCompany.mockResolvedValue({});
    state.subscribe.mockImplementation(() => () => {});
    navigate.mockReset();
  });

  it("renders waiting state when employee profile is missing", async () => {
    render(<UserDashboardPage />);
    await waitFor(() => expect(screen.getByText(/Waiting for Employee Profile/i)).toBeInTheDocument());
    expect(screen.getByText(/Recent Notifications/i)).toBeInTheDocument();
  });

  it("shows promotion modal when profile is detected during check", async () => {
    state.getByUserId.mockResolvedValueOnce({ id: "e1" });
    render(<UserDashboardPage />);
    await waitFor(() => expect(screen.getByText(/You've Been Promoted!/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Proceed to Login/i));
    expect(state.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("opens promotion modal from role promotion websocket notification", async () => {
    state.subscribe.mockImplementation((event, cb) => {
      if (event === "NEW_NOTIFICATION") {
        cb({
          id: "p1",
          type: "ROLE_PROMOTION",
          title: "Promoted",
          message: "You are promoted",
          createdAt: new Date().toISOString(),
        });
      }
      return () => {};
    });

    render(<UserDashboardPage />);
    await waitFor(() => expect(screen.getByText(/You've Been Promoted!/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Proceed to Login/i));
    expect(state.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("shows join rejection modal and retries join", async () => {
    state.getNotifications.mockResolvedValueOnce([
      {
        id: "n1",
        title: "Rejected",
        message: "Denied",
        createdAt: new Date().toISOString(),
        type: "JOIN_REJECTED",
        read: false,
      },
    ]);

    render(<UserDashboardPage />);

    await waitFor(() => expect(screen.getByText(/Access Denied/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Enter 10-character code/i), {
      target: { value: "abc123" },
    });
    fireEvent.click(screen.getByText(/Retry Join/i));

    await waitFor(() => expect(state.joinCompany).toHaveBeenCalledWith("u1", "ABC123"));
    expect(globalThis.__showToast).toHaveBeenCalled();
  });

  it("shows error toast when join retry fails", async () => {
    state.getNotifications.mockResolvedValueOnce([
      {
        id: "n1",
        title: "Rejected",
        message: "Denied",
        createdAt: new Date().toISOString(),
        type: "JOIN_REJECTED",
        read: false,
      },
    ]);
    state.joinCompany.mockRejectedValueOnce(new Error("Invalid code"));

    render(<UserDashboardPage />);

    await waitFor(() => expect(screen.getByText(/Access Denied/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Enter 10-character code/i), {
      target: { value: "badcode" },
    });
    fireEvent.click(screen.getByText(/Retry Join/i));

    await waitFor(() => expect(state.joinCompany).toHaveBeenCalledWith("u1", "BADCODE"));
    await waitFor(() =>
      expect(globalThis.__showToast).toHaveBeenCalledWith("Invalid code", "error"),
    );
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });
});

