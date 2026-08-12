import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';

const API_ROOT = (import.meta.env.VITE_MES_API_URL || 'http://localhost:5000/api')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

const HUB_URL = `${API_ROOT}/hubs/mes`;

const MesHubContext = createContext(null);

// NEDEN: Tek SignalR bağlantısı — AlarmPanel, Andon, useTelemetry, ShiftSession aynı hub'ı paylaşır.
// NASIL: JWT accessTokenFactory (sessionStorage); olaylar Set dinleyicilerine emit; useMesHub abone olur.
export function MesHubProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({
    alarmCreated: new Set(),
    alarmUpdated: new Set(),
    alarmDeleted: new Set(),
    oeeUpdated: new Set(),
    telemetryTick: new Set(),
    shiftUpdated: new Set(),
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      return undefined;
    }

    let disposed = false;
    let startRetryTimer = 0;

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        // NEDEN: WebSocket'te Authorization header zor; backend OnMessageReceived access_token query okur.
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
    connection.on('telemetryTick', (metric) => emit('telemetryTick', metric));
    connection.on('shiftUpdated', (session) => emit('shiftUpdated', session));
    // NEDEN: Reconnecting sırasında CANLI kalmasın — Andon "YENİDEN BAĞLANIYOR" göstersin.
    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));

    // NEDEN: İlk start API kapalıyken fail olursa withAutomaticReconnect çalışmaz;
    // backend tekrar açılınca hub sonsuza kadar kopuk kalırdı. Periyodik start retry.
    // NASIL: Yalnızca Disconnected iken start — Connecting/Connected iken yeniden start çağırma.
    const tryStart = () => {
      if (disposed) return;
      if (connection.state !== HubConnectionState.Disconnected) return;
      connection.start()
        .then(() => {
          if (!disposed) setConnected(true);
        })
        .catch((error) => {
          if (disposed) return;
          setConnected(false);
          console.warn('MES SignalR bağlantısı kurulamadı, yeniden denenecek:', error);
          window.clearTimeout(startRetryTimer);
          startRetryTimer = window.setTimeout(tryStart, 4000);
        });
    };
    tryStart();

    return () => {
      disposed = true;
      window.clearTimeout(startRetryTimer);
      connection.stop().catch(() => undefined);
      setConnected(false);
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

  // NEDEN: handlers her render değişebilir; ref ile subscribe effect'ini yeniden bağlamadan güncel tut.
  const handlersRef = useRef(handlers);
  const { connected, subscribe } = context;

  useEffect(() => {
    handlersRef.current = handlers;
  });

  // NEDEN: [context] connected her değişince tüm dinleyicileri koparıp yeniden bağlıyordu (Andon çökmesi).
  // NASIL: Yalnızca stabil subscribe callback'ine bağlan.
  useEffect(() => {
    const unsubscribers = [
      subscribe('alarmCreated', (payload) => handlersRef.current.onAlarmCreated?.(payload)),
      subscribe('alarmUpdated', (payload) => handlersRef.current.onAlarmUpdated?.(payload)),
      subscribe('alarmDeleted', (payload) => handlersRef.current.onAlarmDeleted?.(payload)),
      subscribe('oeeUpdated', (payload) => handlersRef.current.onOeeUpdated?.(payload)),
      subscribe('telemetryTick', (payload) => handlersRef.current.onTelemetryTick?.(payload)),
      subscribe('shiftUpdated', (payload) => handlersRef.current.onShiftUpdated?.(payload)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [subscribe]);

  return { connected };
}
