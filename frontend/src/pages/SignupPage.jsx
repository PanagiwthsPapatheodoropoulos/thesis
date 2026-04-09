/**
 * @file SignupPage.jsx
 * @description Page component for new user registration and initial onboarding.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Eye, EyeOff, Key, Building2, User, Mail, Lock } from 'lucide-react';
import { authAPI } from '../utils/api';

/**
 * SignUpPage Component
 * 
 * Handles the registration flow including optional company joining and admin keys.
 * 
 * @returns {React.ReactElement} The registration UI.
 */
const SignUpPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminKey: '',
    companyCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /**
   * Validates form data and registers the user via the API.
   * 
   * @async
   * @function handleSubmit
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };
      
      if (formData.companyCode.trim()) {
        userData.companyCode = formData.companyCode.trim();
      }

      if (formData.adminKey.trim()) {
        userData.adminKey = formData.adminKey;
      }

      await authAPI.register(userData);
      navigate('/login', { 
        state: { 
          message: 'Account created successfully! Please login.',
          username: formData.username 
        } 
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* Clean Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-900/10 blur-[150px] rounded-full"></div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-lg transition-all hover:bg-white/5 border border-transparent hover:border-white/10 z-50"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline font-medium">Back to Home</span>
      </button>

      <div className="bg-[#0B0F19]/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 border border-white/10 animate-slideUp my-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 mt-2 text-sm">Join the Smart Allocation Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                placeholder="Username"
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                placeholder="Email Address"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-12 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                placeholder="Password (min. 8 chars)"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                placeholder="Confirm Password"
              />
            </div>
          </div>

          {/* Company Code Section */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-purple-400" />
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Company Code (Optional)
              </label>
            </div>
            <input
              type="text"
              value={formData.companyCode || ''}
              onChange={(e) => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 border border-white/10 bg-[#020617] rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-center font-mono text-white text-lg tracking-wider placeholder-slate-600"
              placeholder="ABC12345"
              maxLength={10}
            />
          </div>

          {/* Admin Key Section */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Admin Key (Optional)
              </label>
            </div>
            <div className="relative">
              <input
                type={showAdminKey ? 'text' : 'password'}
                value={formData.adminKey}
                onChange={(e) => setFormData({ ...formData, adminKey: e.target.value })}
                className="w-full px-4 py-3 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-500 text-sm"
                placeholder="Enter key for elevated permissions"
              />
               <button
                type="button"
                onClick={() => setShowAdminKey(!showAdminKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
              >
                {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/5">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline transition-all"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;