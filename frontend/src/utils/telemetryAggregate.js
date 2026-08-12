/**
 * İstemci tarafı toplama yardımcıları — backend TelemetryAggregator ile aynı mantık.
 * Mümkünse API /MachineMetrics/summary tercih et; yerel tick'ler için bunları kullan.
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

/** /Oee/shift-current satırını overview kartlarının istasyon KPI şekline eşle. */
export const kpiFromShiftOee = (metric, stationId = null) => {
  const actual = Number(metric?.totalProduction) || 0;
  const good = Number(metric?.goodProduction) || 0;
  const nok = Number(metric?.scrapProduction) || Math.max(0, actual - good);
  return {
    stationId: stationId ?? metric?.stationId ?? null,
    actual,
    good,
    nok,
    yield: actual > 0 ? Number(((good / actual) * 100).toFixed(1)) : 0,
    oee: typeof metric?.oee === 'number' ? metric.oee : null,
    downtimeSeconds: Number(metric?.downtimeSeconds) || 0,
    tickCount: 0,
    lastRecordedAt: metric?.lastUpdated || null,
  };
};

/** ShiftSession.summary (canlı veya kalıcı) → operatör KPI kartları. */
export const kpiFromSessionSummary = (summary, stationId = null) => {
  if (!summary) return emptyStationKpi(stationId);
  const actual = Number(summary.actualCount) || 0;
  const good = Number(summary.goodCount) || 0;
  const nok = Number(summary.nokCount ?? summary.scrapCount) || Math.max(0, actual - good);
  return {
    stationId: stationId ?? summary.stationId ?? null,
    actual,
    good,
    nok,
    yield: actual > 0 ? Number(((good / actual) * 100).toFixed(1)) : 0,
    oee: typeof summary.oeePercent === 'number' ? summary.oeePercent : null,
    downtimeSeconds: Number(summary.downtimeSeconds) || 0,
    tickCount: 0,
    lastRecordedAt: summary.endedAt || null,
  };
};

/** shift-current satırlarını stationId ile indeksle. */
export const mapShiftOeeByStation = (rows = []) => {
  const map = {};
  for (const metric of rows || []) {
    if (metric?.stationId) map[metric.stationId] = metric;
  }
  return map;
};
