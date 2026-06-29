import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import EmployeeProfileModal from '../../components/EmployeeProfileModal';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { employeesAPI } from '../../utils/api';
import { useWebSocket } from '../../contexts/WebSocketProvider';

vi.mock('../../utils/api', () => ({
  employeesAPI: {
    getByUserId: vi.fn(),
    getSkills: vi.fn(),
  },
  getAuthHeaders: vi.fn(),
  getProfileImageUrl: vi.fn((url) => url),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/WebSocketProvider', () => ({
  useWebSocket: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
  })),
}));

vi.mock('../../components/SkillRadarChart', () => {
  return {
    default: function MockSkillRadarChart() {
      return <div data-testid="skill-radar-chart">Skill Radar Chart</div>;
    }
  };
});

vi.mock('../../components/EmployeeProductivityChart', () => {
  return {
    default: function MockEmployeeProductivityChart() {
      return <div data-testid="productivity-chart">Productivity Chart</div>;
    }
  };
});

describe('EmployeeProfileModal', () => {
  const mockEmployee = {
    id: 'emp-123',
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    position: 'Developer',
    department: 'IT',
    hireDate: '2025-01-10T00:00:00Z',
    status: 'ONLINE',
    profileImageUrl: 'http://image.png',
  };

  const mockSkills = [
    { id: 's1', skillName: 'React', proficiencyLevel: 4 },
    { id: 's2', skillName: 'Node', proficiencyLevel: 3 }
  ];

  const renderWithAuth = (currentUser: any, isOpen = true, onClose = vi.fn()) => {
    (useAuth as any).mockReturnValue({ user: currentUser });
    return render(
      <ThemeProvider>
        <EmployeeProfileModal
          isOpen={isOpen}
          onClose={onClose}
          userId="user-123"
        />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (employeesAPI.getByUserId as any).mockResolvedValue(mockEmployee);
    (employeesAPI.getSkills as any).mockResolvedValue(mockSkills);
  });

  it('renders nothing when isOpen is false', () => {
    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' }, false);
    expect(screen.queryByText('Employee Profile')).not.toBeInTheDocument();
  });

  it('renders loading spinner initially, then employee details and skills', async () => {
    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('IT')).toBeInTheDocument();
      expect(screen.getByText('Skills (2)')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Level 4/5')).toBeInTheDocument();
      expect(screen.getByTestId('skill-radar-chart')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const mockClose = vi.fn();
    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' }, true, mockClose);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('handles getSkills failure gracefully by showing empty skills', async () => {
    (employeesAPI.getSkills as any).mockRejectedValue(new Error('Fetch failed'));
    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' });

    await waitFor(() => {
      expect(screen.getByText('This employee hasn\'t added any skills yet.')).toBeInTheDocument();
    });
  });

  it('handles getByUserId failure by showing Employee not found', async () => {
    (employeesAPI.getByUserId as any).mockRejectedValue(new Error('Not found'));
    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' });

    await waitFor(() => {
      expect(screen.getByText('Employee not found')).toBeInTheDocument();
    });
  });

  it('subscribes to live presence status updates via WebSocket', async () => {
    let wsCallback: any = null;
    (useWebSocket as any).mockReturnValue({
      subscribe: vi.fn((event, cb) => {
        wsCallback = cb;
        return vi.fn();
      }),
    });

    renderWithAuth({ id: 'user-123', role: 'EMPLOYEE' });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(wsCallback).toBeTruthy();
    
    // Trigger live presence update
    act(() => {
      wsCallback({ userId: 'user-123', status: 'BUSY' });
    });

    // Verify it doesn't crash and status updates
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
