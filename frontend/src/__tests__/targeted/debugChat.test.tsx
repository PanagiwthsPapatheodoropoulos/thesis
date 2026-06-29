import { describe, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatPage from '../../pages/ChatPage';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { chatAPI, employeesAPI, usersAPI } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  chatAPI: {
    getAvailableContacts: vi.fn().mockResolvedValue([]),
    getUserTeamChats: vi.fn().mockResolvedValue([{ teamId: 'team-1', teamName: 'Test Team', members: [] }]),
    getUnreadCountPerContact: vi.fn().mockResolvedValue({}),
  },
  employeesAPI: { getProfile: vi.fn().mockResolvedValue({}) },
  usersAPI: { getAll: vi.fn().mockResolvedValue([]) },
  getAuthHeaders: vi.fn(),
}));

global.fetch = vi.fn((url) => {
  console.log('FETCH URL CALLED:', url);
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ id: 'g1', name: 'Test Group' }])
  });
}) as any;

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/WebSocketProvider', () => ({
  useWebSocket: () => ({ subscribe: vi.fn(), connected: true, userStatuses: {} }),
  EVENT_TYPES: {}
}));

describe('Debug ChatPage', () => {
  it('debugs', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-123' } });
    render(<ThemeProvider><BrowserRouter><ChatPage /></BrowserRouter></ThemeProvider>);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log('DOM:', document.body.innerHTML);
  });
});
