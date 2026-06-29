/**
 * @file SignupPage.tsx
 * @description Page component for new user registration and initial onboarding.
 * Styled with the polished charcoal grey theme.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Eye, EyeOff, Building2, User, Mail, Lock } from 'lucide-react';
import { authAPI } from '../utils/api';

/**
 * SignUpPage Component
 * 
 * Handles the registration flow including optional company joining.
 * 
 * @returns {React.ReactElement} The registration UI.
 */
const SignUpPage = () => {
  const [formData, setFormData] = useState<Record<string, any>>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyCode: ''
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
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
      const userData: Record<string, any> = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };
      
      if ((formData as any).companyCode.trim()) {
        userData.companyCode = (formData as any).companyCode.trim();
      }

      await authAPI.register(userData);
      navigate('/login', { 
        state: { 
          message: 'Account created successfully! Please login.',
          username: formData.username 
        } 
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#18181b] via-[#111113] to-[#0a0a0b] text-[#d1d1d6] flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-500/20">
      
      {/* Clean Atmospheric Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-[#8e8e93] hover:text-white px-4 py-2 rounded transition-all hover:bg-white/5 border border-white/[0.06] z-50 font-mono text-xs"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="bg-[#1f1f23]/90 backdrop-blur-md border border-white/[0.06] rounded-lg shadow-2xl p-8 w-full max-w-md relative z-10 my-10 animate-slideUp">
        {/* Top glowing line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded mx-auto mb-5 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-[#8e8e93] mt-2 text-xs">Join the Smart Allocation Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/25 rounded text-red-400 text-xs flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, username: e.target.value })}
                className="w-full pl-11 pr-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
                placeholder="Username"
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-11 pr-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
                placeholder="Email Address"
              />
            </div>

            {/* Password with show/hide toggle */}
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-11 pr-11 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
                placeholder="Password (min. 8 chars)"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-blue-400 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Confirm password with show/hide toggle */}
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full pl-11 pr-11 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
                placeholder="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-blue-400 transition-colors"
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Company Code Section */}
          <div className="pt-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-3.5 h-3.5 text-blue-450" />
              <label className="text-[10px] font-mono font-bold text-[#8e8e93] uppercase tracking-wide">
                Company Code (Optional)
              </label>
            </div>
            <input
              type="text"
              value={(formData as any).companyCode || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-center font-mono text-white text-lg tracking-wider placeholder-[#636366]"
              placeholder="ABC12345"
              maxLength={10}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 mt-4 animate-pulse-slow"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/[0.05]">
          <p className="text-xs text-[#8e8e93]">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-all"
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