// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAvailableContacts: vi.fn(),
  getUserTeamChats: vi.fn(),
  getUnreadCountPerContact: vi.fn(),
  getByUserId: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock("../../utils/api", () => ({
  chatAPI: {
    getAvailableContacts: mocks.getAvailableContacts,
    getUserTeamChats: mocks.getUserTeamChats,
    getUnreadCountPerContact: mocks.getUnreadCountPerContact,
    getDirectMessages: vi.fn().mockResolvedValue([]),
    getTeamMessages: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue({}),
  },
  employeesAPI: {
    getByUserId: mocks.getByUserId,
  },
  getProfileImageUrl: (u) => u,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: { NEW_MESSAGE: "NEW_MESSAGE", MESSAGE_READ: "MESSAGE_READ", PROFILE_UPDATED: "PROFILE_UPDATED" },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: mocks.subscribe }),
}));

import ChatPage from "../../pages/ChatPage";

describe("ChatPage behavior", () => {
  beforeEach(() => {
    mocks.getAvailableContacts.mockResolvedValue([]);
    mocks.getUserTeamChats.mockResolvedValue([]);
    mocks.getUnreadCountPerContact.mockResolvedValue({});
    mocks.getByUserId.mockResolvedValue({});
  });

  it("loads contacts, teams and unread counts", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    expect(mocks.getUserTeamChats).toHaveBeenCalled();
    expect(mocks.getUnreadCountPerContact).toHaveBeenCalled();
  });
});

