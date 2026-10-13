import { useState, useEffect, useCallback, useRef } from 'react';
import api, { sameOriginApi } from '../services/api';
import { changeSession, csrfToken, mutateSession, sessionStorageEvent, sessionVersion, signedOut } from '../services/session';
import { AuthContext } from './auth';

const LOGOUT_WARNING = 'Signed out of this page. Server sign-out could not be confirmed; the browser session may remain valid for up to one hour.';
const USER_KEY = 'user';

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('token');
    return null;
  }
}

function cacheUser(user) {
  if (user == null) {
    localStorage.removeItem(USER_KEY);
  } else {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => sameOriginApi && !signedOut() && csrfToken() ? readCachedUser() : null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const generation = useRef(0);

  const fetchUser = useCallback(async () => {
    const requestGeneration = ++generation.current;
    const startedSessionVersion = sessionVersion();
    const isCurrentSession = () => (
      requestGeneration === generation.current &&
      startedSessionVersion === sessionVersion() &&
      !signedOut()
    );
    localStorage.removeItem('token');
    if (!sameOriginApi || signedOut() || !csrfToken()) {
      setUser(null);
      cacheUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      if (!isCurrentSession()) return;
      const nextUser = res.data?.user ?? null;
      setUser(nextUser);
      cacheUser(nextUser);
    } catch (error) {
      if (!isCurrentSession()) return;
      if (error.response?.status === 401) {
        changeSession(true);
        cacheUser(null);
        setUser(null);
        return;
      }
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
      } else {
        cacheUser(null);
        setUser(null);
      }
    } finally {
      if (requestGeneration === generation.current) setLoading(false);
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
    const requestGeneration = ++generation.current;
    setSessionNotice('');
    const res = await mutateSession(() => api.post(
      '/auth/login',
      { profile_name: profileName, password },
      { allowSessionCookies: true },
    ));
    if (requestGeneration !== generation.current) return;
    changeSession(false);
    const nextUser = res.data?.user ?? null;
    cacheUser(nextUser);
    setUser(nextUser);
    setLoading(false);
    return res.data;
  };

  const logout = () => {
    const requestGeneration = ++generation.current;
    const csrf = csrfToken();
    setSessionNotice('');
    changeSession(true);
    setUser(null);
    setLoading(false);
    if (sameOriginApi && csrf) {
      return mutateSession(() => api.post('/auth/logout', {}, {
        headers: { 'X-CSRF-TOKEN': csrf },
        timeout: 5000,
        skipSessionExpiry: true,
        allowSessionCookies: true,
      })).catch(error => {
        if (requestGeneration === generation.current && error.response?.status !== 401) {
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
