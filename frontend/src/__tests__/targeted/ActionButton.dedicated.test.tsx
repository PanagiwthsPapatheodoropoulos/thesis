// @ts-nocheck
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionButton } from '../../components/ui/ActionButton';

describe('ActionButton', () => {
  it('renders children correctly', () => {
    render(<ActionButton>Click Me</ActionButton>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<ActionButton onClick={handleClick}>Click Me</ActionButton>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled prop', () => {
    const handleClick = vi.fn();
    render(<ActionButton disabled onClick={handleClick}>Click Me</ActionButton>);
    const button = screen.getByText('Click Me');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies correct sizes', () => {
    const { rerender } = render(<ActionButton size="sm">Button</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('px-3 py-1.5 text-xs gap-1.5');

    rerender(<ActionButton size="md">Button</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('px-4 py-2 text-sm gap-2');

    rerender(<ActionButton size="lg">Button</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('px-5 py-2.5 text-base gap-2.5');
  });

  it('applies variant classes for light mode', () => {
    const { rerender } = render(<ActionButton variant="primary" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-indigo-600');

    rerender(<ActionButton variant="secondary" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-100');

    rerender(<ActionButton variant="outline" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('border-gray-300');

    rerender(<ActionButton variant="danger" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-rose-60');

    rerender(<ActionButton variant="success" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-50');

    rerender(<ActionButton variant="ghost" darkMode={false}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('text-gray-650');
  });

  it('applies variant classes for dark mode', () => {
    const { rerender } = render(<ActionButton variant="primary" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('shadow-indigo-900/10');

    rerender(<ActionButton variant="secondary" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-800');

    rerender(<ActionButton variant="outline" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('border-gray-700');

    rerender(<ActionButton variant="danger" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-rose-500/10');

    rerender(<ActionButton variant="success" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-500/10');

    rerender(<ActionButton variant="ghost" darkMode={true}>Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-gray-800');
  });

  it('renders loading state and disables the button', () => {
    const handleClick = vi.fn();
    render(<ActionButton loading onClick={handleClick}>Loading...</ActionButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    // SVG loading spinner should be visible
    expect(button.querySelector('svg')).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders custom className', () => {
    render(<ActionButton className="custom-class">Btn</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('renders custom icon when not loading', () => {
    const icon = <span data-testid="custom-icon">★</span>;
    const { rerender } = render(<ActionButton icon={icon}>Btn</ActionButton>);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();

    // Icon should not render if loading is true
    rerender(<ActionButton icon={icon} loading>Btn</ActionButton>);
    expect(screen.queryByTestId('custom-icon')).not.toBeInTheDocument();
  });
});
