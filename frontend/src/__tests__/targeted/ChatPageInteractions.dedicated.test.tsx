// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  getAvailableContacts: vi.fn(),
  getUserTeamChats: vi.fn(),
  getUnreadCountPerContact: vi.fn(),
  getDirectMessages: vi.fn(),
  getTeamMessages: vi.fn(),
  markAsRead: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("../../utils/api", () => ({
  chatAPI: {
    sendMessage: mocks.sendMessage,
    getAvailableContacts: mocks.getAvailableContacts,
    getUserTeamChats: mocks.getUserTeamChats,
    getUnreadCountPerContact: mocks.getUnreadCountPerContact,
    getDirectMessages: mocks.getDirectMessages,
    getTeamMessages: mocks.getTeamMessages,
    markAsRead: mocks.markAsRead,
  },
  employeesAPI: {
    getByUserId: vi.fn().mockResolvedValue({}),
  },
  getProfileImageUrl: (u) => u,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", username: "me", role: "ADMIN" } }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));
vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { NEW_MESSAGE: "NEW_MESSAGE", MESSAGE_READ: "MESSAGE_READ", PROFILE_UPDATED: "PROFILE_UPDATED" },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: mocks.subscribe }),
}));

import ChatPage from "../../pages/ChatPage";

describe("ChatPage file-specific interactions", () => {
  beforeEach(() => {
    mocks.sendMessage.mockResolvedValue({});
    mocks.getAvailableContacts.mockResolvedValue([{ id: "u2", username: "alice" }]);
    mocks.getUserTeamChats.mockResolvedValue([{ teamId: "t1", name: "Team A" }]);
    mocks.getUnreadCountPerContact.mockResolvedValue({ u2: 1 });
    mocks.getDirectMessages.mockResolvedValue([]);
    mocks.getTeamMessages.mockResolvedValue([]);
    mocks.markAsRead.mockResolvedValue({});
  });

  it("switches chat modes, selects contact, and sends message", async () => {
    const r = render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());

    fireEvent.click(screen.getByText("alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Teams"));
    await waitFor(() => expect(mocks.getUserTeamChats).toHaveBeenCalled());
    r.unmount();
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
});

