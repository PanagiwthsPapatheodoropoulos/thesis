import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { darkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
    }
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
    }
  };

  const variant = options?.variant || 'primary';
  const confirmText = options?.confirmText || 'Confirm';
  const cancelText = options?.cancelText || 'Cancel';

  const contextValue = useMemo(() => ({ confirm }), [confirm]);

  let variantBgClass = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400';
  if (variant === 'danger') {
    variantBgClass = 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400';
  } else if (variant === 'warning') {
    variantBgClass = 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400';
  }

  let btnBgClass = 'bg-indigo-600 hover:bg-indigo-700';
  if (variant === 'danger') {
    btnBgClass = 'bg-red-600 hover:bg-red-700';
  } else if (variant === 'warning') {
    btnBgClass = 'bg-amber-600 hover:bg-amber-700';
  }

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 fade-in">
          <div
            className={`max-w-md w-full rounded-xl shadow-2xl p-6 border transition-all transform scale-in ${
              darkMode 
                ? 'bg-gray-800 border-gray-700 text-gray-100' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full flex-shrink-0 ${variantBgClass}`}>
                {variant === 'danger' || variant === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">{options.title}</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {options.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCancel}
                className={`px-4 py-2 border rounded-lg text-sm font-semibold transition cursor-pointer ${
                  darkMode
                    ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm ${btnBgClass}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
