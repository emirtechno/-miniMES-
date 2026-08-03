import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAlarm } from '../services/api';
import { DEFAULT_STATION } from '../constants/stations';
import { SHIFT_SCHEDULES } from '../constants/shifts';

const storageKey = (userId) => `mm_operator_shift_${userId || 'anon'}`;

export const createDefaultShift = (stationId = DEFAULT_STATION) => ({
  active: false,
  onBreak: false,
  inSetup: false,
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
  summary: null,
});

const ShiftSessionContext = createContext(null);

export const ShiftSessionProvider = ({ children, user, notify, canCreateAlarms }) => {
  const [shift, setShift] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(user?.id));
      if (raw) {
        return { ...createDefaultShift(), ...JSON.parse(raw), summary: null };
      }
    } catch {
      // fall through
    }
    return createDefaultShift();
  });

  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const { summary: _summary, ...persistable } = shift;
    void _summary;
    sessionStorage.setItem(storageKey(user?.id), JSON.stringify(persistable));
  }, [shift, user?.id]);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const startShift = useCallback((payload) => {
    setShift((current) => ({
      ...current,
      active: true,
      onBreak: false,
      inSetup: false,
      stationId: payload.stationId || current.stationId,
      shiftCode: payload.shiftCode || current.shiftCode,
      operatorName: payload.operatorName || user?.name || user?.username || 'Operatör',
      operatorId: payload.operatorId || user?.username || user?.id || '',
      startedAt: new Date().toISOString(),
      breakReason: null,
      breakStartedAt: null,
      setupStartedAt: null,
      scrapCount: 0,
      secondaryOperator: null,
      summary: null,
    }));
    notify?.('Vardiya başlatıldı — Live Stream (makine telemetrisi) açıldı.', 'success');
  }, [notify, user]);

  const endShift = useCallback(() => {
    setShift((current) => {
      const mins = current.startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 60000))
        : 0;
      const summary = {
        operatorName: current.operatorName,
        shiftCode: current.shiftCode,
        stationId: current.stationId,
        durationMinutes: mins,
        scrapCount: current.scrapCount,
        endedAt: new Date().toISOString(),
      };
      notify?.(
        `Vardiya bitti · Live Stream durduruldu · ${mins} dk · Fire: ${current.scrapCount}`,
        'info',
      );
      return {
        ...createDefaultShift(current.stationId),
        stationId: current.stationId,
        summary,
      };
    });
  }, [notify]);

  const setStationId = useCallback((stationId) => {
    setShift((current) => {
      if (current.active) return current;
      return { ...current, stationId };
    });
  }, []);

  const reportDowntime = useCallback(async ({ reasonCode, reasonName, isPlanned, emergency = false }) => {
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return false;
    }
    try {
      if (canCreateAlarms) {
        await createAlarm({
          title: emergency
            ? `ARIZA / ACİL — ${reasonName || reasonCode}`
            : `Duruş Bildirimi — ${reasonName || reasonCode}`,
          station: shift.stationId,
          severity: emergency ? 'Kritik' : (isPlanned ? 'Uyarı' : 'Yüksek'),
          description: `Operatör ${shift.operatorName || user?.name || ''} (${shift.operatorId || ''}) duruş kaydı oluşturdu.`,
        });
      }
      setShift((current) => ({
        ...current,
        onBreak: true,
        inSetup: false,
        breakReason: reasonCode,
        breakStartedAt: new Date().toISOString(),
      }));
      notify?.(emergency ? 'Acil arıza alarmı oluşturuldu.' : 'Duruş / mola kaydı alındı.', emergency ? 'error' : 'success');
      return true;
    } catch (error) {
      notify?.(error?.message || 'Duruş kaydı oluşturulamadı.', 'error');
      return false;
    }
  }, [canCreateAlarms, notify, shift.active, shift.operatorId, shift.operatorName, shift.stationId, user]);

  const resumeProduction = useCallback(() => {
    setShift((current) => ({
      ...current,
      onBreak: false,
      inSetup: false,
      breakReason: null,
      breakStartedAt: null,
      setupStartedAt: null,
    }));
    notify?.('Üretime geri dönüldü.', 'success');
  }, [notify]);

  const startSetup = useCallback(async () => {
    if (!shift.active) {
      notify?.('Önce vardiyayı başlatın.', 'error');
      return;
    }
    if (canCreateAlarms) {
      try {
        await createAlarm({
          title: 'Model Değişimi / Setup',
          station: shift.stationId,
          severity: 'Uyarı',
          description: `Setup timer başlatıldı — ${shift.operatorName || 'Operatör'}`,
        });
      } catch {
        // local setup still starts
      }
    }
    setShift((current) => ({
      ...current,
      inSetup: true,
      onBreak: false,
      setupStartedAt: new Date().toISOString(),
      breakReason: 'CHANGEOVER',
    }));
    notify?.('Setup / model değişimi zamanlayıcısı başladı.', 'info');
  }, [canCreateAlarms, notify, shift.active, shift.operatorName, shift.stationId]);

  const logScrap = useCallback((count) => {
    const amount = Math.max(1, Number(count) || 1);
    setShift((current) => ({
      ...current,
      scrapCount: (current.scrapCount || 0) + amount,
    }));
    notify?.(`${amount} adet fire kaydedildi.`, 'info');
  }, [notify]);

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

  const value = useMemo(() => ({
    shift,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    reportDowntime,
    resumeProduction,
    startSetup,
    logScrap,
    loginSecondaryOperator,
  }), [
    shift,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    endShift,
    setStationId,
    reportDowntime,
    resumeProduction,
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
