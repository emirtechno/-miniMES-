import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  endShiftSession,
  fetchActiveShiftSession,
  getApiErrorMessage,
  logMachineScrap,
  resumeShiftSession,
  startShiftSession,
  startShiftSetup,
  startShiftDowntime,
} from '../services/api';
import { useMesHub } from './MesHubContext';
import { DEFAULT_STATION } from '../constants/stations';
import { SHIFT_SCHEDULES } from '../constants/shifts';

const mapSummary = (session) => {
  if (!session?.summary) return null;
  return {
    operatorName: session.operatorName,
    shiftCode: session.shiftCode,
    stationId: session.stationId,
    durationMinutes: session.summary.durationMinutes ?? 0,
    scrapCount: session.summary.scrapLogQuantity ?? session.summary.nokCount ?? 0,
    goodCount: session.summary.goodCount ?? 0,
    actualCount: session.summary.actualCount ?? 0,
    nokCount: session.summary.nokCount ?? 0,
    downtimeSeconds: session.summary.downtimeSeconds ?? 0,
    oeePercent: typeof session.summary.oeePercent === 'number' ? session.summary.oeePercent : null,
    endedAt: session.endedAt || null,
  };
};

const mapSessionToShift = (session, fallbackStationId = DEFAULT_STATION) => {
  if (!session || session.status === 'Ended') {
    return {
      ...createDefaultShift(fallbackStationId),
      summary: mapSummary(session),
    };
  }

  return {
    active: true,
    onBreak: session.status === 'OnBreak',
    inSetup: session.status === 'InSetup',
    id: session.id,
    stationId: session.stationId || fallbackStationId,
    shiftCode: session.shiftCode || SHIFT_SCHEDULES[0].code,
    operatorName: session.operatorName || '',
    operatorId: session.userId || '',
    startedAt: session.startedAt,
    breakReason: session.breakReason || null,
    breakStartedAt:
      session.status === 'OnBreak'
        ? session.breakStartedAt || session.updatedAt || session.startedAt
        : null,
    setupStartedAt:
      session.status === 'InSetup'
        ? session.setupStartedAt || session.updatedAt || session.startedAt
        : null,
    activeWorkOrderId: session.activeWorkOrderId ?? null,
    scrapCount: session.summary?.scrapLogQuantity ?? 0,
    secondaryOperator: session.secondaryOperatorName || null,
    // NEDEN: Canlı oturum özeti (Good/NOK/OEE) GET /active veya SignalR shiftUpdated'dan gelir.
    summary: mapSummary(session),
    runtimeMode: session.runtimeMode || null,
    pauseReason: session.pauseReason || null,
    hasBlockingAlarms: Boolean(session.hasBlockingAlarms),
  };
};

export const createDefaultShift = (stationId = DEFAULT_STATION) => ({
  active: false,
  onBreak: false,
  inSetup: false,
  id: null,
  stationId: stationId || DEFAULT_STATION,
  shiftCode: SHIFT_SCHEDULES[0].code,
  operatorName: '',
  operatorId: '',
  secondaryOperator: null,
  startedAt: null,
  breakReason: null,
  breakStartedAt: null,
  setupStartedAt: null,
  scrapCount: 0,
  activeWorkOrderId: null,
  summary: null,
  runtimeMode: null,
  pauseReason: null,
  hasBlockingAlarms: false,
});

const ShiftSessionContext = createContext(null);

// NEDEN: Operatör vardiya oturumu (başlat/mola/setup/bitir) backend kaynağıdır — UI sadece yansıtır.
// Katalog OEE (Andon) ile karışmaz: oturum KPI'sı ShiftSessionAggregator; panolar /Oee/shift-current kullanır.
export const ShiftSessionProvider = ({ children, user, notify }) => {
  const [shift, setShift] = useState(() => createDefaultShift());
  const [nowTick, setNowTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const applySession = useCallback((session) => {
    setShift((current) => {
      const next = mapSessionToShift(session, current.stationId);
      // NEDEN: End/reload yarışında active null dönse bile son özet KPI kartında kalsın.
      if (!session && !next.active && current.summary && !next.summary) {
        return { ...next, summary: current.summary };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setShift(createDefaultShift());
      setHydrated(true);
      return undefined;
    }

    const controller = new AbortController();
    setHydrated(false);
    // NEDEN: Vardiya durumu backend'de; eski sessionStorage anahtarları temizlenir (çift kaynak olmasın).
    try {
      sessionStorage.removeItem(`mm_operator_shift_${user.id}`);
      sessionStorage.removeItem('mm_operator_shift_anon');
    } catch {
      // ignore
    }
    fetchActiveShiftSession({ signal: controller.signal })
      .then((session) => {
        applySession(session);
      })
      .catch((error) => {
        if (error.name === 'CanceledError' || error.name === 'AbortError') return;
        console.warn('Aktif vardiya yüklenemedi:', error);
        setShift(createDefaultShift());
      })
      .finally(() => setHydrated(true));

    return () => controller.abort();
  }, [applySession, user?.id]);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useMesHub({
    onShiftUpdated: (session) => {
      if (!session) return;
      const sameUser = !session.userId || session.userId === user?.id;
      if (!sameUser) return;
      applySession(session);
    },
  });

  const elapsedLabel = useMemo(() => {
    if (!shift.active || !shift.startedAt) return '—';
    const mins = Math.max(0, Math.floor((nowTick - new Date(shift.startedAt).getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const s = Math.max(0, Math.floor(((nowTick - new Date(shift.startedAt).getTime()) % 60000) / 1000));
    if (h > 0) return `${h}sa ${m}dk`;
    if (mins > 0) return `${m}dk ${s}sn`;
    return `${s}sn`;
  }, [shift.active, shift.startedAt, nowTick]);

  const setupElapsedLabel = useMemo(() => {
    if (!shift.inSetup || !shift.setupStartedAt) return null;
    const mins = Math.max(0, Math.floor((nowTick - new Date(shift.setupStartedAt).getTime()) / 60000));
    const s = Math.max(0, Math.floor(((nowTick - new Date(shift.setupStartedAt).getTime()) % 60000) / 1000));
    return mins > 0 ? `${mins}dk ${s}sn` : `${s}sn`;
  }, [shift.inSetup, shift.setupStartedAt, nowTick]);

  const startShift = useCallback(async (payload) => {
    try {
      const session = await startShiftSession({
        stationId: payload.stationId || shift.stationId,
        shiftCode: payload.shiftCode || shift.shiftCode,
        operatorName: payload.operatorName || user?.name || user?.username || 'Operatör',
      });
      applySession(session);
      if (session?.hasBlockingAlarms || (session?.runtimeMode && session.runtimeMode !== 'Running')) {
        notify?.(
          'Vardiya açıldı ama istasyon durakladı — açık engelleyici alarmları Andon’dan çözün veya Üretime Dön deneyin.',
          'error',
        );
      } else {
        notify?.('Vardiya başlatıldı — simülasyon Running.', 'success');
      }
      return true;
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Vardiya başlatılamadı.'), 'error');
      return false;
    }
  }, [applySession, notify, shift.shiftCode, shift.stationId, user]);

  const endShift = useCallback(async () => {
    if (!shift.id) {
      setShift((current) => createDefaultShift(current.stationId));
      return;
    }
    try {
      const session = await endShiftSession(shift.id);
      applySession(session);
      const scrap = session?.summary?.scrapLogQuantity ?? session?.summary?.nokCount ?? 0;
      notify?.(
        `Vardiya bitti · ${session?.summary?.durationMinutes ?? 0} dk · Fire(NOK): ${scrap}`,
        'info',
      );
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Vardiya bitirilemedi.'), 'error');
    }
  }, [applySession, notify, shift.id]);

  const setStationId = useCallback((stationId) => {
    setShift((current) => {
      if (current.active) return current;
      return { ...current, stationId };
    });
  }, []);

  const reportDowntime = useCallback(async ({ reasonCode, reasonName, isPlanned, emergency = false }) => {
    if (!shift.active || !shift.id) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return false;
    }
    try {
      const session = await startShiftDowntime(shift.id, {
        reasonCode,
        reasonName,
        isPlanned,
        emergency,
      });
      applySession(session);
      notify?.(emergency ? 'Acil arıza alarmı oluşturuldu.' : 'Duruş / mola kaydı alındı.', emergency ? 'error' : 'success');
      return true;
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Duruş kaydı oluşturulamadı.'), 'error');
      return false;
    }
  }, [applySession, notify, shift.active, shift.id]);

  const resumeProduction = useCallback(async () => {
    if (!shift.id) return false;
    try {
      const session = await resumeShiftSession(shift.id);
      applySession(session);
      if (session?.hasBlockingAlarms || (session?.runtimeMode && session.runtimeMode !== 'Running')) {
        notify?.(
          'Vardiya Active ama simülasyon hâlâ durakladı — açık engelleyici alarmları Andon’dan Çözüldü yapın.',
          'error',
        );
        return false;
      }
      notify?.('Üretime geri dönüldü — StationRuntime Running.', 'success');
      return true;
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Üretime dönülemedi. Engelleyici alarmları Andon’dan çözün.'), 'error');
      return false;
    }
  }, [applySession, notify, shift.id]);

  /** Backend'den vardiya + runtimeMode yenile (sim tick sonrası FE uyumsuzluğunu düzeltir). */
  const refreshShift = useCallback(async () => {
    if (!user?.id) return;
    try {
      const session = await fetchActiveShiftSession();
      applySession(session);
    } catch {
      // Arka plan yenileme hatalarını yok say
    }
  }, [applySession, user?.id]);

  const startSetup = useCallback(async () => {
    if (!shift.active || !shift.id) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return;
    }
    try {
      const session = await startShiftSetup(shift.id);
      applySession(session);
      notify?.('Setup / model değişimi zamanlayıcısı başladı.', 'info');
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Setup başlatılamadı.'), 'error');
    }
  }, [applySession, notify, shift.active, shift.id]);

  const logScrap = useCallback(async (count) => {
    const amount = Math.max(1, Number(count) || 1);
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return false;
    }
    try {
      await logMachineScrap({
        stationId: shift.stationId,
        quantity: amount,
        reasonCode: 'OPERATOR_SCRAP',
        shiftSessionId: shift.id || undefined,
      });
      setShift((current) => ({
        ...current,
        scrapCount: (current.scrapCount || 0) + amount,
      }));
      notify?.(`${amount} adet fire ScrapLogs + MachineMetrics’e yazıldı.`, 'info');
      return true;
    } catch (error) {
      notify?.(getApiErrorMessage(error, 'Fire kaydı oluşturulamadı.'), 'error');
      return false;
    }
  }, [notify, shift.active, shift.id, shift.stationId]);

  const loginSecondaryOperator = useCallback((pin, nameHint) => {
    setShift((current) => ({
      ...current,
      secondaryOperator: {
        pinMasked: `****${String(pin).slice(-2)}`,
        name: nameHint || `Operatör-${String(pin).slice(-4)}`,
        loggedAt: new Date().toISOString(),
      },
    }));
    notify?.('İkincil operatör giriş yaptı.', 'success');
  }, [notify]);

  useEffect(() => {
    if (!shift.active || !user?.id) return undefined;
    const timer = window.setInterval(() => {
      fetchActiveShiftSession()
        .then((session) => applySession(session))
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [applySession, shift.active, user?.id]);

  const value = useMemo(() => ({
    shift,
    hydrated,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    reportDowntime,
    resumeProduction,
    refreshShift,
    startSetup,
    logScrap,
    loginSecondaryOperator,
  }), [
    shift,
    hydrated,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    reportDowntime,
    resumeProduction,
    refreshShift,
    startSetup,
    logScrap,
    loginSecondaryOperator,
  ]);

  return (
    <ShiftSessionContext.Provider value={value}>
      {children}
    </ShiftSessionContext.Provider>
  );
};

export const useShiftSession = () => {
  const ctx = useContext(ShiftSessionContext);
  if (!ctx) {
    throw new Error('useShiftSession must be used within ShiftSessionProvider');
  }
  return ctx;
};
