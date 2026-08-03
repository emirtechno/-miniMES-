import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createMachineMetric,
  fetchMachineMetrics,
  fetchTelemetrySummary,
  getApiErrorMessage,
} from '../services/api';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';
import { deriveLiveTelemetry, detectTelemetryAnomalies } from '../utils/liveTelemetry';
import {
  aggregateMetrics,
  buildStationChartFromKpis,
  emptyStationKpi,
  summaryFromApi,
} from '../utils/telemetryAggregate';

const ACTIVE_STATIONS = ACTIVE_STATION_DEFINITIONS.map((station) => station.id);

const pickDowntimeReason = (downtimeSeconds) => {
  if (downtimeSeconds <= 0) return 'NONE';
  const pool = Math.random() < 0.35
    ? ['PLANNED_MAINTENANCE', 'CHANGEOVER']
    : ['BREAKDOWN', 'MATERIAL_SHORTAGE', 'NO_OPERATOR', 'QUALITY_HOLD', 'OTHER'];
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Machine Telemetry SSOT engine.
 * Live Stream writes MachineMetrics batch ticks; all KPIs aggregate from those rows.
 */
export function useTelemetry({
  isAuthenticated,
  canIngestTelemetry,
  autoRefresh,
  liveStreamActive,
  streamStationId,
  shiftCode,
  onSimulatedAnomalies,
  notify,
}) {
  const [metrics, setMetrics] = useState([]);
  const [plantKpi, setPlantKpi] = useState(emptyStationKpi(null));
  const [byStation, setByStation] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applySummaries = useCallback((rows) => {
    const plantRow = (rows || []).find((row) => !row.stationId);
    const stationRows = (rows || []).filter((row) => row.stationId);
    setPlantKpi(summaryFromApi(plantRow || { actual: 0, good: 0, nok: 0 }));
    const map = {};
    for (const station of ACTIVE_STATION_DEFINITIONS) {
      map[station.id] = emptyStationKpi(station.id);
    }
    for (const row of stationRows) {
      map[row.stationId] = summaryFromApi(row);
    }
    setByStation(map);
  }, []);

  const refresh = useCallback(async (signal, { background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const [page, summaries] = await Promise.all([
        fetchMachineMetrics({ signal, limit: 120 }),
        fetchTelemetrySummary({ signal }),
      ]);
      setMetrics(page.items || []);
      applySummaries(summaries);
      setError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(getApiErrorMessage(err, 'Telemetri özeti alınamadı.'));
      // Fallback: aggregate locally from fetched page if summary fails mid-stream.
      try {
        const page = await fetchMachineMetrics({ signal, limit: 120 });
        setMetrics(page.items || []);
        const localByStation = {};
        for (const station of ACTIVE_STATION_DEFINITIONS) {
          const rows = (page.items || []).filter((item) => item.stationId === station.id);
          localByStation[station.id] = aggregateMetrics(rows, station.id);
        }
        setByStation(localByStation);
        setPlantKpi(aggregateMetrics(page.items || [], null));
      } catch {
        // keep previous
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [applySummaries]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, refresh]);

  useNonOverlappingPolling(
    (signal) => refresh(signal, { background: true }),
    {
      enabled: isAuthenticated && autoRefresh,
      intervalMs: liveStreamActive ? 6000 : 12000,
      runImmediately: false,
      resetKey: String(liveStreamActive),
    },
  );

  // Shift-driven Live Stream → POST MachineMetrics batch ticks (not 1-by-1 Uretim).
  useNonOverlappingPolling(async (signal) => {
    const focusedStation = streamStationId
      && ACTIVE_STATIONS.includes(streamStationId)
      ? streamStationId
      : ACTIVE_STATIONS[Math.floor(Math.random() * ACTIVE_STATIONS.length)] || DEFAULT_STATION;

    const actual = 100 + Math.floor(Math.random() * 41); // 100–140 industrial batch size
    const scrap = Math.floor(Math.random() * 8);
    const good = Math.max(0, actual - scrap);
    const downtimeSeconds = Math.floor(Math.random() * 70);
    const payload = {
      stationId: focusedStation,
      plannedProductionSeconds: 300,
      downtimeSeconds,
      downtimeReasonCode: pickDowntimeReason(downtimeSeconds),
      shiftCode: shiftCode || undefined,
      idealCycleTimeSeconds: 2,
      actualProductionCount: actual,
      goodProductionCount: good,
      recordedAt: new Date().toISOString(),
    };

    await createMachineMetric(payload, { signal });

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
    const anomalies = detectTelemetryAnomalies(telemetry, { nokSpike: scrap >= 6 });
    if (anomalies.length && typeof onSimulatedAnomalies === 'function') {
      try {
        await onSimulatedAnomalies(focusedStation, anomalies, { signal });
      } catch (err) {
        console.error(err);
      }
    }

    await refresh(signal, { background: true });
  }, {
    enabled: liveStreamActive && canIngestTelemetry,
    intervalMs: 10000,
    runImmediately: true,
    resetKey: `${streamStationId || ''}:${liveStreamActive}:${shiftCode || ''}`,
  });

  const stationChartData = useMemo(
    () => buildStationChartFromKpis(byStation),
    [byStation],
  );

  const stationKpi = useCallback((stationId) => {
    if (!stationId || stationId === 'Tümü') return plantKpi;
    return byStation[stationId] || emptyStationKpi(stationId);
  }, [byStation, plantKpi]);

  const recentTicks = useMemo(() => {
    return [...metrics]
      .sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0))
      .slice(0, 40);
  }, [metrics]);

  const scrapTicks = useMemo(
    () => recentTicks.filter((tick) => (tick.actualProductionCount - tick.goodProductionCount) > 0),
    [recentTicks],
  );

  return {
    metrics,
    recentTicks,
    scrapTicks,
    plantKpi,
    byStation,
    stationKpi,
    stationChartData,
    loading,
    error,
    refresh: () => refresh(undefined, { background: false }),
    notifyError: notify,
  };
}
