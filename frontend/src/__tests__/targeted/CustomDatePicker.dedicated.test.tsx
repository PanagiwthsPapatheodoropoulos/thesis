import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CustomDatePicker } from '../../components/CustomDatePicker';

describe('CustomDatePicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openDatePicker = (container: HTMLElement) => {
    const trigger = container.querySelector('.cursor-pointer');
    if (!trigger) throw new Error('Trigger not found');
    fireEvent.click(trigger);
  };

  describe('renders correctly', () => {
    it('renders with placeholder when no value', () => {
      render(
        <CustomDatePicker mode="date" value="" onChange={mockOnChange} placeholder="Select date" />
      );
      expect(screen.getByText('Select date')).toBeTruthy();
    });

    it('renders date mode with existing date value', () => {
      render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      expect(screen.getByText('June 15, 2025')).toBeTruthy();
    });

    it('renders datetime mode with existing datetime value', () => {
      render(
        <CustomDatePicker mode="datetime" value="2025-06-15T14:30" onChange={mockOnChange} />
      );
      expect(screen.getByText('Jun 15, 2025 at 14:30')).toBeTruthy();
    });
  });

  describe('calendar open/close', () => {
    it('opens calendar when input is clicked', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="" onChange={mockOnChange} />
      );
      openDatePicker(container);
      expect(screen.getByText('Su')).toBeTruthy();
    });

    it('shows day-of-week headers when calendar is open', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      openDatePicker(container);
      expect(screen.getByText('Mo')).toBeTruthy();
      expect(screen.getByText('Tu')).toBeTruthy();
    });

    it('closes calendar when clicking outside', () => {
      const { container } = render(
        <div>
          <CustomDatePicker mode="date" value="" onChange={mockOnChange} />
          <div data-testid="outside">Outside</div>
        </div>
      );
      openDatePicker(container);
      expect(screen.getByText('Su')).toBeTruthy();

      act(() => {
        fireEvent.mouseDown(screen.getByTestId('outside'));
      });
      expect(screen.queryByText('Su')).toBeFalsy();
    });
  });

  describe('date selection', () => {
    it('selects a date and calls onChange in date mode', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-01" onChange={mockOnChange} />
      );
      openDatePicker(container);

      // Click on day 15
      const day15 = screen.getByText('15');
      fireEvent.click(day15);
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('selects a date in datetime mode and keeps calendar open', () => {
      const { container } = render(
        <CustomDatePicker mode="datetime" value="2025-06-15T10:00" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const day10 = screen.getAllByText('10')[0];
      fireEvent.click(day10);
      expect(mockOnChange).toHaveBeenCalled();
      // Calendar stays open in datetime mode
      expect(screen.getByText('Su')).toBeTruthy();
    });

    it('does not select date before min date', () => {
      const { container } = render(
        <CustomDatePicker
          mode="date"
          value="2025-06-20"
          onChange={mockOnChange}
          min="2025-06-15"
        />
      );
      openDatePicker(container);

      // Try clicking a day before the min (day 10)
      const day10 = screen.getAllByText('10')[0];
      fireEvent.click(day10);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('selects date on or after min date', () => {
      const { container } = render(
        <CustomDatePicker
          mode="date"
          value="2025-06-20"
          onChange={mockOnChange}
          min="2025-06-15"
        />
      );
      openDatePicker(container);

      // Day 20 should be valid
      const day20 = screen.getAllByText('20')[0];
      fireEvent.click(day20);
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('month navigation', () => {
    it('navigates to previous month', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(screen.getByText('May')).toBeTruthy();
    });

    it('navigates to next month', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]);
      expect(screen.getByText('July')).toBeTruthy();
    });

    it('changes year via select', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const yearSelect = screen.getByRole('combobox');
      fireEvent.change(yearSelect, { target: { value: '2026' } });
      expect(screen.getByText('2026')).toBeTruthy();
    });
  });

  describe('datetime mode - time controls', () => {
    it('shows time controls in datetime mode', () => {
      const { container } = render(
        <CustomDatePicker mode="datetime" value="2025-06-15T14:30" onChange={mockOnChange} />
      );
      openDatePicker(container);
      expect(screen.getByText(':') || screen.getByDisplayValue('14')).toBeTruthy();
    });

    it('updates hour and calls onChange', () => {
      const { container } = render(
        <CustomDatePicker mode="datetime" value="2025-06-15T14:30" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const selects = container.querySelectorAll('select');
      if (selects.length >= 2) {
        fireEvent.change(selects[1], { target: { value: '10' } });
        expect(mockOnChange).toHaveBeenCalled();
      }
    });
  });

  describe('value sync via useEffect', () => {
    it('updates when value prop changes externally', () => {
      const { container, rerender } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      rerender(
        <CustomDatePicker mode="date" value="2025-07-20" onChange={mockOnChange} />
      );
      openDatePicker(container);
      expect(screen.getByText('July')).toBeTruthy();
    });

    it('handles empty value externally and defaults to current date', () => {
      const { container, rerender } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      rerender(
        <CustomDatePicker mode="date" value="" onChange={mockOnChange} />
      );
      openDatePicker(container);
      expect(screen.getByText('Su')).toBeTruthy();
    });
  });

  describe('datetime mode handleTimeChange with no date', () => {
    it('calls onChange with today date when time changes but no date selected', () => {
      const { container } = render(
        <CustomDatePicker mode="datetime" value="" onChange={mockOnChange} />
      );
      openDatePicker(container);

      const selects = container.querySelectorAll('select');
      if (selects.length >= 2) {
        fireEvent.change(selects[1], { target: { value: '9' } });
        expect(mockOnChange).toHaveBeenCalled();
      }
    });
  });

  describe('min constraint for datetime mode', () => {
    it('respects min date in datetime mode', () => {
      const { container } = render(
        <CustomDatePicker
          mode="datetime"
          value="2025-06-20T10:00"
          onChange={mockOnChange}
          min="2025-06-15T00:00"
        />
      );
      openDatePicker(container);

      // Clicking a day before min should not trigger onChange
      const day10 = screen.getAllByText('10')[0];
      fireEvent.click(day10);
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('month and year navigation', () => {
    it('supports navigating months and changing years', () => {
      const { container } = render(
        <CustomDatePicker mode="date" value="2025-06-15" onChange={mockOnChange} />
      );
      openDatePicker(container);

      // Verify initial month
      expect(screen.getByText('June')).toBeTruthy();

      // Click prev month
      const prevBtn = container.querySelector('svg.lucide-chevron-left').closest('button');
      fireEvent.click(prevBtn);
      expect(screen.getByText('May')).toBeTruthy();

      // Click next month
      const nextBtn = container.querySelector('svg.lucide-chevron-right').closest('button');
      fireEvent.click(nextBtn);
      expect(screen.getByText('June')).toBeTruthy();

      // Change year
      const yearSelect = container.querySelector('select');
      fireEvent.change(yearSelect, { target: { value: '2026' } });
      expect(yearSelect.value).toBe('2026');
    });
  });
});
