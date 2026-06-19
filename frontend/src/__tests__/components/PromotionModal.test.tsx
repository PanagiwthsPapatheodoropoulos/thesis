import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PromotionModal from '../../components/PromotionModal';

// Mock the contexts properly
const mockUseAuth = vi.fn();
const mockUseNavigate = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockUseNavigate()
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme()
}));

describe('PromotionModal', () => {
  const mockOnClose = vi.fn();
  
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    title: '🎉 Congratulations!',
    message: 'Your account has been promoted.',
    roleName: 'Employee'
  };

  it('renders correctly when open', () => {
    mockUseAuth.mockReturnValue({ logout: vi.fn() });
    mockUseTheme.mockReturnValue({ darkMode: false });
    
    const { container } = render(<PromotionModal {...defaultProps} />);
    
    expect(screen.getByText(/🎉 Congratulations!/)).toBeInTheDocument();
    expect(screen.getByText(/Your account has been promoted./)).toBeInTheDocument();
    expect(screen.getByText(/New Role: Employee/)).toBeInTheDocument();
    
    // Check for the check circle icon
    const checkIcon = container.querySelector('.lucide-circle-check-big, .lucide-check-circle');
    expect(checkIcon).toBeInTheDocument();
    
    // Check for the session refresh info
    expect(screen.getByText(/Session Refresh Required/i)).toBeInTheDocument();
    
    // Check for the proceed to login button
    const loginButton = screen.getByRole('button', { name: /Proceed to Login/i });
    expect(loginButton).toBeInTheDocument();
  });

  it('renders in dark mode correctly', () => {
    mockUseAuth.mockReturnValue({ logout: vi.fn() });
    mockUseTheme.mockReturnValue({ darkMode: true });
    
    render(<PromotionModal {...defaultProps} />);
    
    const modalContainer = screen.getByRole('dialog');
    expect(modalContainer).toHaveClass('bg-gray-800');
  });

  it('does not render when closed', () => {
    mockUseAuth.mockReturnValue({ logout: vi.fn() });
    mockUseTheme.mockReturnValue({ darkMode: false });
    
    render(<PromotionModal {...defaultProps} isOpen={false} />);
    
    // Should render nothing (null)
    expect(screen.queryByText(/🎉 Congratulations!/)).not.toBeInTheDocument();
  });

  it('calls logout and navigates on button click', () => {
    const mockLogout = vi.fn();
    const mockNavigate = vi.fn();
    
    mockUseAuth.mockReturnValue({ logout: mockLogout });
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseTheme.mockReturnValue({ darkMode: false });
    
    render(<PromotionModal {...defaultProps} />);
    
    const loginButton = screen.getByRole('button', { name: /Proceed to Login/i });
    fireEvent.click(loginButton);
    
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders with custom props', () => {
    mockUseAuth.mockReturnValue({ logout: vi.fn() });
    mockUseTheme.mockReturnValue({ darkMode: false });
    
    render(<PromotionModal {...defaultProps} title="Custom Title" message="Custom Message" roleName="Manager" />);
    
    expect(screen.getByText(/Custom Title/)).toBeInTheDocument();
    expect(screen.getByText(/Custom Message/)).toBeInTheDocument();
    expect(screen.getByText(/New Role: Manager/)).toBeInTheDocument();
  });
});