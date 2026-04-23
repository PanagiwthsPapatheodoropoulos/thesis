// src/contexts/ThemeContext.tsx
/**
 * @fileoverview Dark mode theme context for the application.
 * Persists the user's theme preference to localStorage and applies
 * the appropriate CSS class to the document root on change.
 */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ThemeContextType } from '../types';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider that manages global dark/light mode state.
 * Reads the initial preference from localStorage, defaulting to dark mode.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components that will have access to theme context.
 * @returns {JSX.Element} The context provider.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    // Default to dark mode (true) if no preference is saved
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    // Persist the preference and toggle the CSS class on the root element
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-gray-900');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-gray-900');
    }
  }, [darkMode]);

  /**
   * Flips the current dark mode state to its opposite.
   */
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook for consuming the ThemeContext.
 * Must be called within a component that is a descendant of ThemeProvider.
 *
 * @returns {{ darkMode: boolean, toggleDarkMode: Function }}
 * @throws {Error} If called outside of a ThemeProvider.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};