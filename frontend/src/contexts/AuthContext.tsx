// src/contexts/AuthContext.tsx
/**
 * @fileoverview Authentication context for managing global user session state.
 * Persists auth credentials to localStorage on login and clears them on logout.
 * Exposes a custom hook, useAuth, for consuming the context in child components.
 */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthContextType, User } from '../types';
import { API_BASE } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component that wraps the application and supplies auth state.
 * On mount, attempts to restore any previously saved session from localStorage.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components that will have access to auth context.
 * @returns {JSX.Element} The context provider.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  /** authReady signals that the initial localStorage restoration attempt is complete. */
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      setAuthReady(false);
      
      try {
        const response = await fetch(`${API_BASE}/auth/me`, { credentials: "same-origin" });
        if (response.ok) {
          const userData: User = await response.json();
          setUser(userData);
          setToken("cookie-based"); // dummy token for type compatibility
          localStorage.setItem('user', JSON.stringify(userData));
          sessionStorage.setItem('activeSession', 'true');
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('user');
          sessionStorage.clear();
        }
      } catch (error) {
        // Network error - fallback to local storage if available for offline functionality
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            setToken("cookie-based");
          }
        } catch (e) {
          // Corrupt storage state
          localStorage.clear();
          sessionStorage.clear();
        }
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    };

    initAuth();
  }, []);

  /**
   * Stores user credentials in state and localStorage after a successful login.
   *
   * @param {User} userData - The authenticated user object from the API.
   * @param {string} authToken - The JWT token for subsequent API requests.
   */
  const login = (userData: User, authToken: string, refreshToken?: string): void => {     
    setUser(userData);
    setToken("cookie-based"); // We don't need tokens in JS memory anymore
    setAuthReady(true);
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('activeSession', 'true');
  };

  /**
   * Clears all session data and disconnects any active WebSocket connections.
   */
  const logout = async (): Promise<void> => {
    try {
      const { authAPI } = await import('../utils/api');
      await authAPI.logout();
    } catch (e) {
      console.log('Backend logout failed:', e);
    }
    try {
      if (window.stompClient) {
        window.stompClient.deactivate();
      }
    } catch (e: unknown) {
      console.log('WebSocket cleanup:', (e as Error).message);
    }

    setUser(null);
    setToken(null);
    // After explicit logout, auth state is resolved (no session), so guards can redirect.
    setLoading(false);
    setAuthReady(true);
    localStorage.clear();
    sessionStorage.clear();
  };

  /**
   * Merges partial user data into the current user state and persists the change.
   * Used after profile updates without requiring a full re-login.
   *
   * @param {Partial<User>} updatedData - The fields to merge into the current user object.
   */
  const updateUser = (updatedData: Partial<User>): void => {
    const newUser = { ...user, ...updatedData } as User;
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authReady,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook for consuming the AuthContext.
 * Must be called within a component that is a descendant of AuthProvider.
 *
 * @returns {{ user: User|null, token: string|null, loading: boolean, authReady: boolean, login: (userData: User, authToken: string, refreshToken?: string) => void, logout: Function, updateUser: Function }}
 * @throws {Error} If called outside of an AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};