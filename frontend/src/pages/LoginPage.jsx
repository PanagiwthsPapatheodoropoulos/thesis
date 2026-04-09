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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* Clean Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/10 blur-[150px] rounded-full"></div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-lg transition-all hover:bg-white/5 border border-transparent hover:border-white/10 z-50"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline font-medium text-sm">Back to Home</span>
      </button>

      <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 animate-slideUp">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-7 h-7 text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 mt-2 text-sm">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              type="text"
              value={credentials.usernameOrEmail}
              onChange={(e) => setCredentials({ ...credentials, usernameOrEmail: e.target.value })}
              className="w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-600"
              placeholder="Username or Email"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-slate-600"
              placeholder="Password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/5">
          <p className="text-sm text-slate-500">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline transition-all"
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