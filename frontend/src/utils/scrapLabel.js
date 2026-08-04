/**
 * Σ Fire display helper — MachineMetrics NOK is SSOT.
 * Manual scrap tally is audit-only and must NOT be added into displayed Σ.
 */
export function formatScrapLabel(metricsNok, manualScrap = 0) {
  const nok = Math.max(0, Number(metricsNok) || 0);
  const manual = Math.max(0, Number(manualScrap) || 0);
  if (manual > 0) {
    return `Σ Fire ${nok} · bu vardiyada manuel +${manual}`;
  }
  return `Σ Fire ${nok}`;
}

/** Display scrap KPI value (SSOT only — never metricsNok + manualScrap). */
export function displayScrapKpi(metricsNok, manualScrap = 0) {
  void manualScrap; // audit-only; intentionally unused for KPI
  return Math.max(0, Number(metricsNok) || 0);
}
