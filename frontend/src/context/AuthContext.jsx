import { useState, useEffect, useCallback, useRef } from 'react';
import api, { sameOriginApi } from '../services/api';
import { changeSession, csrfToken, mutateSession, sessionStorageEvent, sessionVersion, signedOut } from '../services/session';
import { AuthContext } from './auth';

const LOGOUT_WARNING = 'Signed out of this page. Server sign-out could not be confirmed; the browser session may remain valid for up to one hour.';

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
  const [user, setUser] = useState(() => sameOriginApi && !signedOut() && csrfToken() ? getSafeUser('user') : null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const generation = useRef(0);

  const fetchUser = useCallback(async () => {
    const version = ++generation.current;
    const session = sessionVersion();
    const current = () => version === generation.current && session === sessionVersion() && !signedOut();
    localStorage.removeItem('token');
    if (!sameOriginApi || signedOut() || !csrfToken()) {
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
        changeSession(true);
        localStorage.removeItem('user');
        setUser(null);
        return;
      }
      const cached = getSafeUser('user');
      if (cached) {
        setUser(cached);
      } else {
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
      if (sessionStorageEvent(event)) fetchUser();
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
    if (!sameOriginApi) throw new Error('Use the main website to sign in.');
    const version = ++generation.current;
    setSessionNotice('');
    const res = await mutateSession(() => api.post('/auth/login', { profile_name: profileName, password }, { allowSessionCookies: true }));
    if (version !== generation.current) return;
    changeSession(false);
    const u = res.data?.user ?? null;
    setSafeUser('user', u);
    setUser(u);
    setLoading(false);
    return res.data;
  };

  const logout = () => {
    const version = ++generation.current;
    const csrf = csrfToken();
    setSessionNotice('');
    changeSession(true);
    setUser(null);
    setLoading(false);
    if (sameOriginApi && csrf) {
      return mutateSession(() => api.post('/auth/logout', {}, {
        headers: { 'X-CSRF-TOKEN': csrf }, timeout: 5000, skipSessionExpiry: true, allowSessionCookies: true,
      })).catch(error => {
        if (version === generation.current && error.response?.status !== 401) {
          setSessionNotice(LOGOUT_WARNING);
        }
      });
    }
    if (user) setSessionNotice(LOGOUT_WARNING);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchUser, sessionNotice }}>
      {children}
    </AuthContext.Provider>
  );
}
