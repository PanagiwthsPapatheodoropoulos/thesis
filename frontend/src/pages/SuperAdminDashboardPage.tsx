/**
 * @file SuperAdminDashboardPage.jsx
 * @description System-wide control panel exclusively for super admin users.
 */
// src/pages/SuperAdminDashboardPage.jsx - ORIGINAL LOGIC + NEW STYLING

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Trash2, Eye, Database, 
  TrendingUp, Shield, Search, Filter, Plus,
  AlertTriangle, CheckCircle, XCircle, ChevronRight,
  ArrowLeft, Activity, Calendar, BarChart3, Settings,
  LogOut, Zap, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Company, User } from '../types';

/**
 * SuperAdminDashboardPage Component
 * 
 * Allows managing top-level entities such as companies, global users,
 * and monitoring system health across all tenants.
 * 
 * @returns {React.ReactElement} The Super Admin dashboard UI.
 */
const SuperAdminDashboardPage = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [companyToDelete, setCompanyToDelete] = useState<any>(null);
  const [activeView, setActiveView] = useState('overview');
  const [companyData, setCompanyData] = useState<any>(null);
  
  // New state for the UI toggle
  const [viewAllTasks, setViewAllTasks] = useState<boolean>(false);
  
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompanies();
  }, []);

  /**
   * Fetches all registered companies in the system.
   * 
   * @async
   * @function fetchCompanies
   * @returns {Promise<void>}
   */
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/api/super-admin/companies', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch companies');
      
      const data = await response.json();
      setCompanies(data);
    } catch (error: any) {
      alert('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Drills down into a specific company to fetch its nested entities.
   * 
   * @async
   * @function viewCompanyDetails
   * @param {Object} company - The company to inspect.
   * @returns {Promise<void>}
   */
  const viewCompanyDetails = async (company) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
            
      const fetchWithFallback = async (url, label) => {
        try {
          const response = await fetch(url, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            return [];
          }
          
          const data = await response.json();
          return Array.isArray(data) ? data : [];
        } catch (error: any) {
          return [];
        }
      };

      const [users, tasks, employees, departments, teams] = await Promise.all([
        fetchWithFallback(`http://localhost:8080/api/super-admin/companies/${company.id}/users`, 'Users'),
        fetchWithFallback(`http://localhost:8080/api/super-admin/companies/${company.id}/tasks`, 'Tasks'),
        fetchWithFallback(`http://localhost:8080/api/super-admin/companies/${company.id}/employees`, 'Employees'),
        fetchWithFallback(`http://localhost:8080/api/super-admin/companies/${company.id}/departments`, 'Departments'),
        fetchWithFallback(`http://localhost:8080/api/super-admin/companies/${company.id}/teams`, 'Teams')
      ]);

      setCompanyData({
        ...company,
        users,
        tasks,
        employees,
        departments,
        teams
      });

      setSelectedCompany(company);
      setActiveView('company-detail');
      setViewAllTasks(false); // Reset view state when opening a company
    } catch (error: any) {
      alert('Failed to load company details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:8080/api/super-admin/companies/${companyToDelete.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to delete company');
      
      alert(`Company "${companyToDelete.name}" deleted successfully`);
      setShowDeleteModal(false);
      setCompanyToDelete(null);
      
      if (selectedCompany?.id === companyToDelete.id) {
        setActiveView('overview');
        setSelectedCompany(null);
        setCompanyData(null);
      }
      
      fetchCompanies();
    } catch (error: any) {
      alert('Failed to delete company: ' + error.message);
    }
  };

  const toggleCompanyActive = async (company) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:8080/api/super-admin/companies/${company.id}/toggle-active`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to toggle company status');
      
      const updatedCompany = await response.json();
      
      setCompanies(prevCompanies => 
        prevCompanies.map(c => 
          c.id === company.id ? { ...c, isActive: updatedCompany.isActive } : c
        )
      );

      if (companyData && companyData.id === company.id) {
        setCompanyData(prev => ({
          ...prev,
          isActive: updatedCompany.isActive
        }));
      }

    } catch (error: any) {
      alert('Failed to update company status');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backToOverview = () => {
    setActiveView('overview');
    setSelectedCompany(null);
    setCompanyData(null);
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.joinCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = companies.reduce((sum, c) => sum + (c.employeeCount || 0), 0);
  const activeCompanies = companies.filter(c => c.isActive).length;

  // --- NEW STYLING HELPERS ---
  const AtmosphericBackground = useMemo(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[150px] rounded-full"></div>
    </div>
  ), []);

  if (loading && !companyData) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#020617] relative">
        {AtmosphericBackground}
        <div className="text-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading System...</p>
        </div>
      </div>
    );
  }

  // --- VIEW: COMPANY DETAIL ---
  if (activeView === 'company-detail' && companyData) {
    const { users = [], tasks = [], employees = [], departments = [], teams = [] } = companyData;
    
    // Task Stats
    const tasksByStatus = tasks.reduce((acc, task) => {
      const status = task?.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="min-h-screen bg-[#020617] p-6 relative overflow-hidden selection:bg-indigo-500/30">
        {AtmosphericBackground}
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-8">
            <button
              onClick={backToOverview}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Back to Overview</span>
            </button>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0B0F19] border border-white/5 p-8 rounded-2xl relative overflow-hidden">
               {/* Decorative Gradient Line */}
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50"></div>

              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">{companyData.name}</h1>
                  <p className="text-slate-400 flex items-center gap-2">
                    Join Code: <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{companyData.joinCode}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${companyData.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                   {companyData.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                   <span className="font-medium">{companyData.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                
                <button
                  onClick={() => toggleCompanyActive(companyData)}
                  className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10 rounded-lg transition-all"
                >
                  Toggle Status
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <StatCard icon={Users} label="Total Users" value={users.length} color="blue" />
            <StatCard icon={Users} label="Employees" value={employees.length} color="purple" />
            <StatCard icon={Activity} label="Total Tasks" value={tasks.length} color="green" />
            <StatCard icon={Building2} label="Departments" value={departments.length} color="yellow" />
            <StatCard icon={Users} label="Teams" value={teams.length} color="pink" />
          </div>

          {/* Task Status Overview */}
          <div className="bg-[#0B0F19] rounded-2xl p-6 border border-white/5 mb-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Task Status Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <TaskStatusCard status="PENDING" count={tasksByStatus.PENDING || 0} />
              <TaskStatusCard status="IN_PROGRESS" count={tasksByStatus.IN_PROGRESS || 0} />
              <TaskStatusCard status="COMPLETED" count={tasksByStatus.COMPLETED || 0} />
              <TaskStatusCard status="BLOCKED" count={tasksByStatus.BLOCKED || 0} />
              <TaskStatusCard status="CANCELLED" count={tasksByStatus.CANCELLED || 0} />
            </div>
          </div>

          {/* Data Tables */}
          <div className="space-y-8">
            <DataTable
              title="Users"
              icon={Users}
              data={users}
              columns={['username', 'email', 'role']}
              labels={['Username', 'Email', 'Role']}
            />

            {/* TASKS TABLE with View All Logic */}
            <DataTable
              title="Tasks"
              icon={Activity}
              // Logic: Show full list if viewAllTasks is true, otherwise slice top 5
              data={viewAllTasks ? tasks : tasks.slice(0, 5)}
              columns={['title', 'status', 'priority', 'dueDate']}
              labels={['Title', 'Status', 'Priority', 'Due Date']}
              // Logic: Pass function only if there are enough tasks to warrant a button
              showAll={tasks.length > 5 ? () => setViewAllTasks(!viewAllTasks) : null}
              // Logic: Dynamic label
              viewAllLabel={viewAllTasks ? "Show Less" : "View All Tasks"}
            />

            <DataTable
              title="Employees"
              icon={Users}
              data={employees}
              columns={['firstName', 'lastName', 'position', 'department']}
              labels={['First Name', 'Last Name', 'Position', 'Department']}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <DataTable
                title="Departments"
                icon={Building2}
                data={departments}
                columns={['name', 'employeeCount', 'description']}
                labels={['Name', 'Employees', 'Description']}
                />

                <DataTable
                title="Teams"
                icon={Users}
                data={teams}
                columns={['name', 'memberCount', 'description']}
                labels={['Name', 'Members', 'Description']}
                />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: OVERVIEW ---
  return (
    <div className="min-h-screen bg-[#020617] p-6 relative overflow-hidden selection:bg-indigo-500/30">
      {AtmosphericBackground}
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                 <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Super Admin</h1>
            </div>
            <p className="text-slate-400">System-wide monitoring and company management</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <StatCard icon={Building2} label="Total Companies" value={companies.length} color="indigo" />
          <StatCard icon={CheckCircle} label="Active Companies" value={activeCompanies} color="green" />
          <StatCard icon={Users} label="Total Users" value={totalUsers} color="purple" />
          <StatCard icon={TrendingUp} label="System Health" value="98" color="green" isPercentage />
        </div>

        {/* Search Bar */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
          <div className="relative bg-[#0B0F19] rounded-xl border border-white/10 p-1 flex items-center">
            <div className="pl-4 pr-3 text-slate-500">
               <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Search companies by name or join code..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-white placeholder-slate-500 py-3 focus:outline-none"
            />
          </div>
        </div>

        {/* Companies List */}
        <div className="bg-[#0B0F19] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              Registered Companies <span className="text-slate-500 font-normal text-sm ml-2">({filteredCompanies.length})</span>
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="p-6 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5 flex-1">
                    <div className="w-14 h-14 bg-[#020617] border border-white/10 rounded-xl flex items-center justify-center group-hover:border-indigo-500/30 transition-colors">
                      <Building2 className="w-7 h-7 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{company.name}</h3>
                        {company.isActive ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded-full">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase font-bold tracking-wider rounded-full">Inactive</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> <span className="font-mono text-slate-400">{company.joinCode}</span></span>
                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {company.employeeCount || 0} Users</span>
                        <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {company.departmentCount || 0} Depts</span>
                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {company.teamCount || 0} Teams</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => viewCompanyDetails(company)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/10"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    
                    <button
                      onClick={() => {
                        setCompanyToDelete(company);
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2 bg-white/[0.05] hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/20 rounded-lg flex items-center gap-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCompanies.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-4">
                 <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-white font-medium mb-1">No companies found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search terms</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0F19] rounded-2xl p-8 max-w-md w-full border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                 <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Delete Company?</h3>
            </div>
            
            <p className="text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{companyToDelete?.name}</strong>? 
              <br/>
              This action creates a permanent data loss (users, tasks, teams) and cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCompanyToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl transition font-medium"
              >
                Cancel
              </button>
              
              <button
                onClick={handleDeleteCompany}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition font-bold shadow-lg shadow-red-500/20"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLED HELPER COMPONENTS ---

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  isPercentage?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color, isPercentage }) => {
  const colors = {
    indigo: 'text-indigo-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    yellow: 'text-amber-400',
    blue: 'text-blue-400',
    pink: 'text-pink-400'
  };

  return (
    <div className="bg-[#0B0F19] p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 bg-white/[0.03] rounded-xl group-hover:bg-white/[0.06] transition-colors ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {isPercentage && <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full">+2.4%</span>}
      </div>
      <p className="text-slate-400 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}{isPercentage && '%'}</p>
    </div>
  );
};

interface TaskStatusCardProps {
  status: string;
  count: number;
}

const TaskStatusCard: React.FC<TaskStatusCardProps> = ({ status, count }) => {
  const config = {
    PENDING: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
    IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
    COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
    BLOCKED: { label: 'Blocked', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
    CANCELLED: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20' }
  }[status] || { label: status, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' };

  return (
    <div className={`p-4 rounded-xl border ${config.border} ${config.bg} flex flex-col items-center justify-center text-center`}>
      <span className={`text-2xl font-bold ${config.color} mb-1`}>{count}</span>
      <span className={`text-xs uppercase tracking-wider font-semibold ${config.color} opacity-80`}>{config.label}</span>
    </div>
  );
};

interface DataTableProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: Array<Record<string, unknown>>;
  columns: string[];
  labels: string[];
  showAll?: (() => void) | null;
  viewAllLabel?: string;
}

const DataTable: React.FC<DataTableProps> = ({ title, icon: Icon, data, columns, labels, showAll, viewAllLabel }) => {
  return (
    <div className="bg-[#0B0F19] border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-3">
          <div className="w-8 h-8 bg-white/[0.05] rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4 text-indigo-400" />
          </div>
          {title} <span className="text-slate-500 text-sm font-normal">({data.length} shown)</span>
        </h2>
        {showAll && (
          <button
            onClick={showAll}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors"
          >
            {viewAllLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No records found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                {labels.map((label, idx) => (
                  <th key={idx} className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-6 py-4 text-sm text-slate-300">
                      {formatCellValue(item[col], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const formatCellValue = (value: any, column: string): React.ReactNode => {
  if (value === null || value === undefined) return <span className="text-slate-600">-</span>;
  
  if (column === 'dueDate' || column === 'createdAt') {
    return <span className="font-mono text-xs opacity-80">{new Date(value).toLocaleDateString()}</span>;
  }
  
  if (column === 'status') {
    const styles = {
      PENDING: 'text-amber-400',
      IN_PROGRESS: 'text-blue-400',
      COMPLETED: 'text-emerald-400',
      BLOCKED: 'text-red-400',
      CANCELLED: 'text-slate-500'
    }[value] || 'text-white';
    return <span className={`text-xs font-bold uppercase tracking-wide ${styles}`}>{value}</span>;
  }
  
  if (column === 'priority') {
    const styles = {
      LOW: 'text-emerald-400',
      MEDIUM: 'text-amber-400',
      HIGH: 'text-orange-400',
      CRITICAL: 'text-red-400'
    }[value] || 'text-white';
    return <span className={`text-xs font-bold ${styles}`}>{value}</span>;
  }
  
  if (column === 'role') {
    const styles = {
      ADMIN: 'text-red-400',
      MANAGER: 'text-amber-400',
      EMPLOYEE: 'text-emerald-400',
      USER: 'text-blue-400'
    }[value] || 'text-white';
    return <span className={`text-xs font-bold uppercase tracking-wide ${styles}`}>{value}</span>;
  }

  return value;
};

export default SuperAdminDashboardPage;