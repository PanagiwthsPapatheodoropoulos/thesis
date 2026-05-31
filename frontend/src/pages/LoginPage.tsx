/**
 * @fileoverview LoginPage - User Authentication Entry Point.
 *
 * Renders the sign-in form for existing users. On successful authentication,
 * stores the JWT token through AuthContext and navigates to the dashboard.
 * Invalid credentials display an inline error message without page reload.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../utils/api';

/**
 * Authentication page with username/email and password sign-in form.
 * @component
 * @returns {JSX.Element} The rendered login card with animated background.
 */
const LoginPage = () => {
  const [credentials, setCredentials] = useState({ usernameOrEmail: '', password: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Submits credentials to the auth API and stores the returned JWT on success.
   * Sets an error message if the server rejects the credentials.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = await authAPI.login(credentials);
      login(data.user, data.token, data.refreshToken);

      // Blocked/dismissed users have no company — redirect to company setup
      if (!data.user.companyId && data.user.role !== 'SUPER_ADMIN') {
        navigate('/company-setup');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError('Invalid credentials. Please try again.');
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

      <div className="bg-[#1f1f23]/90 backdrop-blur-md border border-white/[0.06] rounded-lg shadow-2xl p-8 w-full max-w-md relative z-10">
        {/* Top glowing line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded mx-auto mb-6 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-[#8e8e93] mt-2 text-xs">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/25 rounded text-red-400 text-xs flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
            <input
              type="text"
              value={credentials.usernameOrEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentials({ ...credentials, usernameOrEmail: e.target.value })}
              className="w-full pl-11 pr-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
              placeholder="Username or Email"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
            <input
              type="password"
              value={credentials.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full pl-11 pr-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs font-mono"
              placeholder="Password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/[0.05]">
          <p className="text-xs text-[#8e8e93]">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-all"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;