import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProductionRecord,
  fetchProductionRecords,
  getApiErrorMessage,
  updateProductionRecord,
} from '../services/api';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';
import { ACTIVE_STATION_DEFINITIONS } from '../constants/stations';
import { deriveLiveTelemetry, detectTelemetryAnomalies } from '../utils/liveTelemetry';

const ACTIVE_STATIONS = ACTIVE_STATION_DEFINITIONS.map((station) => station.id);

/**
 * Immutable production telemetry store.
 * Records are written only by the Live Stream engine (sensor/PLC stand-in), never by manual forms.
 */
export function useProduction({
  isAuthenticated,
  canIngestTelemetry,
  autoRefresh,
  factorySimulationActive,
  simulationStationId,
  onSimulatedAnomalies,
  notify,
}) {
  const [records, setRecords] = useState([]);
  const [nextProductionCursor, setNextProductionCursor] = useState(null);
  const [loadingMoreRecords, setLoadingMoreRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const productionRequestIdRef = useRef(0);

  const fetchRecords = useCallback(async (signal, { background = false } = {}) => {
    const requestId = ++productionRequestIdRef.current;
    try {
      if (!background) setLoading(true);
      const page = await fetchProductionRecords({ signal });
      if (requestId !== productionRequestIdRef.current) return;
      const activeItems = page.items.filter((r) => !(r?.isDeleted ?? r?.IsDeleted ?? false));
      if (background) {
        setRecords((current) => {
          const latestIds = new Set(activeItems.map((record) => record.id));
          return [...activeItems, ...current.filter((record) => !latestIds.has(record.id))];
        });
      } else {
        setRecords(activeItems);
        setNextProductionCursor(page.nextCursor);
      }
      setError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (requestId === productionRequestIdRef.current) {
        setError(getApiErrorMessage(err, 'API bağlantısı başarısız oldu.'));
      }
      console.error(err);
    } finally {
      if (!background && requestId === productionRequestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMoreRecords = useCallback(async () => {
    if (!nextProductionCursor || loadingMoreRecords) return;
    setLoadingMoreRecords(true);
    try {
      const page = await fetchProductionRecords({ cursor: nextProductionCursor });
      setRecords((current) => {
        const ids = new Set(current.map((record) => record.id));
        return [...current, ...page.items.filter((record) => !ids.has(record.id))];
      });
      setNextProductionCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Daha fazla kayıt yüklenemedi.'));
    } finally {
      setLoadingMoreRecords(false);
    }
  }, [loadingMoreRecords, nextProductionCursor]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    fetchRecords(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, fetchRecords]);

  useNonOverlappingPolling(
    (signal) => fetchRecords(signal, { background: true }),
    {
      enabled: isAuthenticated && autoRefresh,
      intervalMs: 8000,
      runImmediately: false,
    },
  );

  // Shift-driven Live Stream: emit sensor-like production events + Andon anomalies.
  useNonOverlappingPolling(async (signal) => {
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const focusedStation = simulationStationId
      && simulationStationId !== 'Tümü'
      && ACTIVE_STATIONS.includes(simulationStationId)
      ? simulationStationId
      : ACTIVE_STATIONS[Math.floor(Math.random() * ACTIVE_STATIONS.length)];
    const kaliteDurumu = Math.random() > 0.15 ? 'OK' : 'NOK';
    const downtimeSeconds = Math.floor(Math.random() * 70);
    const actual = Math.floor(100 + Math.random() * 40);
    const good = kaliteDurumu === 'OK'
      ? actual - Math.floor(Math.random() * 4)
      : Math.max(0, actual - Math.floor(8 + Math.random() * 12));

    await createProductionRecord({
      urun20liKod: timestamp + random7,
      malzeme12liKod: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      istasyonAdi: focusedStation,
      kaliteDurumu,
      uretimTarihi: new Date().toISOString(),
    }, { signal });

    const telemetry = deriveLiveTelemetry(
      {
        downtimeSeconds,
        actualProductionCount: actual,
        goodProductionCount: good,
        idealCycleTimeSeconds: 2,
      },
      Date.now(),
      true,
    );
    const anomalies = detectTelemetryAnomalies(telemetry, { nokSpike: kaliteDurumu === 'NOK' });
    if (anomalies.length && typeof onSimulatedAnomalies === 'function') {
      try {
        await onSimulatedAnomalies(focusedStation, anomalies, { signal });
      } catch (err) {
        console.error(err);
      }
    }

    await fetchRecords(signal, { background: true });
  }, {
    enabled: factorySimulationActive && canIngestTelemetry,
    intervalMs: 10000,
    runImmediately: true,
    resetKey: `${simulationStationId || ''}:${factorySimulationActive}`,
  });

  const handleToggleQuality = useCallback(async (record) => {
    const newStatus = record.kaliteDurumu === 'OK' ? 'NOK' : 'OK';
    try {
      const res = await updateProductionRecord(record.id, {
        ...record,
        kaliteDurumu: newStatus,
      });
      if (res.success !== false) {
        await fetchRecords();
      } else {
        notify(`Güncelleme Başarısız: ${res.message}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Güncelleme başarısız.'), 'error');
      console.error(err);
    }
  }, [fetchRecords, notify]);

  return {
    records,
    loading,
    error,
    nextProductionCursor,
    loadingMoreRecords,
    loadMoreRecords,
    fetchRecords,
    handleToggleQuality,
  };
}
