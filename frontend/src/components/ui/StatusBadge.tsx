import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'priority' | 'assignment';
  darkMode?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'status',
  darkMode = false,
}) => {
  const normalized = status.toUpperCase().replace('_', ' ');

  // Standardize styles with beautiful, tailored theme palettes
  const getStyles = () => {
    switch (status.toUpperCase()) {
      // Statuses
      case 'PENDING':
        return darkMode
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-amber-50 text-amber-800 border border-amber-250';
      case 'IN_PROGRESS':
        return darkMode
          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          : 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'COMPLETED':
      case 'ACCEPTED':
        return darkMode
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'BLOCKED':
      case 'REJECTED':
      case 'CRITICAL':
        return darkMode
          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          : 'bg-rose-50 text-rose-800 border border-rose-250';
      case 'CANCELLED':
        return darkMode
          ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
          : 'bg-gray-50 text-gray-800 border border-gray-200';
      
      // Priorities
      case 'LOW':
        return darkMode
          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
          : 'bg-sky-50 text-sky-800 border border-sky-200';
      case 'MEDIUM':
        return darkMode
          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          : 'bg-indigo-50 text-indigo-800 border border-indigo-200';
      case 'HIGH':
        return darkMode
          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
          : 'bg-orange-50 text-orange-850 border border-orange-350';
      
      default:
        return darkMode
          ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
          : 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${getStyles()}`}>
      {normalized}
    </span>
  );
};
