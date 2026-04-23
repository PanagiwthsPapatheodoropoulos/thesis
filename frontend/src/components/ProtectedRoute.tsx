/**
 * @fileoverview ProtectedRoute - Auth-guarded route wrapper.
 * 
 * Intercepts navigation to private routes and ensures the user is authenticated
 * and has the required role(s). Redirects to /login if no session exists, 
 * or to /dashboard if the user lacks the necessary permissions.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ProtectedRouteProps } from '../types';

/**
 * Higher-order component representing a route guard.
 *
 * @component
 * @param {Object}   props              - Component props.
 * @param {React.ReactNode} props.children - Component(s) to render if auth check passes.
 * @param {string[]} [props.allowedRoles] - Optional list of user roles permitted on this route.
 * @returns {JSX.Element} The children if allowed, or a redirect component.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading, authReady } = useAuth();

  // Wait until AuthContext has restored session
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

  // No user → go to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role restriction
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Auth OK
  return children;
};

export default ProtectedRoute;
