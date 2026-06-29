// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";

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
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
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
    editMessage: mocks.editMessage,
    deleteMessage: mocks.deleteMessage,
  },
  employeesAPI: { getByUserId: mocks.getByUserId },
  companiesAPI: { getJoinCode: vi.fn() },
  usersAPI: { getAll: vi.fn(() => Promise.resolve([])) },
  getAuthHeaders: vi.fn(() => ({})),
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

vi.mock("../../components/ConfirmDialog", () => ({
  useConfirm: () => mocks.confirm,
}));

import ChatPage from "../../pages/ChatPage";

describe("ChatPage coverage dedicated", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url.includes("/api/chat/group/g1/messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "m-group-1", senderId: "c1", senderName: "Alice", message: "Hello group!", createdAt: new Date().toISOString() }
          ])
        });
      }
      if (url.includes("/api/chat/group/g1/rename")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "g1", name: "Renamed Group", createdBy: "u1", members: [{ id: "u1", username: "admin1" }, { id: "c1", username: "Alice" }] })
        });
      }
      if (url.includes("/api/chat/group/g1/leave")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.endsWith("/api/chat/group")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "g1", name: "Alpha Group", createdBy: "u1", members: [{ id: "u1", username: "admin1" }, { id: "c1", username: "Alice" }] }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));
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
    mocks.editMessage.mockImplementation((id, text) => Promise.resolve({ id, senderId: "u1", receiverId: "c1", message: text, createdAt: new Date().toISOString() }));
    mocks.deleteMessage.mockResolvedValue({});
  });

  it("renders chat page with contacts and teams tabs", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("switches to team tab and shows teams", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Teams"));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("shows no contacts message when empty", async () => {
    mocks.getAvailableContacts.mockResolvedValue([]);
    render(<ChatPage />);
    await screen.findByText("No contacts");
  });

  it("shows no teams message when empty", async () => {
    mocks.getUserTeamChats.mockResolvedValue([]);
    render(<ChatPage />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Teams"));
    await screen.findByText("No teams");
  });

  it("selects a contact and shows empty message prompt", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");

    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
  });

  it("sends a message and clears input", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
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
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => expect(mocks.getDirectMessages).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Lost msg" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(input.value).toBe("Lost msg"));
  });

  it("refresh button calls all fetch functions", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Refresh Now"));
    await waitFor(() => expect(mocks.getAvailableContacts).toHaveBeenCalledTimes(2));
    expect(mocks.getUnreadCountPerContact).toHaveBeenCalledTimes(2);
  });

  it("displays unread badge for contacts", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("selects a team and switches to team chat mode", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");
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
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Alice"));
    await screen.findByText("Hey there!");
    expect(screen.getByText("Hi back!")).toBeInTheDocument();
  });

  it("handles context menu edit/delete triggers on user sent messages", async () => {
    mocks.getDirectMessages.mockResolvedValue([
      { id: "m-user", senderId: "u1", receiverId: "c1", message: "My message", isRead: true, createdAt: new Date().toISOString(), senderName: "admin1" },
    ]);
    render(<ChatPage />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByText("Alice"));

    const msgElement = await screen.findByText("My message");

    // Trigger right click / context menu
    fireEvent.contextMenu(msgElement);

    // Verify Edit and Delete are present
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();

    // Click Edit, change text, and submit edit
    fireEvent.click(screen.getByText("Edit"));
    const input = screen.getByPlaceholderText("Type a message...");
    expect(input.value).toBe("My message");

    fireEvent.change(input, { target: { value: "My edited message" } });
    fireEvent.submit(input.closest("form"));

    // Verify editMessage API call
    await waitFor(() => {
      expect(mocks.editMessage).toHaveBeenCalledWith("m-user", "My edited message");
    });

    // Re-open context menu and click Delete
    fireEvent.contextMenu(msgElement);
    fireEvent.click(screen.getByText("Delete"));

    // Verify deleteMessage API call
    await waitFor(() => {
      expect(mocks.deleteMessage).toHaveBeenCalledWith("m-user");
    });
  });

  it("renders groups tab and triggers group creation modal and member selection", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");

    // Click groups tab
    fireEvent.click(screen.getByText("Groups"));
    expect(screen.getByText("+ Create Group Chat")).toBeInTheDocument();

    // Open creation modal
    fireEvent.click(screen.getByText("+ Create Group Chat"));
    expect(screen.getByText("Create Group Chat", { selector: "h2" })).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("e.g. Project Alpha"), { target: { value: "New Group" } });

    // Select Alice via checkbox
    const aliceCheckbox = document.querySelector('input[type="checkbox"]');
    fireEvent.click(aliceCheckbox);

    // Submit
    const createBtn = screen.getByText("Create Group", { selector: "button" });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat/group"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("New Group")
        })
      );
    });
  });

  it("selects a group, renders its messages, and sends group messages", async () => {
    render(<ChatPage />);
    await screen.findByText("Alice");

    // Click groups tab
    fireEvent.click(screen.getByText("Groups"));
    expect(screen.getByText("Alpha Group")).toBeInTheDocument();

    // Click on the group item
    fireEvent.click(screen.getByText("Alpha Group"));

    // Wait for handleGroupSelect setTimeout (200ms)
    await new Promise((r) => setTimeout(r, 300));

    // Verify messages fetched and rendered
    await waitFor(() => {
      expect(screen.getByText("Hello group!")).toBeInTheDocument();
    });

    // Send a message
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "My group message" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatRoomId: "g1",
          message: "My group message"
        })
      );
    });
  });

  it("handles sidebar context menu right-clicks on contact and group items", async () => {
    // Mock confirm values
    mocks.confirm.mockResolvedValue(true);

    render(<ChatPage />);
    await screen.findByText("Alice");

    // Test Contact Context Menu
    const aliceContact = screen.getByText("Alice");
    fireEvent.contextMenu(aliceContact);

    expect(screen.getByText("Delete Chat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete Chat"));

    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete Chat",
      })
    );

    // Verify contact disappears
    await waitFor(() => {
      expect(screen.queryByText("Alice")).toBeNull();
    });

    // Search contact to reveal her
    fireEvent.change(screen.getByPlaceholderText("Search contacts..."), { target: { value: "Alice" } });
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Click contact to select and remove from hidden list
    fireEvent.click(screen.getByText("Alice"));

    // Clear search
    fireEvent.change(screen.getByPlaceholderText("Search contacts..."), { target: { value: "" } });
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Test Group Context Menu
    fireEvent.click(screen.getByText("Groups"));
    const groupItem = screen.getByText("Alpha Group");
    fireEvent.contextMenu(groupItem);

    expect(screen.getByText("Rename Group")).toBeInTheDocument();
    expect(screen.getByText("Leave Group")).toBeInTheDocument();

    // Trigger Rename (opens custom Rename Modal)
    fireEvent.click(screen.getByText("Rename Group"));
    expect(screen.getByText("Rename Group Chat", { selector: "h2" })).toBeInTheDocument();

    // Enter name and save
    fireEvent.change(screen.getByPlaceholderText("e.g. Project Alpha"), { target: { value: "Renamed Group" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat/group/g1/rename"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Renamed Group" })
        })
      );
    });

    // Verify the group name has updated in the UI
    await screen.findByText("Renamed Group");

    // Open context menu again on the updated group item and Trigger Leave
    const updatedGroupItem = screen.getByText("Renamed Group");
    fireEvent.contextMenu(updatedGroupItem);
    fireEvent.click(screen.getByText("Leave Group"));
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Leave Group",
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat/group/g1/leave"),
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });
  });
});
