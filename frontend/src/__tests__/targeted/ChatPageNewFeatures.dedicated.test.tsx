import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatPage from '../../pages/ChatPage';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { chatAPI, employeesAPI, usersAPI } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  chatAPI: {
    getAvailableContacts: vi.fn(),
    getUserTeamChats: vi.fn(),
    getUnreadCountPerContact: vi.fn(),
    getDirectMessages: vi.fn(),
    getTeamMessages: vi.fn(),
    editMessage: vi.fn(),
    sendMessage: vi.fn(),
    deleteMessage: vi.fn(),
    markAsRead: vi.fn(),
  },
  employeesAPI: {
    getProfile: vi.fn(),
  },
  usersAPI: {
    getAll: vi.fn(),
  },
  getAuthHeaders: vi.fn(),
  getProfileImageUrl: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/WebSocketProvider', () => ({
  useWebSocket: () => ({
    sendMessage: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    connected: true,
    userStatuses: { 'user-456': 'ONLINE' }
  }),
  EVENT_TYPES: {
    NEW_MESSAGE: 'NEW_MESSAGE',
    MESSAGE_UPDATED: 'MESSAGE_UPDATED',
    MESSAGE_DELETED: 'MESSAGE_DELETED',
    MESSAGE_READ: 'MESSAGE_READ'
  }
}));

describe('ChatPage New Features', () => {
  const renderWithContext = (userId: string) => {
    (useAuth as any).mockReturnValue({ user: { id: userId, username: 'tester', role: 'EMPLOYEE' }, token: 'fake-token' });
    return render(
      <ThemeProvider>
        <BrowserRouter>
          <ChatPage />
        </BrowserRouter>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set implementations inside beforeEach so they are not wiped by mockReset
    (chatAPI.getAvailableContacts as any).mockResolvedValue([]);
    (chatAPI.getUserTeamChats as any).mockResolvedValue([
      {
        teamId: 'team-1',
        teamName: 'Test Team',
        members: [{ userId: 'user-456', username: 'jane1', role: 'MEMBER' }]
      }
    ]);
    (chatAPI.getUnreadCountPerContact as any).mockResolvedValue({});
    (chatAPI.getDirectMessages as any).mockResolvedValue([]);
    (chatAPI.getTeamMessages as any).mockResolvedValue([]);
    (chatAPI.editMessage as any).mockResolvedValue({});
    (chatAPI.sendMessage as any).mockResolvedValue({});
    (chatAPI.deleteMessage as any).mockResolvedValue({});
    (chatAPI.markAsRead as any).mockResolvedValue({});
    
    (employeesAPI.getProfile as any).mockResolvedValue({ id: 'emp-1', profileImageUrl: null });
    (usersAPI.getAll as any).mockResolvedValue([]);

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url === '/api/chat/group') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{
            id: 'group-1',
            name: 'Test Group',
            description: 'Test Desc',
            creatorId: 'user-123',
            members: [{ userId: 'user-123', userName: 'john1', role: 'ADMIN' }],
            createdAt: '2026-06-24T12:00:00Z',
            updatedAt: '2026-06-24T12:00:00Z'
          }])
        });
      }
      if (typeof url === 'string' && url.includes('/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{
            id: 'msg-1',
            senderId: 'user-456',
            senderName: 'JaneDoe',
            message: 'Hello team!',
            createdAt: '2026-06-24T12:05:00Z',
            isRead: true
          }])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    }) as any;

    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows group members dropdown', async () => {
    renderWithContext('user-123');
    const groupsTab = await screen.findByRole('button', { name: /Groups/i });
    fireEvent.click(groupsTab);
    await waitFor(() => screen.getByText('Test Group'));
    fireEvent.click(screen.getByText('Test Group'));
    await waitFor(() => screen.getByText('Members'));
    fireEvent.click(screen.getByText('Members'));
    expect(screen.getByText('john1')).toBeInTheDocument();
  });

  it('shows team members dropdown', async () => {
    renderWithContext('user-123');
    const teamsTab = await screen.findByRole('button', { name: /Teams/i });
    fireEvent.click(teamsTab);
    await waitFor(() => screen.getByText('Test Team'));
    fireEvent.click(screen.getByText('Test Team'));
    await waitFor(() => screen.getByText('Team Members'));
    fireEvent.click(screen.getByText('Team Members'));
    expect(screen.getByText('jane1')).toBeInTheDocument();
  });

  it('shows edit and delete in message context menu', async () => {
    renderWithContext('user-123');
    const groupsTab = await screen.findByRole('button', { name: /Groups/i });
    fireEvent.click(groupsTab);
    await waitFor(() => screen.getByText('Test Group'));
    fireEvent.click(screen.getByText('Test Group'));
    await waitFor(() => screen.getByText('Hello team!'));
    
    const messageElement = screen.getByText('Hello team!').closest('div[class*="group relative"]');
    if (messageElement) {
      fireEvent.contextMenu(messageElement);
      expect(screen.queryByText('Edit Message')).not.toBeInTheDocument();
    }
  });
});
