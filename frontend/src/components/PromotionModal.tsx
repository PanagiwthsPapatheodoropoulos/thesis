import React from 'react';
import { CheckCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface PromotionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  roleName?: string;
}

/**
 * PromotionModal - A premium modal that informs the user they have been promoted
 * and must re-login to refresh their permissions.
 */
const PromotionModal: React.FC<PromotionModalProps> = ({ 
  isOpen, 
  title = "🎉 Congratulations!", 
  message = "Your account has been promoted.",
  roleName = "Employee"
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  if (!isOpen) return null;

  const handleLogoutAndRelogin = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className={`rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300 ${
        darkMode ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-white text-gray-900'
      }`}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            {title}
          </h3>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-lg`}>
            {message}
          </p>
          <div className={`mt-4 inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
            darkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700'
          }`}>
            New Role: {roleName}
          </div>
        </div>

        <div className={`border-2 rounded-xl p-5 mb-8 flex items-start gap-4 transition-colors ${
          darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'
        }`}>
          <RefreshCw className={`w-6 h-6 flex-shrink-0 mt-0.5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <p className={`font-bold mb-1 ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>Session Refresh Required</p>
            <p className={`text-sm ${darkMode ? 'text-blue-200/70' : 'text-blue-800'}`}>
              Your access permissions have changed. Please log in again to unlock all features of your new role.
            </p>
          </div>
        </div>

        <button
          onClick={handleLogoutAndRelogin}
          className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white py-4 rounded-xl hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20"
        >
          <LogOut className="w-6 h-6" />
          Proceed to Login
        </button>
      </div>
    </div>
  );
};

export default PromotionModal;
