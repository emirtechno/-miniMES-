import { useCallback, useState } from 'react';
import { fetchShiftCurrentOee } from '../services/api';
import { useNonOverlappingPolling } from '../hooks/useNonOverlappingPolling';
import { useMesHub } from '../hooks/useMesHub';
import {
  ACTIVE_STATION_DEFINITIONS,
  DEFAULT_STATION,
  getStationDisplayName,
} from '../constants/stations';
import OeeInsight from './OeeInsight';
import InfoTip from './InfoTip';
import CardHeader from './CardHeader';
import { Gauge } from 'lucide-react';

const GaugeMeter = ({ label, value, detail }) => {
  const isAvailable = typeof value === 'number' && !Number.isNaN(value);
  const normalizedValue = isAvailable ? Math.max(0, Math.min(value, 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const color = normalizedValue >= 85 ? '#0f9f6e' : normalizedValue >= 60 ? '#c47f17' : '#d92d20';

  return (
    <article className="rounded-xl border border-[color:var(--color-line)] bg-slate-50/60 px-3 py-3 text-center">
      <div className="relative mx-auto h-[72px] w-[110px]">
        <svg viewBox="0 0 110 70" aria-hidden="true" className="h-full w-full">
          <path d="M 13 58 A 42 42 0 0 1 97 58" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
          {isAvailable && (
            <path
              d="M 13 58 A 42 42 0 0 1 97 58"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              style={{ strokeDasharray: `${(circumference / 2) * (normalizedValue / 100)} ${circumference}` }}
            />
          )}
        </svg>
        <strong
          className="absolute inset-x-0 bottom-0 font-display text-lg"
          style={{ color: isAvailable ? color : '#94a3b8' }}
        >
          {isAvailable ? `%${normalizedValue.toFixed(1)}` : '—'}
        </strong>
      </div>
      <div className="mt-1 text-sm font-semibold text-[color:var(--color-ink)]">{label}</div>
      <small className="block text-xs text-[color:var(--color-muted)]">{detail}</small>
    </article>
  );
};

/**
 * OEE gauges with interactive station selector (Availability / Performance / Quality / OEE).
 * Scope: current catalog shift window (/Oee/shift-current), same as Andon.
 */
const OeePanel = ({
  stationId: controlledStationId,
  onStationChange,
  showStationSelector = true,
  defaultStationId = DEFAULT_STATION,
}) => {
  const [internalStationId, setInternalStationId] = useState(controlledStationId || defaultStationId);
  const stationId = controlledStationId || internalStationId;
  const [metric, setMetric] = useState(null);

  const handleStationSelect = (nextId) => {
    if (!controlledStationId) setInternalStationId(nextId);
    onStationChange?.(nextId);
  };

  const loadShiftOee = useCallback(async (signal) => {
    if (!stationId) return;
    try {
      setMetric(await fetchShiftCurrentOee(stationId, { signal }));
    } catch (error) {
      if (error.response?.status === 404) setMetric(null);
      else throw error;
    }
  }, [stationId]);

  useMesHub({
    onOeeUpdated: () => {
      // Hub payload is single-tick; re-fetch shift aggregates for consistent A/P/Q.
      loadShiftOee(undefined);
    },
  });

  useNonOverlappingPolling(loadShiftOee, {
    enabled: Boolean(stationId),
    intervalMs: 30000,
    resetKey: stationId,
  });

  const lastUpdated = metric?.lastUpdated
    ? new Date(metric.lastUpdated).toLocaleTimeString('tr-TR')
    : 'Bekleniyor...';

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={Gauge}
        title={`OEE / Hat Verimliliği — ${getStationDisplayName(stationId)}`}
        subtitle={`Vardiya penceresi · son güncelleme: ${lastUpdated}`}
        actions={showStationSelector ? (
          <select
            className="mes-input h-10 w-auto min-w-[200px]"
            value={stationId}
            onChange={(event) => handleStationSelect(event.target.value)}
            aria-label="OEE istasyon seçimi"
          >
            {ACTIVE_STATION_DEFINITIONS.map((station) => (
              <option key={station.id} value={station.id}>
                {station.displayName}
              </option>
            ))}
          </select>
        ) : (
          <InfoTip text="OEE = Kullanılabilirlik × Performans × Kalite. Değerler katalog vardiya penceresinin (/Oee/shift-current) toplamıdır (Andon ile aynı); operatör oturumu sıfırlanınca burası sıfırlanmaz." />
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GaugeMeter
          label="Kullanılabilirlik"
          value={metric?.availability}
          detail={metric?.downtimeReason
            ? `${metric.downtimeReason}${metric.isPlannedDowntime ? ' (planlı)' : ''}`
            : 'Planlı süre ve duruş verisi'}
        />
        <GaugeMeter
          label="Performans"
          value={metric?.performance}
          detail={metric?.shiftName || 'İdeal çevrim ve gerçekleşen üretim'}
        />
        <GaugeMeter
          label="Kalite"
          value={metric?.quality}
          detail={`${metric?.goodProduction ?? 0} OK / ${metric?.totalProduction ?? 0} Toplam`}
        />
        <GaugeMeter
          label="OEE"
          value={metric?.oee}
          detail={`${metric?.scrapProduction ?? 0} fire`}
        />
      </div>

      <OeeInsight metric={metric} />
    </section>
  );
};

export default OeePanel;
