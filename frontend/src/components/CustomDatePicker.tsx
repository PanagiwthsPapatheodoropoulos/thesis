import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  mode: 'date' | 'datetime';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  required?: boolean;
  className?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  mode,
  value,
  onChange,
  placeholder,
  min,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value or default to current date
  const parseValue = (val: string) => {
    if (!val) return { date: null, time: '12:00' };
    if (mode === 'date') {
      const parts = val.split('-');
      if (parts.length === 3) {
        return { date: new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])), time: '12:00' };
      }
    } else {
      const parts = val.split('T');
      if (parts.length === 2) {
        const dateParts = parts[0].split('-');
        if (dateParts.length === 3) {
          return {
            date: new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])),
            time: parts[1].substring(0, 5)
          };
        }
      }
    }
    return { date: null, time: '12:00' };
  };

  const { date: selectedDate, time: selectedTime } = parseValue(value);

  // States for viewing calendar month/year
  const [viewDate, setViewDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const [hour, setHour] = useState(() => {
    return selectedTime ? parseInt(selectedTime.split(':')[0]) : 12;
  });

  const [minute, setMinute] = useState(() => {
    return selectedTime ? parseInt(selectedTime.split(':')[1]) : 0;
  });

  // Keep viewDate and time in sync if value changes externally
  useEffect(() => {
    const { date, time } = parseValue(value);
    if (date) {
      setViewDate(new Date(date));
    }
    if (time) {
      const [h, m] = time.split(':').map(Number);
      setHour(h);
      setMinute(m);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
  };

  const formatDateString = (date: Date, hr: number, min: number) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    if (mode === 'date') {
      return `${yyyy}-${mm}-${dd}`;
    } else {
      const hh = String(hr).padStart(2, '0');
      const mi = String(min).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }
  };

  const selectDay = (day: number) => {
    const targetDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    
    // Check min constraint
    if (min) {
      const minDate = mode === 'date' ? new Date(min) : new Date(min.split('T')[0]);
      // Normalize dates to midnight for date-only comparison
      const checkTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const checkMin = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (checkTarget < checkMin) {
        return; // Don't select if before min date
      }
    }

    const formatted = formatDateString(targetDate, hour, minute);
    onChange(formatted);
    if (mode === 'date') {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (newHour: number, newMin: number) => {
    setHour(newHour);
    setMinute(newMin);
    if (selectedDate) {
      onChange(formatDateString(selectedDate, newHour, newMin));
    } else {
      // If no date selected yet, default to today
      onChange(formatDateString(new Date(), newHour, newMin));
    }
  };

  // Generate calendar days
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysGrid: { day: number; currentMonth: boolean; date: Date }[] = [];

  // Prev month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    daysGrid.push({
      day: d,
      currentMonth: false,
      date: new Date(year, month - 1, d)
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push({
      day: i,
      currentMonth: true,
      date: new Date(year, month, i)
    });
  }

  // Next month filler days to complete grid (multiples of 7)
  const remaining = 42 - daysGrid.length;
  for (let i = 1; i <= remaining; i++) {
    daysGrid.push({
      day: i,
      currentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  // Format the input value for display
  const getDisplayValue = () => {
    if (!value) return '';
    if (mode === 'date') {
      if (selectedDate) {
        return selectedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } else {
      if (selectedDate) {
        const dateStr = selectedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const hh = String(hour).padStart(2, '0');
        const mi = String(minute).padStart(2, '0');
        return `${dateStr} at ${hh}:${mi}`;
      }
    }
    return value;
  };

  // Determine theme styling
  const isDarkMode = document.documentElement.classList.contains('dark') || className.includes('dark');

  // Year range select options (from current - 100 to current + 10)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - 100 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 border rounded-lg cursor-pointer transition-all duration-200 outline-none select-none ${
          isDarkMode
            ? 'bg-gray-700 border-gray-600 text-gray-100 focus-within:border-indigo-500'
            : 'bg-white border-gray-300 text-gray-900 focus-within:border-indigo-500'
        }`}
      >
        <span className={`text-sm ${!value ? 'text-gray-400' : ''}`}>
          {getDisplayValue() || placeholder || (mode === 'date' ? 'Select Date' : 'Select Date & Time')}
        </span>
        {mode === 'date' ? (
          <CalendarIcon className="w-4 h-4 text-gray-400" />
        ) : (
          <Clock className="w-4 h-4 text-gray-400" />
        )}
      </div>

      <input
        type={mode === 'date' ? 'date' : 'datetime-local'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: 'none' }}
        required={required}
      />

      {isOpen && (
        <div
          className={`absolute left-0 mt-2 p-4 rounded-xl border shadow-2xl z-50 w-72 transition-all font-sans ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700 text-gray-150'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
          style={{ minWidth: '280px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <span>{MONTHS[viewDate.getMonth()]}</span>
              <select
                value={viewDate.getFullYear()}
                onChange={handleYearChange}
                className={`border-none bg-transparent font-bold outline-none cursor-pointer focus:ring-0 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}
              >
                {years.map((y) => (
                  <option
                    key={y}
                    value={y}
                    className={isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                  >
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 mb-2">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-4">
            {daysGrid.map((item, idx) => {
              const isSelected =
                selectedDate &&
                item.currentMonth &&
                selectedDate.getDate() === item.day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

              const isToday =
                item.currentMonth &&
                new Date().getDate() === item.day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              // Check min constraint for styling
              let isDisabled = false;
              if (min) {
                const minDate = mode === 'date' ? new Date(min) : new Date(min.split('T')[0]);
                const checkItem = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate());
                const checkMin = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                if (checkItem < checkMin) {
                  isDisabled = true;
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(item.day)}
                  className={`py-1.5 rounded-lg font-medium transition-all text-xs ${
                    !item.currentMonth
                      ? 'text-gray-500 cursor-not-allowed opacity-30'
                      : isDisabled
                      ? 'text-gray-500 cursor-not-allowed opacity-35'
                      : isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : isToday
                      ? 'border border-indigo-500 text-indigo-400 font-bold'
                      : isDarkMode
                      ? 'hover:bg-gray-700 text-gray-200'
                      : 'hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Time Picker (for datetime-local) */}
          {mode === 'datetime' && (
            <div className={`pt-3 border-t flex items-center justify-between gap-2 ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-semibold">Time:</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <select
                  value={hour}
                  onChange={(e) => handleTimeChange(parseInt(e.target.value), minute)}
                  className={`px-1.5 py-0.5 rounded border text-xs outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="font-bold">:</span>
                <select
                  value={minute}
                  onChange={(e) => handleTimeChange(hour, parseInt(e.target.value))}
                  className={`px-1.5 py-0.5 rounded border text-xs outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                >
                  {Array.from({ length: 60 }, (_, m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className={`mt-3 pt-2 flex justify-between text-xs ${
            isDarkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                onChange(formatDateString(today, hour, minute));
                setViewDate(today);
                if (mode === 'date') setIsOpen(false);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Today
            </button>
            {value && !required && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-red-400 hover:text-red-300 font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
