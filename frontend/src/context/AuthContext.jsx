import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCurrentUser, login as requestLogin } from '../services/api';

const AuthContext = createContext(null);

const clearSession = () => {
  sessionStorage.removeItem('mm_access_token');
  sessionStorage.removeItem('mm_token_expires_at');
  sessionStorage.removeItem('mm_auth_user');
  localStorage.removeItem('mm_access_token');
  localStorage.removeItem('mm_token_expires_at');
  localStorage.removeItem('mm_auth_user');
  localStorage.removeItem('mm_users');
};

const toUser = (data) => ({
  id: data.userId,
  username: data.username,
  name: data.displayName,
  roles: data.roles || [],
  permissions: data.permissions || [],
  role: data.roles?.[0] || '',
  status: data.isActive ? 'Aktif' : 'Pasif',
});

const getStoredSession = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('mm_auth_user') || 'null');
    const expiresAt = sessionStorage.getItem('mm_token_expires_at');
    const token = sessionStorage.getItem('mm_access_token');
    if (user && token && expiresAt && new Date(expiresAt) > new Date()) {
      return { user, expiresAt };
    }
  } catch {
    // Invalid session data is cleared below.
  }
  clearSession();
  return { user: null, expiresAt: null };
};

export const AuthProvider = ({ children }) => {
  const initialSession = getStoredSession();
  const [currentUser, setCurrentUser] = useState(initialSession.user);
  const [expiresAt, setExpiresAt] = useState(initialSession.expiresAt);
  const currentUserId = currentUser?.id;

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setExpiresAt(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mm:unauthorized', logout);
    return () => window.removeEventListener('mm:unauthorized', logout);
  }, [logout]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      logout();
      return undefined;
    }
    const timer = window.setTimeout(logout, remainingMs);
    return () => window.clearTimeout(timer);
  }, [expiresAt, logout]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchCurrentUser()
      .then((data) => {
        const user = toUser(data);
        sessionStorage.setItem('mm_auth_user', JSON.stringify(user));
        setCurrentUser(user);
      })
      .catch(() => {
        // The response interceptor handles an unauthorized session.
      });
  }, [currentUserId]);

  const login = async (username, password) => {
    const data = await requestLogin(username, password);
    const user = toUser(data);

    sessionStorage.setItem('mm_access_token', data.accessToken);
    sessionStorage.setItem('mm_token_expires_at', data.expiresAtUtc);
    sessionStorage.setItem('mm_auth_user', JSON.stringify(user));
    setCurrentUser(user);
    setExpiresAt(data.expiresAtUtc);
    return user;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
