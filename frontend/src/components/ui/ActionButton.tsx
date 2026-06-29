import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  darkMode?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  darkMode = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return darkMode
          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-transparent shadow-md shadow-indigo-900/10 focus:ring-offset-gray-900'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent shadow-sm';
      case 'secondary':
        return darkMode
          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 focus:ring-offset-gray-900'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200';
      case 'outline':
        return darkMode
          ? 'bg-transparent border border-gray-700 hover:bg-gray-850 text-gray-300 focus:ring-offset-gray-900'
          : 'bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700';
      case 'danger':
        return darkMode
          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 focus:ring-offset-gray-900'
          : 'bg-rose-60 text-rose-850 border border-rose-300 hover:bg-rose-100';
      case 'success':
        return darkMode
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 focus:ring-offset-gray-900'
          : 'bg-emerald-50 text-emerald-850 border border-emerald-300 hover:bg-emerald-100';
      case 'ghost':
        return darkMode
          ? 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
          : 'bg-transparent text-gray-650 hover:bg-gray-100 hover:text-gray-900';
      default:
        return '';
    }
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${getVariantClasses()} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
};
