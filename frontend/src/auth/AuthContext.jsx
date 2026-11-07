import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getToken, clearToken } from '../api/client.js';
import { meRequest, loginRequest, logoutRequest } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until the initial /me check completes, then 'authenticated' or 'anonymous'.
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) setStatus('anonymous');
        return;
      }
      try {
        const u = await meRequest();
        if (cancelled) return;
        setUser(u);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        clearToken();
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await loginRequest(email, password);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setUser(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
