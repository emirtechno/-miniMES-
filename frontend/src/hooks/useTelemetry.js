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
 * Simulated PLC batch: scrap is encoded as Actual−Good on the MachineMetrics row
 * (same Σ Fire SSOT as manual fire). `_scrap` is client-only for anomaly detection.
 */
const buildTickPayload = (stationId, shiftCode) => {
  const actual = 100 + Math.floor(Math.random() * 41); // 100–140 industrial batch size
  const scrap = Math.floor(Math.random() * 8); // 0–7 fire in this batch → Σ Fire += scrap
  const good = Math.max(0, actual - scrap);
  const downtimeSeconds = Math.floor(Math.random() * 70);
  return {
    stationId,
    plannedProductionSeconds: 300,
    downtimeSeconds,
    downtimeReasonCode: pickDowntimeReason(downtimeSeconds),
    shiftCode: shiftCode || undefined,
    idealCycleTimeSeconds: 2,
    actualProductionCount: actual,
    goodProductionCount: good,
    recordedAt: new Date().toISOString(),
    _scrap: scrap,
  };
};

/**
 * Machine Telemetry SSOT engine.
 * Live Stream writes MachineMetrics batch ticks; all KPIs aggregate from those rows.
 * Supports concurrent multi-station streams from active shifts.
 */
export function useTelemetry({
  isAuthenticated,
  canIngestTelemetry,
  autoRefresh,
  liveStreamActive,
  streamStations = [],
  /** @deprecated Prefer streamStations — kept for single-station callers */
  streamStationId,
  shiftCode,
  /** Optional summary window — prefer active shift code / start time when available */
  summaryShiftCode,
  summarySince,
  onSimulatedAnomalies,
  notify,
}) {
  const [metrics, setMetrics] = useState([]);
  const [plantKpi, setPlantKpi] = useState(emptyStationKpi(null));
  const [byStation, setByStation] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolvedStreams = useMemo(() => {
    if (Array.isArray(streamStations) && streamStations.length > 0) {
      return streamStations
        .filter((entry) => entry?.stationId && ACTIVE_STATIONS.includes(entry.stationId))
        .map((entry) => ({
          stationId: entry.stationId,
          shiftCode: entry.shiftCode || shiftCode,
        }));
    }
    if (streamStationId && ACTIVE_STATIONS.includes(streamStationId)) {
      return [{ stationId: streamStationId, shiftCode }];
    }
    return [];
  }, [streamStations, streamStationId, shiftCode]);

  const streamResetKey = useMemo(
    () => resolvedStreams.map((entry) => `${entry.stationId}:${entry.shiftCode || ''}`).sort().join('|'),
    [resolvedStreams],
  );

  const summaryParams = useMemo(() => ({
    shiftCode: summaryShiftCode || shiftCode || undefined,
    since: summarySince || undefined,
  }), [summaryShiftCode, shiftCode, summarySince]);

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
        fetchTelemetrySummary({ signal, ...summaryParams }),
      ]);
      setMetrics(page.items || []);
      applySummaries(summaries);
      setError(null);
      return summaries;
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return undefined;
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
      return undefined;
    } finally {
      if (!background) setLoading(false);
    }
  }, [applySummaries, summaryParams]);

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

  // Shift-driven Live Stream → POST MachineMetrics batch ticks for every streaming station.
  useNonOverlappingPolling(async (signal) => {
    const targets = resolvedStreams.length > 0
      ? resolvedStreams
      : [{
        stationId: ACTIVE_STATIONS[Math.floor(Math.random() * ACTIVE_STATIONS.length)] || DEFAULT_STATION,
        shiftCode,
      }];

    for (const stream of targets) {
      const payload = buildTickPayload(stream.stationId, stream.shiftCode);
      const { _scrap: scrap, ...apiPayload } = payload;
      await createMachineMetric(apiPayload, { signal });

      const telemetry = deriveLiveTelemetry(
        {
          downtimeSeconds: payload.downtimeSeconds,
          actualProductionCount: payload.actualProductionCount,
          goodProductionCount: payload.goodProductionCount,
          idealCycleTimeSeconds: 2,
        },
        Date.now(),
        true,
      );
      const anomalies = detectTelemetryAnomalies(telemetry, { nokSpike: scrap >= 6 });
      if (anomalies.length && typeof onSimulatedAnomalies === 'function') {
        try {
          await onSimulatedAnomalies(stream.stationId, anomalies, { signal });
        } catch (err) {
          console.error(err);
        }
      }
    }

    await refresh(signal, { background: true });
  }, {
    enabled: liveStreamActive && canIngestTelemetry && resolvedStreams.length > 0,
    intervalMs: 10000,
    runImmediately: true,
    resetKey: `${streamResetKey}:${liveStreamActive}`,
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

  /**
   * Manual shop-floor scrap: append-only MachineMetrics tick (Actual=N, Good=0).
   * Additive MES rule — Σ Fire (Actual−Good) increases by N and persists after shift end.
   */
  const ingestManualScrap = useCallback(async ({ stationId, amount, shiftCode: scrapShiftCode } = {}) => {
    if (!canIngestTelemetry) {
      throw new Error('Fire kaydı için production.write yetkisi gerekir.');
    }
    const qty = Math.max(1, Math.min(999, Number(amount) || 1));
    const targetStation = stationId || DEFAULT_STATION;
    if (!ACTIVE_STATIONS.includes(targetStation)) {
      throw new Error('Geçersiz istasyon kimliği.');
    }

    await createMachineMetric({
      stationId: targetStation,
      plannedProductionSeconds: 60,
      downtimeSeconds: 0,
      downtimeReasonCode: 'NONE',
      shiftCode: scrapShiftCode || undefined,
      idealCycleTimeSeconds: 2,
      actualProductionCount: qty,
      goodProductionCount: 0,
      recordedAt: new Date().toISOString(),
    });
    const summaries = await refresh(undefined, { background: true });
    const stationRow = (summaries || []).find((row) => row.stationId === targetStation);
    const nokAfter = Number(stationRow?.nok) || 0;
    return { amount: qty, nokAfter };
  }, [canIngestTelemetry, refresh]);

  /**
   * When operator ends downtime/setup, write accumulated stoppage into MachineMetrics
   * so Availability / Andon reflect the pause (not only local shift flags).
   */
  const ingestDowntimeTick = useCallback(async ({
    stationId,
    downtimeSeconds,
    reasonCode,
    shiftCode: dtShiftCode,
  } = {}) => {
    if (!canIngestTelemetry) return null;
    const secs = Math.max(1, Math.min(3600, Math.floor(Number(downtimeSeconds) || 0)));
    if (secs <= 0) return null;
    const targetStation = stationId || DEFAULT_STATION;
    if (!ACTIVE_STATIONS.includes(targetStation)) {
      throw new Error('Geçersiz istasyon kimliği.');
    }
    const reason = reasonCode && reasonCode !== 'NONE' ? reasonCode : 'OTHER';
    const planned = Math.max(secs, 60);

    await createMachineMetric({
      stationId: targetStation,
      plannedProductionSeconds: planned,
      downtimeSeconds: secs,
      downtimeReasonCode: reason,
      shiftCode: dtShiftCode || undefined,
      idealCycleTimeSeconds: 2,
      actualProductionCount: 0,
      goodProductionCount: 0,
      recordedAt: new Date().toISOString(),
    });
    await refresh(undefined, { background: true });
    return secs;
  }, [canIngestTelemetry, refresh]);

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
    ingestManualScrap,
    ingestDowntimeTick,
    notifyError: notify,
  };
}
