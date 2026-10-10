import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function getSafeUser(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(key);
    localStorage.removeItem('token');
    return null;
  }
}

function setSafeUser(key, value) {
  if (value == null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSafeUser('user'));
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      const u = res.data?.user ?? null;
      setUser(u);
      setSafeUser('user', u);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        return;
      }
      const cached = getSafeUser('user');
      if (cached) {
        setUser(cached);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    const clearSession = () => setUser(null);
    window.addEventListener('paperloom:session-expired', clearSession);
    return () => window.removeEventListener('paperloom:session-expired', clearSession);
  }, [fetchUser]);

  const login = async (profileName, password) => {
    const res = await api.post('/auth/login', { profile_name: profileName, password });
    localStorage.setItem('token', res.data.token);
    const u = res.data?.user ?? null;
    setSafeUser('user', u);
    setUser(u);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
