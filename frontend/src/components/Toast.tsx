/**
 * @fileoverview Lightweight toast notification system.
 * Provides success, error, warning, and info toasts with auto-dismiss
 * and smooth enter/exit animations. No external dependencies.
 * @module components/Toast
 */
import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';


type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

// Context

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Hook to access the toast notification system.
 * Must be called inside a `<ToastProvider>`.
 *
 * @example
 * const { showToast } = useToast();
 * showToast('Task created!', 'success');
 * showToast('Something failed', 'error');
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

//Single Toast Item

const ICON_MAP: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
  error:   <XCircle     className="w-5 h-5 text-red-400   flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
  info:    <Info         className="w-5 h-5 text-blue-400  flex-shrink-0" />,
};

const VARIANT_STYLES: Record<ToastVariant, { light: string; dark: string }> = {
  success: {
    light: 'bg-green-50 border-green-300 text-green-800',
    dark:  'bg-green-900/30 border-green-600/50 text-green-200',
  },
  error: {
    light: 'bg-red-50 border-red-300 text-red-800',
    dark:  'bg-red-900/30 border-red-600/50 text-red-200',
  },
  warning: {
    light: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    dark:  'bg-yellow-900/30 border-yellow-600/50 text-yellow-200',
  },
  info: {
    light: 'bg-blue-50 border-blue-300 text-blue-800',
    dark:  'bg-blue-900/30 border-blue-600/50 text-blue-200',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { darkMode } = useTheme();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), toast.duration - 300);
    const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [toast.id, toast.duration, onDismiss]);

  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm w-full
        transition-all duration-300 ease-in-out
        ${exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
        ${darkMode ? styles.dark : styles.light}`}
    >
      {ICON_MAP[toast.variant]}
      <p className="text-sm font-medium flex-1 break-words">{toast.message}</p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 200); }}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

//Provider

/**
 * Wraps the app to provide the `useToast()` hook.
 * Renders a fixed toast container in the top-right corner.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${idCounter.current++}`;
    setToasts(prev => [...prev.slice(-4), { id, message, variant, duration }]); // keep max 5
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
