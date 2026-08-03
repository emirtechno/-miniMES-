/**
 * Derive shop-floor gauges from machine metric counters (sensor/PLC stand-in).
 * Used by Makine Metrikleri and İstasyonlar cards.
 */
export const deriveLiveTelemetry = (latestMetric, pulse = 0, streaming = false) => {
  const downtime = Number(latestMetric?.downtimeSeconds) || 0;
  const actual = Number(latestMetric?.actualProductionCount) || 0;
  const good = Number(latestMetric?.goodProductionCount) || 0;
  const scrapRatio = actual > 0 ? Math.max(0, (actual - good) / actual) : 0;
  const cycle = Number(latestMetric?.idealCycleTimeSeconds) || 2;
  const streamBoost = streaming ? 1 : 0;
  const wobble = streaming ? Math.sin(pulse / 900) : 0;

  const temperature = Math.round(
    42 + downtime * 0.35 + scrapRatio * 28 + streamBoost * 6 + wobble * 2.5,
  );
  const rpm = Math.round(
    Math.max(
      0,
      (60 / Math.max(cycle, 0.5)) * 18 * (streaming ? 1.08 : 0.92)
        - downtime * 1.2
        + wobble * 40,
    ),
  );
  const vibration = Number(
    (0.4 + scrapRatio * 3.2 + downtime / 80 + (streaming ? 0.35 : 0) + Math.abs(wobble) * 0.2)
      .toFixed(2),
  );

  return { temperature, rpm, vibration, downtime, scrapRatio };
};

/** Thresholds that should raise Andon / alarm events from live telemetry. */
export const detectTelemetryAnomalies = (telemetry, { nokSpike = false } = {}) => {
  const anomalies = [];
  if (telemetry.vibration >= 2.8) {
    anomalies.push({
      kind: 'vibration',
      title: 'Yüksek Titreşim Eşiği Aşıldı',
      severity: 'Kritik',
      description: `Titreşim ${telemetry.vibration} mm/s — yatak / dengelenme kontrolü gerekir.`,
    });
  }
  if (telemetry.temperature >= 78) {
    anomalies.push({
      kind: 'temperature',
      title: 'Aşırı Isınma Uyarısı',
      severity: 'Yüksek',
      description: `Sıcaklık ${telemetry.temperature}°C — soğutma / duruş riski.`,
    });
  }
  if (telemetry.downtime >= 45) {
    anomalies.push({
      kind: 'downtime',
      title: 'Duruş Süresi Eşiği Aşıldı',
      severity: 'Yüksek',
      description: `Plan dışı duruş ${telemetry.downtime} sn — Andon müdahalesi önerilir.`,
    });
  }
  if (nokSpike) {
    anomalies.push({
      kind: 'nok',
      title: 'NOK Kalite Spike',
      severity: 'Uyarı',
      description: 'Sensör / vision hattı NOK üretti — lot kalite riski.',
    });
  }
  return anomalies;
};
