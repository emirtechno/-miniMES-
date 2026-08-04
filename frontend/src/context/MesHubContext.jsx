import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';

const API_ROOT = (import.meta.env.VITE_MES_API_URL || 'http://localhost:5000/api')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

const HUB_URL = `${API_ROOT}/hubs/mes`;

const MesHubContext = createContext(null);

export function MesHubProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({
    alarmCreated: new Set(),
    alarmUpdated: new Set(),
    alarmDeleted: new Set(),
    oeeUpdated: new Set(),
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = null;
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => sessionStorage.getItem('mm_access_token') || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    const emit = (bucket, payload) => {
      listenersRef.current[bucket].forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(error);
        }
      });
    };

    connection.on('alarmCreated', (alarm) => emit('alarmCreated', alarm));
    connection.on('alarmUpdated', (alarm) => emit('alarmUpdated', alarm));
    connection.on('alarmDeleted', (payload) => emit('alarmDeleted', payload));
    connection.on('oeeUpdated', (metrics) => emit('oeeUpdated', metrics));
    connection.onreconnecting(() => {
      if (!cancelled) setConnected(false);
    });
    connection.onreconnected(() => {
      if (!cancelled) setConnected(true);
    });
    connection.onclose(() => {
      if (!cancelled) setConnected(false);
    });

    // StrictMode remount / API restart: withAutomaticReconnect only helps after a
    // successful first start, so retry the initial handshake ourselves.
    // Defer start so React StrictMode's immediate unmount/remount does not abort
    // an in-flight negotiate (which leaves the badge stuck on "Bağlantı Yok").
    const startWithRetry = async (attempt = 0) => {
      if (cancelled) return;
      try {
        await connection.start();
        if (!cancelled) setConnected(true);
      } catch (error) {
        if (cancelled) return;
        setConnected(false);
        const message = String(error?.message || error);
        const abortedDuringNegotiate = /stopped during negotiation/i.test(message);
        if (!abortedDuringNegotiate) {
          console.warn('MES SignalR bağlantısı kurulamadı:', error);
        }
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
        retryTimer = window.setTimeout(() => startWithRetry(attempt + 1), delay);
      }
    };

    retryTimer = window.setTimeout(() => startWithRetry(0), 0);

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      setConnected(false);
      connection.stop().catch(() => undefined);
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((eventName, listener) => {
    const bucket = listenersRef.current[eventName];
    if (!bucket || typeof listener !== 'function') return () => undefined;
    bucket.add(listener);
    return () => bucket.delete(listener);
  }, []);

  const value = useMemo(() => ({ connected, subscribe, hubUrl: HUB_URL }), [connected, subscribe]);

  return <MesHubContext.Provider value={value}>{children}</MesHubContext.Provider>;
}

export function useMesHub(handlers = {}) {
  const context = useContext(MesHubContext);
  if (!context) {
    throw new Error('useMesHub must be used within MesHubProvider');
  }

  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const { subscribe } = context;
    const unsubscribers = [
      subscribe('alarmCreated', (payload) => handlersRef.current.onAlarmCreated?.(payload)),
      subscribe('alarmUpdated', (payload) => handlersRef.current.onAlarmUpdated?.(payload)),
      subscribe('alarmDeleted', (payload) => handlersRef.current.onAlarmDeleted?.(payload)),
      subscribe('oeeUpdated', (payload) => handlersRef.current.onOeeUpdated?.(payload)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [context]);

  return { connected: context.connected };
}
