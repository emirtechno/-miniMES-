import { useState } from 'react';
import { fetchLatestOee } from '../services/api';
import { useNonOverlappingPolling } from '../hooks/useNonOverlappingPolling';
import { DEFAULT_STATION } from '../constants/stations';

const Gauge = ({ label, value, detail }) => {
  const isAvailable = typeof value === 'number' && !Number.isNaN(value);
  const normalizedValue = isAvailable ? Math.max(0, Math.min(value, 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const color = normalizedValue >= 85 ? '#10b981' : normalizedValue >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <article className="oee-gauge">
      <div className="oee-gauge-visual">
        <svg viewBox="0 0 110 70" aria-hidden="true">
          <path className="oee-gauge-track" d="M 13 58 A 42 42 0 0 1 97 58" />
          {isAvailable && (
            <path
              className="oee-gauge-value"
              d="M 13 58 A 42 42 0 0 1 97 58"
              style={{ stroke: color, strokeDasharray: `${(circumference / 2) * (normalizedValue / 100)} ${circumference}` }}
            />
          )}
        </svg>
        <strong style={{ color: isAvailable ? color : '#94a3b8' }}>{isAvailable ? `%${normalizedValue.toFixed(1)}` : '—'}</strong>
      </div>
      <span>{label}</span>
      <small>{detail}</small>
    </article>
  );
};

const OeePanel = ({ stationId = DEFAULT_STATION }) => {
  const [metric, setMetric] = useState(null);

  useNonOverlappingPolling(async (signal) => {
    try {
      setMetric(await fetchLatestOee(stationId, { signal }));
    } catch (error) {
      if (error.response?.status === 404) setMetric(null);
      else throw error;
    }
  }, {
    enabled: Boolean(stationId),
    intervalMs: 10000,
    resetKey: stationId,
  });

  const lastUpdated = metric?.lastUpdated
    ? new Date(metric.lastUpdated).toLocaleTimeString('tr-TR')
    : 'Bekleniyor...';

  return (
    <section className="custom-card oee-panel">
      <div className="card-header oee-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span>OEE / Hat Verimliliği — {stationId}</span>
          <small>Son Güncelleme: {lastUpdated}</small>
        </div>
      </div>

      <div className="oee-grid">
        <Gauge
          label="Kullanılabilirlik"
          value={metric?.availability}
          detail={metric?.downtimeReason
            ? `${metric.downtimeReason}${metric.isPlannedDowntime ? ' (planlı)' : ''}`
            : 'Planlı süre ve duruş verisi'}
        />
        <Gauge
          label="Performans"
          value={metric?.performance}
          detail={metric?.shiftName || 'İdeal çevrim ve gerçekleşen üretim'}
        />
        <Gauge
          label="Kalite"
          value={metric?.quality}
          detail={`${metric?.goodProduction ?? 0} OK / ${metric?.totalProduction ?? 0} Toplam`}
        />
        <Gauge
          label="OEE"
          value={metric?.oee}
          detail={`${metric?.scrapProduction ?? 0} fire`}
        />
      </div>
    </section>
  );
};

export default OeePanel;
