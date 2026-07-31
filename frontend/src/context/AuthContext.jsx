import { createContext, useContext, useState } from 'react';
import { login as requestLogin } from '../services/api';

const AuthContext = createContext(null);

const getStoredUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem('mm_auth_user') || 'null');
    const expiresAt = localStorage.getItem('mm_token_expires_at');
    return user && expiresAt && new Date(expiresAt) > new Date() ? user : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [users, setUsers] = useState(() => getStoredUser() ? [getStoredUser()] : []);
  const [activeUserId, setActiveUserId] = useState(() => getStoredUser()?.id ?? null);

  const login = async (username, password) => {
    const response = await requestLogin(username, password);
    if (!response?.success || !response.data) {
      throw new Error(response?.message || 'Giriş başarısız.');
    }

    const data = response.data;
    const user = {
      id: data.username,
      name: data.displayName,
      role: data.role,
      permission: data.permission,
      status: 'Aktif',
    };

    localStorage.setItem('mm_access_token', data.accessToken);
    localStorage.setItem('mm_token_expires_at', data.expiresAtUtc);
    localStorage.setItem('mm_auth_user', JSON.stringify(user));
    setCurrentUser(user);
    setUsers([user]);
    setActiveUserId(user.id);
  };

  const logout = () => {
    localStorage.removeItem('mm_access_token');
    localStorage.removeItem('mm_token_expires_at');
    localStorage.removeItem('mm_auth_user');
    setCurrentUser(null);
    setUsers([]);
    setActiveUserId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        users,
        setUsers,
        currentUser,
        activeUserId,
        setActiveUserId,
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
