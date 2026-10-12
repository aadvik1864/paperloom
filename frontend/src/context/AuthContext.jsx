import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AuthContext } from './auth';

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
  const generation = useRef(0);

  const fetchUser = useCallback(async () => {
    const version = ++generation.current;
    const token = localStorage.getItem('token');
    const current = () => version === generation.current && token === localStorage.getItem('token');
    if (!token) {
      setUser(null);
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      if (!current()) return;
      const u = res.data?.user ?? null;
      setUser(u);
      setSafeUser('user', u);
    } catch (error) {
      if (!current()) return;
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
      if (version === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    const invalidatePending = () => { ++generation.current; };
    const clearSession = () => {
      invalidatePending();
      setUser(null);
      setLoading(false);
    };
    const syncSession = (event) => {
      if (event.key === 'token') fetchUser();
    };
    window.addEventListener('paperloom:session-expired', clearSession);
    window.addEventListener('storage', syncSession);
    return () => {
      invalidatePending();
      window.removeEventListener('paperloom:session-expired', clearSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [fetchUser]);

  const login = async (profileName, password) => {
    const version = ++generation.current;
    const res = await api.post('/auth/login', { profile_name: profileName, password });
    if (version !== generation.current) return;
    localStorage.setItem('token', res.data.token);
    const u = res.data?.user ?? null;
    setSafeUser('user', u);
    setUser(u);
    setLoading(false);
    return res.data;
  };

  const logout = () => {
    ++generation.current;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
