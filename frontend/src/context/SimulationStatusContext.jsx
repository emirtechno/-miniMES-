import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchSimulationStatus, setSimulationEnabled as apiSetSimulationEnabled } from '../services/api';

const SimulationStatusContext = createContext(null);

/**
 * Backend SimulationControls singleton — persists across refresh/restart.
 */
export const SimulationStatusProvider = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [enabled, setEnabled] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  const canRead = Boolean(
    currentUser?.permissions?.includes('metrics.read')
    || currentUser?.permissions?.includes('simulation.control'),
  );
  const canControl = Boolean(currentUser?.permissions?.includes('simulation.control'));

  const applyStatus = useCallback((status) => {
    if (!status || typeof status.enabled !== 'boolean') return;
    setEnabled(status.enabled);
    setUpdatedBy(status.updatedBy ?? null);
    setUpdatedAt(status.updatedAt ?? null);
  }, []);

  const refresh = useCallback(async (signal) => {
    if (!isAuthenticated || !canRead) {
      setEnabled(null);
      return null;
    }
    setLoading(true);
    try {
      const status = await fetchSimulationStatus({ signal });
      applyStatus(status);
      return status;
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error(error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyStatus, canRead, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !canRead) {
      setEnabled(null);
      return undefined;
    }
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = window.setInterval(() => refresh(controller.signal), 20000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [canRead, isAuthenticated, refresh]);

  const setEnabledRemote = useCallback(async (next) => {
    const status = await apiSetSimulationEnabled({ enabled: Boolean(next) });
    applyStatus(status);
    return status;
  }, [applyStatus]);

  const value = useMemo(() => ({
    enabled,
    updatedBy,
    updatedAt,
    loading,
    canRead,
    canControl,
    refresh,
    setEnabledRemote,
  }), [enabled, updatedBy, updatedAt, loading, canRead, canControl, refresh, setEnabledRemote]);

  return (
    <SimulationStatusContext.Provider value={value}>
      {children}
    </SimulationStatusContext.Provider>
  );
};

export const useSimulationStatus = () => {
  const ctx = useContext(SimulationStatusContext);
  if (!ctx) {
    throw new Error('useSimulationStatus must be used within SimulationStatusProvider');
  }
  return ctx;
};
