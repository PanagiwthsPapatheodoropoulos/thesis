/**
 * @file CompanySetupPage.tsx
 * @description Page component for joining an existing company or creating a new one.
 *              Also handles the re-join flow for blocked/dismissed users who already
 *              have an account but lost their company association.
 *              Styled with the polished charcoal grey theme.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Key, ArrowLeft, Sparkles, User, Mail, Lock, AlertTriangle, LogOut, Eye, EyeOff } from 'lucide-react';
import { authAPI, usersAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

/**
 * CompanySetupPage Component
 * 
 * Provides dynamic forms for company creation (by an admin) and joining (by employees).
 * 
 * @returns {React.ReactElement} The company setup UI.
 */
const CompanySetupPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, updateUser, logout } = useAuth();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [rejoinCode, setRejoinCode] = useState<string>('');

  // Password visibility state for the Create form
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Password visibility state for the Join form
  const [showJoinPassword, setShowJoinPassword] = useState<boolean>(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState<boolean>(false);

  // Detect if the visitor is a logged-in user without a company (blocked/dismissed)
  const isLoggedInWithoutCompany = !!user && !user.companyId && user.role !== 'SUPER_ADMIN';

  /**
   * Handles re-joining a company for an existing logged-in user
   * who was blocked or dismissed.
   */
  const handleRejoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const updatedUser = await usersAPI.joinCompany(user.id, rejoinCode.trim());
      // Merge the new company info into the auth context so guards pass
      updateUser({ companyId: updatedUser.companyId, companyName: updatedUser.companyName, role: updatedUser.role });
      showToast('Successfully joined company! Awaiting admin approval.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to join company. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const [createData, setCreateData] = useState({
    companyName: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: ''
  });
  
  const [joinData, setJoinData] = useState({
    companyCode: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  /**
   * Handles creating a new company organization.
   * 
   * @async
   * @function handleCreateCompany
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setError('');

    if (createData.adminPassword !== createData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.registerCompany({
        companyName: createData.companyName,
        adminUsername: createData.adminUsername,
        adminEmail: createData.adminEmail,
        adminPassword: createData.adminPassword
      });

      // 9-second duration so the join code is readable before navigating
      showToast(
        `Company created! Your join code is: ${response.joinCode}. Share this code with employees to join your company.`,
        'success',
        9000
      );
      
      navigate('/login', {
        state: {
          message: `Company "${createData.companyName}" created successfully! Please login.`,
          username: createData.adminUsername
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles joining an existing company using a join code.
   * 
   * @async
   * @function handleJoinCompany
   * @param {React.FormEvent} e - The form submission event.
   * @returns {Promise<void>}
   */
  const handleJoinCompany = async (e) => {
    e.preventDefault();
    setError('');

    if (joinData.password !== joinData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authAPI.register({
        username: joinData.username,
        email: joinData.email,
        password: joinData.password,
        companyCode: joinData.companyCode
      });

      navigate('/login', {
        state: {
          message: 'Account created successfully! Please login.',
          username: joinData.username
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to join company. Check your company code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#18181b] via-[#111113] to-[#0a0a0b] text-[#d1d1d6] font-sans flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-500/20">
      
      {/* Clean Atmospheric Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <button
        onClick={() => mode ? setMode(null) : navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-[#8e8e93] hover:text-white px-4 py-2 rounded transition-all hover:bg-white/5 border border-white/[0.06] z-50 font-mono text-xs"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="bg-[#1f1f23]/90 backdrop-blur-md border border-white/[0.06] rounded-lg shadow-2xl p-8 w-full max-w-md relative z-10 animate-slideUp">
        {/* Top glowing line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        {/* ── Re-join flow for blocked / dismissed users ── */}
        {isLoggedInWithoutCompany && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Company Access Required</h1>
              <p className="text-[#8e8e93] mt-2 text-xs">
                You are no longer assigned to a company. Enter a company code to join one.
              </p>
            </div>

            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded">
              <p className="text-amber-450 text-xs leading-relaxed">
                <strong>Hi {user?.username},</strong> your previous company access has been revoked.
                Contact a company admin for a new join code, or create your own company below.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 rounded text-red-400 text-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleRejoinCompany} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={rejoinCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejoinCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-center text-xl font-mono tracking-[0.2em] text-white placeholder-[#636366] uppercase"
                  placeholder="CODE"
                  maxLength={10}
                />
                <p className="text-[10px] text-[#636366] mt-2 text-center font-mono">Ask a company admin for this code</p>
              </div>

              <button
                type="submit"
                disabled={loading || !rejoinCode.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join Company'}
              </button>
            </form>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 h-px bg-white/[0.05]"></div>
              <span className="text-xs text-[#636366] font-mono">or</span>
              <div className="flex-1 h-px bg-white/[0.05]"></div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { logout(); navigate('/company-setup'); }}
                className="flex-1 flex items-center justify-center gap-2 p-3 border border-white/[0.06] bg-[#141416] rounded hover:bg-white/5 transition-all text-xs text-[#8e8e93] hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
              <button
                onClick={() => { logout(); navigate('/company-setup'); }}
                className="flex-1 flex items-center justify-center gap-2 p-3 border border-blue-500/20 bg-blue-500/5 rounded hover:bg-blue-500/10 transition-all text-xs text-blue-450 hover:text-blue-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Create Company
              </button>
            </div>
          </div>
        )}

        {/* ── Standard mode selection (unauthenticated visitors) ── */}
        {!isLoggedInWithoutCompany && !mode && (
          <div className="space-y-6">
            <div className="text-center mb-10">
              <div className="w-12 h-12 bg-blue-600 rounded mx-auto mb-6 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Building2 className="w-6 h-6 text-white fill-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Company Setup</h1>
              <p className="text-[#8e8e93] mt-2 text-xs">Initialize your workspace</p>
            </div>

            <button
              onClick={() => setMode('create')}
              className="w-full p-5 border border-white/[0.06] bg-[#141416]/50 rounded hover:bg-[#1c1c20] hover:border-blue-500/40 transition-all group duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-450">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-left font-sans">
                  <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">Create Company</h3>
                  <p className="text-xs text-[#8e8e93] mt-0.5">Register a new organization</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-5 border border-white/[0.06] bg-[#141416]/50 rounded hover:bg-[#1c1c20] hover:border-blue-500/40 transition-all group duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-450">
                  <Key className="w-5 h-5" />
                </div>
                <div className="text-left font-sans">
                  <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">Join Company</h3>
                  <p className="text-xs text-[#8e8e93] mt-0.5">Enter via invitation code</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create Company Form */}
        {mode === 'create' && (
          <div className="animate-slideUp">
            <div className="text-center mb-8">
              <h2 className="text-lg font-bold text-white">Create Organization</h2>
              <p className="text-[#8e8e93] mt-1 text-xs">Set up your admin account</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/25 rounded text-red-400 text-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="space-y-4">
                <InputGroup icon={Building2} type="text" placeholder="Company Name" value={createData.companyName} onChange={e => setCreateData({...createData, companyName: e.target.value})} />
                <InputGroup icon={User} type="text" placeholder="Admin Username" value={createData.adminUsername} onChange={e => setCreateData({...createData, adminUsername: e.target.value})} />
                <InputGroup icon={Mail} type="email" placeholder="Admin Email" value={createData.adminEmail} onChange={e => setCreateData({...createData, adminEmail: e.target.value})} />
                {/* Password with eye toggle */}
                <PasswordInputGroup
                  placeholder="Password"
                  value={createData.adminPassword}
                  onChange={e => setCreateData({...createData, adminPassword: e.target.value})}
                  show={showPassword}
                  onToggle={() => setShowPassword(v => !v)}
                />
                {/* Confirm Password with eye toggle */}
                <PasswordInputGroup
                  placeholder="Confirm Password"
                  value={createData.confirmPassword}
                  onChange={e => setCreateData({...createData, confirmPassword: e.target.value})}
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(v => !v)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed mt-2 animate-pulse-slow"
              >
                {loading ? 'Processing...' : 'Create Company'}
              </button>
            </form>
          </div>
        )}

        {/* Join Company Form */}
        {mode === 'join' && (
          <div className="animate-slideUp">
            <div className="text-center mb-8">
              <h2 className="text-lg font-bold text-white">Join Organization</h2>
              <p className="text-[#8e8e93] mt-1 text-xs">Enter your invitation details</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/25 rounded text-red-400 text-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleJoinCompany} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={joinData.companyCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinData({ ...joinData, companyCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-center text-xl font-mono tracking-[0.2em] text-white placeholder-[#636366] uppercase"
                  placeholder="CODE"
                  maxLength={10}
                />
                <p className="text-[10px] text-[#636366] mt-2 text-center font-mono">Ask your admin for this code</p>
              </div>

              <div className="space-y-4">
                <InputGroup icon={User} type="text" placeholder="Username" value={joinData.username} onChange={e => setJoinData({...joinData, username: e.target.value})} />
                <InputGroup icon={Mail} type="email" placeholder="Email" value={joinData.email} onChange={e => setJoinData({...joinData, email: e.target.value})} />
                <PasswordInputGroup
                  placeholder="Password"
                  value={joinData.password}
                  onChange={e => setJoinData({...joinData, password: e.target.value})}
                  show={showJoinPassword}
                  onToggle={() => setShowJoinPassword(v => !v)}
                />
                <PasswordInputGroup
                  placeholder="Confirm Password"
                  value={joinData.confirmPassword}
                  onChange={e => setJoinData({...joinData, confirmPassword: e.target.value})}
                  show={showJoinConfirmPassword}
                  onToggle={() => setShowJoinConfirmPassword(v => !v)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed mt-2 animate-pulse-slow"
              >
                {loading ? 'Verifying...' : 'Join Company'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for non-password inputs
interface InputGroupProps {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputGroup: React.FC<InputGroupProps> = ({ icon: Icon, type, placeholder, value, onChange }) => (
  <div className="relative group font-mono">
    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
    <input
      type={type}
      required
      value={value}
      onChange={onChange}
      className="w-full pl-11 pr-4 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs"
      placeholder={placeholder}
    />
  </div>
);

// Dedicated password input with show/hide eye toggle
interface PasswordInputGroupProps {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  onToggle: () => void;
}

const PasswordInputGroup: React.FC<PasswordInputGroupProps> = ({ placeholder, value, onChange, show, onToggle }) => (
  <div className="relative group font-mono">
    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366] group-focus-within:text-blue-400 transition-colors pointer-events-none" />
    <input
      type={show ? 'text' : 'password'}
      required
      value={value}
      onChange={onChange}
      className="w-full pl-11 pr-11 py-3 border border-white/[0.08] bg-[#141416] rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-white placeholder-[#636366] text-xs"
      placeholder={placeholder}
    />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-blue-400 transition-colors"
      tabIndex={-1}
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  </div>
);

export default CompanySetupPage;