import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAlarm } from '../services/api';
import { DEFAULT_STATION, getStationDisplayName } from '../constants/stations';
import { SHIFT_SCHEDULES } from '../constants/shifts';

const storageKey = (userId) => `mm_operator_shifts_${userId || 'anon'}`;
const legacyStorageKey = (userId) => `mm_operator_shift_${userId || 'anon'}`;

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
  sim: null,
});

const isStreamingShift = (entry) => Boolean(entry?.active && !entry.onBreak && !entry.inSetup);

const loadPersistedSession = (userId) => {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const focusedStationId = parsed.focusedStationId || DEFAULT_STATION;
      const shifts = {};
      for (const [stationId, entry] of Object.entries(parsed.shifts || {})) {
        shifts[stationId] = { ...createDefaultShift(stationId), ...entry, summary: null };
      }
      if (!shifts[focusedStationId]) {
        shifts[focusedStationId] = createDefaultShift(focusedStationId);
      }
      return { focusedStationId, shifts };
    }

    // Migrate single-shift session from older builds.
    const legacyRaw = sessionStorage.getItem(legacyStorageKey(userId));
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const stationId = legacy.stationId || DEFAULT_STATION;
      return {
        focusedStationId: stationId,
        shifts: {
          [stationId]: { ...createDefaultShift(stationId), ...legacy, summary: null },
        },
      };
    }
  } catch {
    // fall through
  }
  return {
    focusedStationId: DEFAULT_STATION,
    shifts: { [DEFAULT_STATION]: createDefaultShift() },
  };
};

const ShiftSessionContext = createContext(null);

export const ShiftSessionProvider = ({ children, user, notify, canCreateAlarms }) => {
  const [session, setSession] = useState(() => loadPersistedSession(user?.id));
  const [nowTick, setNowTick] = useState(0);
  const [factorySimActive, setFactorySimActive] = useState(false);

  const focusedStationId = session.focusedStationId;
  const shift = session.shifts[focusedStationId] || createDefaultShift(focusedStationId);

  useEffect(() => {
    const persistable = {
      focusedStationId: session.focusedStationId,
      shifts: {},
    };
    for (const [stationId, entry] of Object.entries(session.shifts)) {
      const { summary: _summary, ...rest } = entry;
      void _summary;
      persistable.shifts[stationId] = rest;
    }
    sessionStorage.setItem(storageKey(user?.id), JSON.stringify(persistable));
  }, [session, user?.id]);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeShifts = useMemo(
    () => Object.values(session.shifts).filter((entry) => entry.active),
    [session.shifts],
  );

  const streamingStations = useMemo(
    () => Object.values(session.shifts)
      .filter(isStreamingShift)
      .map((entry) => ({ stationId: entry.stationId, shiftCode: entry.shiftCode })),
    [session.shifts],
  );

  const activeShiftStationIds = useMemo(
    () => activeShifts.map((entry) => entry.stationId),
    [activeShifts],
  );

  const streamingStationIds = useMemo(
    () => streamingStations.map((entry) => entry.stationId),
    [streamingStations],
  );

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

  const updateFocusedShift = useCallback((updater) => {
    setSession((current) => {
      const stationId = current.focusedStationId;
      const existing = current.shifts[stationId] || createDefaultShift(stationId);
      const nextEntry = typeof updater === 'function' ? updater(existing) : updater;
      return {
        ...current,
        shifts: {
          ...current.shifts,
          [stationId]: nextEntry,
        },
      };
    });
  }, []);

  const startShift = useCallback((payload) => {
    const stationId = payload.stationId || DEFAULT_STATION;
    let totalActive = 1;
    setSession((current) => {
      const alreadyActiveElsewhere = Object.values(current.shifts).filter(
        (entry) => entry.active && entry.stationId !== stationId,
      ).length;
      totalActive = alreadyActiveElsewhere + 1;
      return {
        focusedStationId: stationId,
        shifts: {
          ...current.shifts,
          [stationId]: {
            ...(current.shifts[stationId] || createDefaultShift(stationId)),
            active: true,
            onBreak: false,
            inSetup: false,
            stationId,
            shiftCode: payload.shiftCode || SHIFT_SCHEDULES[0].code,
            operatorName: payload.operatorName || user?.name || user?.username || 'Operatör',
            operatorId: payload.operatorId || user?.username || user?.id || '',
            startedAt: new Date().toISOString(),
            breakReason: null,
            breakStartedAt: null,
            setupStartedAt: null,
            scrapCount: 0,
            secondaryOperator: null,
            summary: null,
            sim: payload.sim || null,
          },
        },
      };
    });
    if (payload.silent) return;
    notify?.(
      totalActive > 1
        ? `Vardiya başlatıldı (${getStationDisplayName(stationId)}) — ${totalActive} hat Live Stream’de.`
        : 'Vardiya başlatıldı — Live Stream (makine telemetrisi) açıldı.',
      'success',
    );
  }, [notify, user]);

  const startAllShifts = useCallback((payload) => {
    const stationIds = Array.isArray(payload?.stationIds)
      ? payload.stationIds.filter(Boolean)
      : [];
    const lineSims = payload?.lineSims || {};
    if (stationIds.length === 0) {
      notify?.('Başlatılacak üretim hattı yok.', 'error');
      return 0;
    }

    const operatorName = payload.operatorName || user?.name || user?.username || 'Operatör';
    const operatorId = payload.operatorId || user?.username || user?.id || '';
    const shiftCode = payload.shiftCode || SHIFT_SCHEDULES[0].code;
    const startedAt = new Date().toISOString();
    const focusId = stationIds[0];

    setSession((current) => {
      const nextShifts = { ...current.shifts };
      for (const stationId of stationIds) {
        nextShifts[stationId] = {
          ...(nextShifts[stationId] || createDefaultShift(stationId)),
          active: true,
          onBreak: false,
          inSetup: false,
          stationId,
          shiftCode,
          operatorName,
          operatorId,
          startedAt,
          breakReason: null,
          breakStartedAt: null,
          setupStartedAt: null,
          scrapCount: 0,
          secondaryOperator: null,
          summary: null,
          sim: lineSims[stationId] || null,
        };
      }
      return {
        focusedStationId: focusId,
        shifts: nextShifts,
      };
    });
    setFactorySimActive(Boolean(payload.factorySim));
    if (!payload.silent) {
      notify?.(
        `Fabrika simülasyonu: ${stationIds.length} üretim hattı Live Stream’de.`,
        'success',
      );
    }
    return stationIds.length;
  }, [notify, user]);

  const endShiftForStation = useCallback((stationId, options = {}) => {
    if (!stationId) return false;
    let ended = null;
    setSession((current) => {
      const existing = current.shifts[stationId];
      if (!existing?.active) return current;

      const mins = existing.startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(existing.startedAt).getTime()) / 60000))
        : 0;
      const remaining = Object.values(current.shifts).filter(
        (entry) => entry.active && entry.stationId !== stationId,
      ).length;
      const manualScrap = existing.scrapCount || 0;
      // Prefer MachineMetrics Σ Fire when caller provides it; fall back to manual tally.
      const metricsNok = Number.isFinite(Number(options.metricsNok))
        ? Math.max(0, Number(options.metricsNok))
        : null;
      const displayScrap = metricsNok ?? manualScrap;
      ended = {
        stationId,
        mins,
        scrapCount: displayScrap,
        manualScrapCount: manualScrap,
        remaining,
        auto: Boolean(options.autoComplete),
        lotNo: existing.sim?.lotNo,
        targetQuantity: existing.sim?.targetQuantity,
      };
      return {
        ...current,
        focusedStationId: current.focusedStationId === stationId && remaining > 0
          ? (Object.values(current.shifts).find((entry) => entry.active && entry.stationId !== stationId)?.stationId
            || current.focusedStationId)
          : current.focusedStationId,
        shifts: {
          ...current.shifts,
          [stationId]: {
            ...createDefaultShift(stationId),
            stationId,
            summary: {
              operatorName: existing.operatorName,
              shiftCode: existing.shiftCode,
              stationId: existing.stationId,
              durationMinutes: mins,
              scrapCount: displayScrap,
              manualScrapCount: manualScrap,
              metricsNok,
              endedAt: new Date().toISOString(),
              autoComplete: Boolean(options.autoComplete),
              lotNo: existing.sim?.lotNo,
              orderNo: existing.sim?.orderNo,
            },
          },
        },
      };
    });
    if (!ended) return false;
    if (ended.remaining === 0) {
      setFactorySimActive(false);
    }
    if (!options.silent) {
      const fireLabel = ended.manualScrapCount > 0 && ended.scrapCount !== ended.manualScrapCount
        ? `Σ Fire: ${ended.scrapCount} (manuel +${ended.manualScrapCount})`
        : `Σ Fire: ${ended.scrapCount}`;
      notify?.(
        ended.auto
          ? `Parti tamamlandı (${getStationDisplayName(ended.stationId)}${ended.lotNo ? ` · ${ended.lotNo}` : ''}${ended.targetQuantity ? ` · hedef ${ended.targetQuantity}` : ''}) — vardiya kapandı.${ended.remaining > 0 ? ` ${ended.remaining} hat devam ediyor.` : ''}`
          : ended.remaining > 0
            ? `Vardiya bitti (${getStationDisplayName(ended.stationId)}) · ${ended.mins} dk · ${fireLabel} · ${ended.remaining} hat hâlâ aktif`
            : `Vardiya bitti · Live Stream durduruldu · ${ended.mins} dk · ${fireLabel}`,
        ended.auto ? 'success' : 'info',
      );
    }
    return true;
  }, [notify]);

  const endShift = useCallback((options = {}) => {
    endShiftForStation(focusedStationId, options);
  }, [endShiftForStation, focusedStationId]);

  const endAllShifts = useCallback(() => {
    let count = 0;
    setSession((current) => {
      const nextShifts = { ...current.shifts };
      for (const [stationId, existing] of Object.entries(current.shifts)) {
        if (!existing?.active) continue;
        count += 1;
        const mins = existing.startedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(existing.startedAt).getTime()) / 60000))
          : 0;
        nextShifts[stationId] = {
          ...createDefaultShift(stationId),
          stationId,
          summary: {
            operatorName: existing.operatorName,
            shiftCode: existing.shiftCode,
            stationId: existing.stationId,
            durationMinutes: mins,
            scrapCount: existing.scrapCount,
            endedAt: new Date().toISOString(),
          },
        };
      }
      return {
        ...current,
        shifts: nextShifts,
      };
    });
    setFactorySimActive(false);
    if (count > 0) {
      notify?.(`Tüm hatlar durduruldu (${count} vardiya).`, 'info');
    }
    return count;
  }, [notify]);

  const setStationId = useCallback((stationId) => {
    if (!stationId) return;
    setSession((current) => ({
      focusedStationId: stationId,
      shifts: {
        ...current.shifts,
        [stationId]: current.shifts[stationId] || createDefaultShift(stationId),
      },
    }));
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
      updateFocusedShift((current) => ({
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
  }, [canCreateAlarms, notify, shift.active, shift.operatorId, shift.operatorName, shift.stationId, updateFocusedShift, user]);

  const resumeProduction = useCallback(() => {
    updateFocusedShift((current) => ({
      ...current,
      onBreak: false,
      inSetup: false,
      breakReason: null,
      breakStartedAt: null,
      setupStartedAt: null,
    }));
    notify?.('Üretime geri dönüldü.', 'success');
  }, [notify, updateFocusedShift]);

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
    updateFocusedShift((current) => ({
      ...current,
      inSetup: true,
      onBreak: false,
      setupStartedAt: new Date().toISOString(),
      breakReason: 'CHANGEOVER',
    }));
    notify?.('Setup / model değişimi zamanlayıcısı başladı.', 'info');
  }, [canCreateAlarms, notify, shift.active, shift.operatorName, shift.stationId, updateFocusedShift]);

  /** Local session tally of manual scrap entries (SSOT write happens via ingestManualScrap). */
  const logScrap = useCallback((count, { silent = false } = {}) => {
    const amount = Math.max(1, Number(count) || 1);
    updateFocusedShift((current) => ({
      ...current,
      scrapCount: (current.scrapCount || 0) + amount,
    }));
    if (!silent) {
      notify?.(`${amount} adet manuel fire oturuma işlendi.`, 'info');
    }
  }, [notify, updateFocusedShift]);

  const loginSecondaryOperator = useCallback((pin, nameHint) => {
    updateFocusedShift((current) => ({
      ...current,
      secondaryOperator: {
        pinMasked: `****${String(pin).slice(-2)}`,
        name: nameHint || `Operatör-${String(pin).slice(-4)}`,
        loggedAt: new Date().toISOString(),
      },
    }));
    notify?.('İkincil operatör giriş yaptı.', 'success');
  }, [notify, updateFocusedShift]);

  const value = useMemo(() => ({
    shift,
    focusedStationId,
    activeShifts,
    activeShiftCount: activeShifts.length,
    activeShiftStationIds,
    streamingStations,
    streamingStationIds,
    liveStreamActive: streamingStations.length > 0,
    factorySimActive,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    startAllShifts,
    endShift,
    endShiftForStation,
    endAllShifts,
    setStationId,
    reportDowntime,
    resumeProduction,
    startSetup,
    logScrap,
    loginSecondaryOperator,
  }), [
    shift,
    focusedStationId,
    activeShifts,
    activeShiftStationIds,
    streamingStations,
    streamingStationIds,
    factorySimActive,
    elapsedLabel,
    setupElapsedLabel,
    startShift,
    startAllShifts,
    endShift,
    endShiftForStation,
    endAllShifts,
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
