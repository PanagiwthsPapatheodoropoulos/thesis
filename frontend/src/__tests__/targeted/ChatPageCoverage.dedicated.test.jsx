import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAvailableContacts: vi.fn(),
  getUserTeamChats: vi.fn(),
  getDirectMessages: vi.fn(),
  getTeamMessages: vi.fn(),
  sendMessage: vi.fn(),
  markAsRead: vi.fn(),
  getUnreadCountPerContact: vi.fn(),
  getByUserId: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  authUser: { id: "u1", role: "ADMIN", username: "admin1" },
}));

vi.mock("../../utils/api", () => ({
  chatAPI: {
    getAvailableContacts: mocks.getAvailableContacts,
    getUserTeamChats: mocks.getUserTeamChats,
    getDirectMessages: mocks.getDirectMessages,
    getTeamMessages: mocks.getTeamMessages,
    sendMessage: mocks.sendMessage,
    markAsRead: mocks.markAsRead,
    getUnreadCountPerContact: mocks.getUnreadCountPerContact,
  },
  employeesAPI: { getByUserId: mocks.getByUserId },
  getProfileImageUrl: (url) => url,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

vi.mock("../../contexts/WebSocketProvider", () => ({
  EVENT_TYPES: {
    NEW_MESSAGE: "NEW_MESSAGE",
    MESSAGE_READ: "MESSAGE_READ",
    PROFILE_UPDATED: "PROFILE_UPDATED",
  },
  useWebSocket: () => ({ connected: true, ready: true, subscribe: mocks.subscribe }),
}));

import ChatPage from "../../pages/ChatPage.jsx";

describe("ChatPage coverage dedicated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailableContacts.mockResolvedValue([
      { id: "c1", username: "Alice", role: "EMPLOYEE", profileImageUrl: null },
      { id: "c2", username: "Bob", role: "MANAGER", profileImageUrl: "bob.jpg" },
    ]);
    mocks.getUserTeamChats.mockResolvedValue([
      { teamId: "t1", teamName: "Alpha", memberCount: 3, lastMessage: "hi", lastMessageTime: new Date().toISOString() },
    ]);
    mocks.getUnreadCountPerContact.mockResolvedValue({ c1: 2 });
    mocks.getByUserId.mockRejectedValue(new Error("no profile"));
    mocks.getDirectMessages.mockResolvedValue([]);
    mocks.getTeamMessages.mockResolvedValue([]);
    mocks.sendMessage.mockResolvedValue({ id: "m1" });
    mocks.markAsRead.mockResolvedValue({});
  });

  it("renders chat page with contacts and teams tabs", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("switches to team tab and shows teams", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getUserTeamChats).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Teams"));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("shows no contacts message when empty", async () => {
    mocks.getAvailableContacts.mockResolvedValue([]);
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    expect(screen.getByText("No contacts")).toBeInTheDocument();
  });

  it("shows no teams message when empty", async () => {
    mocks.getUserTeamChats.mockResolvedValue([]);
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getUserTeamChats).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Teams"));
    expect(screen.getByText("No teams")).toBeInTheDocument();
  });

  it("selects a contact and shows empty message prompt", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
  });

  it("sends a message and clears input", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Hello!" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hello!", receiverId: "c1" })
    ));
  });

  it("restores message text on send failure", async () => {
    mocks.sendMessage.mockRejectedValue(new Error("fail"));
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Lost msg" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(input.value).toBe("Lost msg"));
  });

  it("refresh button calls all fetch functions", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Refresh Now"));
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalledTimes(2));
    expect(mocks.getUnreadCountPerContact).toHaveBeenCalledTimes(2);
  });

  it("displays unread badge for contacts", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("selects a team and switches to team chat mode", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getUserTeamChats).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Teams"));
    fireEvent.click(screen.getByText("Alpha"));
    await waitFor(() => expect(mocks.getTeamMessages).toHaveBeenCalledWith("t1"));
  });

  it("displays messages with sender info in direct chat", async () => {
    mocks.getDirectMessages.mockResolvedValue([
      { id: "m1", senderId: "c1", receiverId: "u1", message: "Hey there!", isRead: false, createdAt: new Date().toISOString(), senderName: "Alice" },
      { id: "m2", senderId: "u1", receiverId: "c1", message: "Hi back!", isRead: true, createdAt: new Date().toISOString(), senderName: "admin1" },
    ]);
    render(<ChatPage />);
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(screen.getByText("Hey there!")).toBeInTheDocument());
    expect(screen.getByText("Hi back!")).toBeInTheDocument();
  });
});
