import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  darkMode?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  darkMode = false,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-5 border-b border-gray-200 dark:border-gray-700">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h1>
        {description && (
          <p className={`mt-1 text-sm ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
};
