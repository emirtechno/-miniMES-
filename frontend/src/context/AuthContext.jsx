import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const defaultUsers = [
  { id: 1, name: 'Ahmet Yılmaz', role: 'Operatör', status: 'Aktif', permission: 'Üretim Girişi' },
  { id: 2, name: 'Elif Demir', role: 'Kalite', status: 'Aktif', permission: 'Kalite Onayı' },
  { id: 3, name: 'Mert Kaya', role: 'Saha Müdürü', status: 'Aktif', permission: 'Tam Yetki' },
  { id: 4, name: 'Buse Aksoy', role: 'Bakım', status: 'Pasif', permission: 'Rapor Görüntüleme' },
];

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    try {
      const stored = localStorage.getItem('mm_users');
      return stored ? JSON.parse(stored) : defaultUsers;
    } catch {
      return defaultUsers;
    }
  });

  const [activeUserId, setActiveUserId] = useState(() => {
    try {
      const stored = localStorage.getItem('mm_activeUserId');
      return stored ? parseInt(stored, 10) : 1;
    } catch {
      return 1;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('mm_isAuth') === 'true';
  });

  const currentUser = users.find((u) => u.id === activeUserId) || users[0];

  useEffect(() => {
    localStorage.setItem('mm_users', JSON.stringify(users));
    localStorage.setItem('mm_activeUserId', String(activeUserId));
    localStorage.setItem('mm_isAuth', String(isAuthenticated));
  }, [users, activeUserId, isAuthenticated]);

  const login = (userId) => {
    setActiveUserId(userId);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        users,
        setUsers,
        currentUser,
        activeUserId,
        setActiveUserId,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);