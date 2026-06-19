// @ts-nocheck
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('normalizes status casing and underscores', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('renders statuses correct styles in light mode', () => {
    const statuses = [
      { status: 'PENDING', expectedClass: 'bg-amber-50' },
      { status: 'IN_PROGRESS', expectedClass: 'bg-blue-50' },
      { status: 'COMPLETED', expectedClass: 'bg-emerald-50' },
      { status: 'ACCEPTED', expectedClass: 'bg-emerald-50' },
      { status: 'BLOCKED', expectedClass: 'bg-rose-50' },
      { status: 'REJECTED', expectedClass: 'bg-rose-50' },
      { status: 'CRITICAL', expectedClass: 'bg-rose-50' },
      { status: 'CANCELLED', expectedClass: 'bg-gray-50' },
      { status: 'LOW', expectedClass: 'bg-sky-50' },
      { status: 'MEDIUM', expectedClass: 'bg-indigo-50' },
      { status: 'HIGH', expectedClass: 'bg-orange-50' },
      { status: 'UNKNOWN_STATUS', expectedClass: 'bg-gray-50' }
    ];

    statuses.forEach(({ status, expectedClass }) => {
      const { container, unmount } = render(<StatusBadge status={status} darkMode={false} />);
      expect(container.firstChild).toHaveClass(expectedClass);
      unmount();
    });
  });

  it('renders statuses correct styles in dark mode', () => {
    const statuses = [
      { status: 'PENDING', expectedClass: 'bg-amber-500/10' },
      { status: 'IN_PROGRESS', expectedClass: 'bg-blue-500/10' },
      { status: 'COMPLETED', expectedClass: 'bg-emerald-500/10' },
      { status: 'ACCEPTED', expectedClass: 'bg-emerald-500/10' },
      { status: 'BLOCKED', expectedClass: 'bg-rose-500/10' },
      { status: 'REJECTED', expectedClass: 'bg-rose-500/10' },
      { status: 'CRITICAL', expectedClass: 'bg-rose-500/10' },
      { status: 'CANCELLED', expectedClass: 'bg-gray-500/10' },
      { status: 'LOW', expectedClass: 'bg-sky-500/10' },
      { status: 'MEDIUM', expectedClass: 'bg-indigo-500/10' },
      { status: 'HIGH', expectedClass: 'bg-orange-500/10' },
      { status: 'UNKNOWN_STATUS', expectedClass: 'bg-gray-500/10' }
    ];

    statuses.forEach(({ status, expectedClass }) => {
      const { container, unmount } = render(<StatusBadge status={status} darkMode={true} />);
      expect(container.firstChild).toHaveClass(expectedClass);
      unmount();
    });
  });
});
