import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../../components/Pagination';

describe('Pagination', () => {
  const mockOnPageChange = vi.fn();
  
  const defaultProps = {
    currentPage: 0,
    totalPages: 5,
    totalElements: 50,
    size: 10,
    onPageChange: mockOnPageChange,
    darkMode: false
  };

  beforeEach(() => {
    mockOnPageChange.mockReset();
  });

  it('renders results info correctly', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText(/results/)).toBeInTheDocument();
  });

  it('renders page number buttons', () => {
    render(<Pagination {...defaultProps} />);
    // Page numbers are displayed as 1-indexed
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('renders page size selector', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('Per page:')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('disables first/prev buttons on first page', () => {
    render(<Pagination {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // First and Previous buttons are the first two
    expect(buttons[0]).toBeDisabled(); // First
    expect(buttons[1]).toBeDisabled(); // Previous
  });

  it('disables next/last buttons on last page', () => {
    render(<Pagination {...defaultProps} currentPage={4} />);
    const buttons = screen.getAllByRole('button');
    // Next and Last buttons are the last two (excluding page numbers)
    const lastIdx = buttons.length - 1;
    expect(buttons[lastIdx]).toBeDisabled(); // Last  
    expect(buttons[lastIdx - 1]).toBeDisabled(); // Next
  });

  it('calls onPageChange(0) when first button clicked', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // First button
    expect(mockOnPageChange).toHaveBeenCalledWith(0);
  });

  it('calls onPageChange(currentPage - 1) when prev button clicked', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Previous button
    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange(currentPage + 1) when next button clicked', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);
    const buttons = screen.getAllByRole('button');
    // Next is after page number buttons
    const pageButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent || ''));
    const nextIdx = buttons.indexOf(pageButtons[pageButtons.length - 1]) + 1;
    fireEvent.click(buttons[nextIdx]); // Next button
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange(totalPages - 1) when last button clicked', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]); // Last button
    expect(mockOnPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange with page number when page button clicked', () => {
    render(<Pagination {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(mockOnPageChange).toHaveBeenCalledWith(2); // 0-indexed
  });

  it('handles page size change correctly', () => {
    render(<Pagination {...defaultProps} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '20' } });
    expect(mockOnPageChange).toHaveBeenCalledWith(0, 20);
  });

  it('highlights current page button', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    const currentPageButton = screen.getByRole('button', { name: '2' });
    expect(currentPageButton).toHaveClass('bg-indigo-600');
    expect(currentPageButton).toHaveClass('text-white');
  });

  it('shows correct page numbers when on middle pages', () => {
    render(<Pagination {...defaultProps} currentPage={2} totalPages={7} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
  });

  it('renders in dark mode correctly', () => {
    const { container } = render(<Pagination {...defaultProps} darkMode={true} />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('bg-gray-800');
    expect(wrapper).toHaveClass('border-gray-700');
  });

  it('calculates endItem correctly on last page', () => {
    const { container } = render(<Pagination {...defaultProps} currentPage={4} totalElements={42} />);
    const spans = container.querySelectorAll('span.font-medium');
    const values = Array.from(spans).map(s => s.textContent);
    expect(values).toContain('42');
  });
});