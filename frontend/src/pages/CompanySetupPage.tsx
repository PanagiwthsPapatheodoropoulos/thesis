/**
 * @file CompanySetupPage.jsx
 * @description Page component for joining an existing company or creating a new one.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Key, ArrowLeft, Sparkles, User, Mail, Lock } from 'lucide-react';
import { authAPI } from '../utils/api';


/**
 * CompanySetupPage Component
 * 
 * Provides dynamic forms for company creation (by an admin) and joining (by employees).
 * 
 * @returns {React.ReactElement} The company setup UI.
 */
const CompanySetupPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
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

      alert(`Company created! Your join code is: ${response.joinCode}\n\nShare this code with employees to join your company.`);
      
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
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* --- CLEAN ATMOSPHERIC BACKGROUND --- */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full"></div>
      </div>

      <button
        onClick={() => mode ? setMode(null) : navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-white px-4 py-2 rounded-lg transition-all hover:bg-white/5 z-50"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline font-medium text-sm">Back</span>
      </button>

      <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 animate-slideUp">
        
        {/* Mode Selection */}
        {!mode && (
          <div className="space-y-6">
            <div className="text-center mb-10">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Company Setup</h1>
              <p className="text-slate-500 mt-2">Initialize your workspace</p>
            </div>

            <button
              onClick={() => setMode('create')}
              className="w-full p-5 border border-white/10 bg-white/[0.02] rounded-xl hover:bg-white/[0.05] hover:border-indigo-500/50 transition-all group hover:-translate-y-1 duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors text-indigo-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">Create Company</h3>
                  <p className="text-sm text-slate-500">Register a new organization</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-5 border border-white/10 bg-white/[0.02] rounded-xl hover:bg-white/[0.05] hover:border-purple-500/50 transition-all group hover:-translate-y-1 duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors text-purple-400">
                  <Key className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition-colors">Join Company</h3>
                  <p className="text-sm text-slate-500">Enter via invitation code</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create Company Form */}
        {mode === 'create' && (
          <div className="animate-slideUp">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Create Organization</h2>
              <p className="text-slate-500 mt-1 text-sm">Set up your admin account</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-5">
              <div className="space-y-4">
                <InputGroup icon={Building2} type="text" placeholder="Company Name" value={createData.companyName} onChange={e => setCreateData({...createData, companyName: e.target.value})} />
                <InputGroup icon={User} type="text" placeholder="Admin Username" value={createData.adminUsername} onChange={e => setCreateData({...createData, adminUsername: e.target.value})} />
                <InputGroup icon={Mail} type="email" placeholder="Admin Email" value={createData.adminEmail} onChange={e => setCreateData({...createData, adminEmail: e.target.value})} />
                <InputGroup icon={Lock} type="password" placeholder="Password" value={createData.adminPassword} onChange={e => setCreateData({...createData, adminPassword: e.target.value})} />
                <InputGroup icon={Lock} type="password" placeholder="Confirm Password" value={createData.confirmPassword} onChange={e => setCreateData({...createData, confirmPassword: e.target.value})} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
              <h2 className="text-2xl font-bold text-white">Join Organization</h2>
              <p className="text-slate-500 mt-1 text-sm">Enter your invitation details</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <form onSubmit={handleJoinCompany} className="space-y-5">
              <div>
                <input
                  type="text"
                  required
                  value={joinData.companyCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinData({ ...joinData, companyCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-4 border border-purple-500/30 bg-[#020617] rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-center text-2xl font-mono tracking-[0.2em] text-white placeholder-slate-700 uppercase"
                  placeholder="CODE"
                  maxLength={10}
                />
                <p className="text-xs text-slate-500 mt-2 text-center">Ask your admin for this code</p>
              </div>

              <div className="space-y-4">
                <InputGroup icon={User} type="text" placeholder="Username" value={joinData.username} onChange={e => setJoinData({...joinData, username: e.target.value})} color="purple" />
                <InputGroup icon={Mail} type="email" placeholder="Email" value={joinData.email} onChange={e => setJoinData({...joinData, email: e.target.value})} color="purple" />
                <InputGroup icon={Lock} type="password" placeholder="Password" value={joinData.password} onChange={e => setJoinData({...joinData, password: e.target.value})} color="purple" />
                <InputGroup icon={Lock} type="password" placeholder="Confirm Password" value={joinData.confirmPassword} onChange={e => setJoinData({...joinData, confirmPassword: e.target.value})} color="purple" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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

// Helper component for cleaner inputs
interface InputGroupProps {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  color?: string;
}

const InputGroup: React.FC<InputGroupProps> = ({ icon: Icon, type, placeholder, value, onChange, color = 'indigo' }) => (
  <div className="relative group">
    <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-${color}-400 transition-colors pointer-events-none`} />
    <input
      type={type}
      required
      value={value}
      onChange={onChange}
      className={`w-full pl-12 pr-4 py-3.5 border border-white/10 bg-[#020617] rounded-xl focus:border-${color}-500 focus:ring-1 focus:ring-${color}-500 outline-none transition-all text-white placeholder-slate-600`}
      placeholder={placeholder}
    />
  </div>
);

export default CompanySetupPage;