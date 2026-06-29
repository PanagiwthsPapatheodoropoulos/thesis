import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  darkMode?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'text-indigo-600',
  darkMode = false,
}) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex items-center justify-center p-6">
      <div
        className={`animate-spin rounded-full border-t-transparent ${
          sizeClasses[size]
        } ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        } ${color}`}
        role="status"
        aria-label="loading"
      />
    </div>
  );
};
