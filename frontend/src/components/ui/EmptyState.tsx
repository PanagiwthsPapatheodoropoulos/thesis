import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  darkMode?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  darkMode = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-xl ${
      darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50/50'
    }`}>
      <div className={`flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
        darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400 shadow-sm border border-gray-100'
      }`}>
        {icon || <FolderOpen className="h-6 w-6" />}
      </div>
      <h3 className={`text-base font-semibold ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}>
        {title}
      </h3>
      <p className={`mt-1 text-sm max-w-sm mb-6 ${
        darkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
