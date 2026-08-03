/**
 * Client-side aggregation helpers mirroring backend TelemetryAggregator.
 * Prefer API /MachineMetrics/summary when available; use these for local ticks.
 */
export const emptyStationKpi = (stationId = null) => ({
  stationId,
  actual: 0,
  good: 0,
  nok: 0,
  yield: 0,
  downtimeSeconds: 0,
  tickCount: 0,
  lastRecordedAt: null,
});

export const aggregateMetrics = (metrics = [], stationId = null) => {
  let actual = 0;
  let good = 0;
  let downtimeSeconds = 0;
  let lastRecordedAt = null;
  for (const metric of metrics) {
    const a = Math.max(0, Number(metric.actualProductionCount) || 0);
    const g = Math.min(a, Math.max(0, Number(metric.goodProductionCount) || 0));
    actual += a;
    good += g;
    downtimeSeconds += Math.max(0, Number(metric.downtimeSeconds) || 0);
    const at = metric.recordedAt ? new Date(metric.recordedAt).getTime() : 0;
    if (!lastRecordedAt || at > new Date(lastRecordedAt).getTime()) {
      lastRecordedAt = metric.recordedAt || lastRecordedAt;
    }
  }
  const nok = Math.max(0, actual - good);
  return {
    stationId,
    actual,
    good,
    nok,
    yield: actual > 0 ? Number(((good / actual) * 100).toFixed(1)) : 0,
    downtimeSeconds: Number(downtimeSeconds.toFixed(1)),
    tickCount: metrics.length,
    lastRecordedAt,
  };
};

export const summaryFromApi = (row) => ({
  stationId: row?.stationId ?? null,
  actual: Number(row?.actual) || 0,
  good: Number(row?.good) || 0,
  nok: Number(row?.nok) || 0,
  yield: Number(row?.yieldPercent ?? row?.yield) || 0,
  downtimeSeconds: Number(row?.downtimeSeconds) || 0,
  tickCount: Number(row?.tickCount) || 0,
  lastRecordedAt: row?.lastRecordedAt || null,
});

export const buildStationChartFromKpis = (byStation = {}) => Object.entries(byStation).map(([name, kpi]) => ({
  name,
  OK: kpi.good || 0,
  NOK: kpi.nok || 0,
}));
