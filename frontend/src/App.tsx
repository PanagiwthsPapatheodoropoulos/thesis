// src/App.tsx
/**
 * @fileoverview Root application component for Smart Allocation.
 * Defines the full client-side routing tree using React Router.
 * Organizes routes into public (unauthenticated) and protected (role-based) sections.
 * Manages session state clean-up and provides a global chatbot overlay.
 */
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketProvider';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import UserDashboardPage from './pages/UserDashboardPage';
import TasksPage from './pages/TasksPage';
import EmployeesPage from './pages/EmployeesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import TeamsPage from './pages/TeamsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import MainLayout from './components/MainLayout';
import LandingPage from './pages/LandingPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import WorkloadPage from './pages/WorkloadPage';
import CompanySetupPage from './pages/CompanySetupPage';
import AIInsightsPage from './pages/AIInsightsPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import LegalPage from './pages/LegalPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import type { ProtectedRouteProps } from './types';
import ChatbotWidget from './components/ChatbotWidget';


/**
 * Renders the global chatbot overlay conditionally.
 * The chatbot is hidden on the super admin dashboard and for SUPER_ADMIN role users.
 *
 * @returns {JSX.Element|null} The ChatbotWidget, or null if it should be hidden.
 */
const ConditionalChatbot: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Don't show chatbot on super admin page
  const hideChatbot = location.pathname === '/super-admin' || user?.role === 'SUPER_ADMIN';

  if (hideChatbot) {
    return null;
  }

  return <ChatbotWidget />;
};


/**
 * Guards a route by checking authentication state and optional role restrictions.
 * Shows a loading spinner while auth state is being restored from localStorage.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The components to render if access is granted.
 * @param {string[]} [props.allowedRoles] - Optional list of roles permitted to access this route.
 * @returns {JSX.Element} The child route, a loading spinner, or a redirect.
 */
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, loading, authReady } = useAuth();

  //Wait for both loading AND authReady
  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

/**
 * Renders the correct dashboard based on the authenticated user's role.
 * SUPER_ADMIN is redirected to the super admin panel, USER sees the personal dashboard,
 * and all other roles see the manager/admin dashboard.
 *
 * @returns {JSX.Element} The appropriate dashboard component wrapped in MainLayout.
 */
const DashboardRoute: React.FC = () => {
  const { user } = useAuth();

  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin" replace />;
  }


  if (user?.role === 'USER') {
    return (
      <MainLayout>
        <UserDashboardPage />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DashboardPage />
    </MainLayout>
  );
};

/**
 * Wraps the public landing page and redirects authenticated users to their dashboard.
 * Also clears stale localStorage data if landing is reached without an active session.
 *
 * @returns {JSX.Element} The LandingPage, or a redirect to /dashboard if logged in.
 */
const LandingPageWrapper: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const hasActiveSession = sessionStorage.getItem('activeSession');
    const currentPath = window.location.pathname;

    // Only clear if DEFINITELY no session
    if (currentPath === '/' && !user && !hasActiveSession) {
      localStorage.clear();
    }
  }, [user]);

  // Redirect logged-in users
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
};

/**
 * Root application component that provides all global context providers
 * and declares the React Router routing configuration.
 *
 * @returns {JSX.Element} The complete application tree.
 */
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPageWrapper />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/company-setup" element={<CompanySetupPage />} />
              <Route path="/legal" element={<LegalPage />} />

              {/* Protected Routes */}
              <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminDashboardPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardRoute /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><MainLayout><TasksPage /></MainLayout></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><MainLayout><EmployeesPage /></MainLayout></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute><MainLayout><EmployeeProfilePage /></MainLayout></ProtectedRoute>} />
              <Route path="/departments" element={<ProtectedRoute><MainLayout><DepartmentsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/workload" element={<ProtectedRoute><MainLayout><WorkloadPage /></MainLayout></ProtectedRoute>} />
              <Route path="/ai-insights" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}><MainLayout><AIInsightsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/teams" element={<ProtectedRoute><MainLayout><TeamsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/assignments" element={<ProtectedRoute><MainLayout><AssignmentsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><MainLayout><ChatPage /></MainLayout></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><MainLayout><NotificationsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />

              {/* Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ConditionalChatbot />
          </BrowserRouter>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;