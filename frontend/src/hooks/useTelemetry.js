import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchMachineMetrics,
  fetchTelemetrySummary,
  getApiErrorMessage,
} from '../services/api';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';
import { useMesHub } from '../context/MesHubContext';
import { ACTIVE_STATION_DEFINITIONS } from '../constants/stations';
import {
  aggregateMetrics,
  buildStationChartFromKpis,
  emptyStationKpi,
  summaryFromApi,
} from '../utils/telemetryAggregate';

// NEDEN: Makine telemetrisi tek okuma modeli (SSOT). Backend OeeSimulation / PLC → MachineMetrics yazar;
// UI poll + SignalR ile yeniler. metricsFeed App'ten bu panele merge edilmez (MachineMetricsPanel kendi poll'unu kullanır).
// NASIL: fetchMachineMetrics (son tick'ler) + fetchTelemetrySummary (KPI) → byStation/plantKpi; hub oee/telemetry tick'te arka plan refresh.
export function useTelemetry({
  isAuthenticated,
  autoRefresh,
  liveStreamActive,
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
      // NEDEN: Summary API ortada düşerse sayfadaki son tick'lerden yerel aggregate ile KPI'yı ayakta tut.
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
        // Öncekini koru
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

  // NEDEN: Canlı yayın açıksa daha sık poll (6 sn); değilse 12 sn. Çakışmayan polling üst üste istek atmaz.
  useNonOverlappingPolling(
    (signal) => refresh(signal, { background: true }),
    {
      enabled: isAuthenticated && autoRefresh,
      intervalMs: liveStreamActive ? 6000 : 12000,
      runImmediately: false,
      resetKey: String(liveStreamActive),
    },
  );

  // NEDEN: SignalR oeeUpdated / telemetryTick gelince anında arka plan yenileme (poll beklemeden).
  useMesHub({
    onOeeUpdated: () => {
      if (!isAuthenticated) return;
      refresh(undefined, { background: true });
    },
    onTelemetryTick: () => {
      if (!isAuthenticated) return;
      refresh(undefined, { background: true });
    },
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
