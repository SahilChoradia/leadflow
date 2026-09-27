import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthUser } from '@leadflow/types';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login:  (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadPersistedUser(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('lf_token');
    const user  = JSON.parse(localStorage.getItem('lf_user') ?? 'null') as AuthUser | null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedUser();
  const [user,  setUser]  = useState<AuthUser | null>(persisted.user);
  const [token, setToken] = useState<string | null>(persisted.token);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await api.post<{ success: boolean; data: { token: string; user: AuthUser } }>(
      '/auth/login',
      { email, password },
    );
    const { token: t, user: u } = res.data.data;
    localStorage.setItem('lf_token', t);
    localStorage.setItem('lf_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
