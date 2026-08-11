import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
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
    connection.onreconnecting(() => {
      // #region agent log
      fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H3',location:'MesHubContext.jsx:onreconnecting',message:'SignalR reconnecting',data:{state:connection.state},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setConnected(false);
    });
    connection.onreconnected(() => {
      // #region agent log
      fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H3',location:'MesHubContext.jsx:onreconnected',message:'SignalR reconnected',data:{state:connection.state},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setConnected(true);
    });
    connection.onclose(() => setConnected(false));

    // NEDEN: İlk start API kapalıyken fail olursa withAutomaticReconnect çalışmaz;
    // backend tekrar açılınca hub sonsuza kadar kopuk kalırdı. Periyodik start retry.
    const tryStart = () => {
      if (disposed) return;
      // #region agent log
      fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H3',location:'MesHubContext.jsx:tryStart',message:'SignalR tryStart',data:{state:connection.state},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      connection.start()
        .then(() => {
          if (!disposed) setConnected(true);
        })
        .catch((error) => {
          if (disposed) return;
          setConnected(false);
          console.warn('MES SignalR bağlantısı kurulamadı, yeniden denenecek:', error);
          // #region agent log
          fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H3',location:'MesHubContext.jsx:tryStart.catch',message:'SignalR start failed',data:{errMessage:String(error?.message||error),state:connection.state},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H2',location:'MesHubContext.jsx:useMesHub.subscribeEffect',message:'useMesHub resubscribe',data:{connected:context.connected},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { subscribe } = context;
    const unsubscribers = [
      subscribe('alarmCreated', (payload) => handlersRef.current.onAlarmCreated?.(payload)),
      subscribe('alarmUpdated', (payload) => handlersRef.current.onAlarmUpdated?.(payload)),
      subscribe('alarmDeleted', (payload) => handlersRef.current.onAlarmDeleted?.(payload)),
      subscribe('oeeUpdated', (payload) => handlersRef.current.onOeeUpdated?.(payload)),
      subscribe('telemetryTick', (payload) => handlersRef.current.onTelemetryTick?.(payload)),
      subscribe('shiftUpdated', (payload) => handlersRef.current.onShiftUpdated?.(payload)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [context]);

  return { connected: context.connected };
}
