import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Activity, AlertTriangle, Factory, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAlarms, fetchLatestOee, fetchTelemetrySummary } from '../services/api';
import { useMesHub } from '../hooks/useMesHub';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import './AndonPage.css';

const ANDON_STATIONS = ACTIVE_STATION_DEFINITIONS.map((station) => station.id);

const severityTone = (severity) => {
  const value = (severity || '').toLowerCase();
  if (value.includes('kritik') || value.includes('critical')) return 'critical';
  if (value.includes('yüksek') || value.includes('high')) return 'high';
  return 'warn';
};

const AndonPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [oeeByStation, setOeeByStation] = useState({});
  const [alarms, setAlarms] = useState([]);
  const [plantGood, setPlantGood] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [hubConnected, setHubConnected] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();

    const load = async () => {
      try {
        const [alarmPage, summaries] = await Promise.all([
          fetchAlarms({ signal: controller.signal, limit: 20 }),
          fetchTelemetrySummary({ signal: controller.signal }),
        ]);
        setAlarms(alarmPage.items.filter((alarm) => (alarm.status || '').toLowerCase() !== 'onaylandı').slice(0, 8));
        const plant = (summaries || []).find((row) => !row.stationId);
        setPlantGood(plant ? Number(plant.good) || 0 : null);

        const entries = await Promise.all(
          ANDON_STATIONS.map(async (stationId) => {
            try {
              const metric = await fetchLatestOee(stationId, { signal: controller.signal });
              return [stationId, metric];
            } catch {
              return [stationId, null];
            }
          }),
        );
        setOeeByStation(Object.fromEntries(entries));
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error(error);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [isAuthenticated]);

  const { connected } = useMesHub({
    onOeeUpdated: (metrics) => {
      setOeeByStation((current) => {
        const next = { ...current };
        for (const metric of metrics || []) {
          next[metric.stationId] = metric;
        }
        return next;
      });
    },
    onAlarmCreated: (alarm) => {
      setAlarms((current) => [alarm, ...current].slice(0, 8));
    },
    onAlarmUpdated: (alarm) => {
      setAlarms((current) => {
        const id = alarm.id ?? alarm.Id;
        if ((alarm.status || '').toLowerCase() === 'onaylandı') {
          return current.filter((item) => (item.id ?? item.Id) !== id);
        }
        return [alarm, ...current.filter((item) => (item.id ?? item.Id) !== id)].slice(0, 8);
      });
    },
    onAlarmDeleted: (payload) => {
      const id = payload?.id ?? payload?.Id;
      setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
    },
  });

  useEffect(() => {
    setHubConnected(connected);
  }, [connected]);

  const openAlarmCount = alarms.length;
  const averageOee = useMemo(() => {
    const values = ANDON_STATIONS
      .map((station) => oeeByStation[station]?.oee)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [oeeByStation]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="andon-screen">
      <header className="andon-header">
        <div className="andon-brand">
          <Factory size={28} />
          <div>
            <strong>VESTEL MES ANDON</strong>
            <span>{currentUser?.name} · Saha Ekranı</span>
          </div>
        </div>
        <div className="andon-meta">
          <span className={`andon-live ${hubConnected ? 'on' : 'off'}`}>
            <Radio size={16} />
            {hubConnected ? 'CANLI' : 'YENİDEN BAĞLANIYOR'}
          </span>
          <strong>{clock.toLocaleTimeString('tr-TR')}</strong>
          <Link to="/fabrika" className="andon-exit">Panele Dön</Link>
        </div>
      </header>

      <section className="andon-summary">
        <article>
          <small>Ortalama OEE</small>
          <strong>{averageOee == null ? '—' : `%${averageOee.toFixed(1)}`}</strong>
        </article>
        <article className={openAlarmCount > 0 ? 'alert' : ''}>
          <small>Açık Alarm</small>
          <strong>{openAlarmCount}</strong>
        </article>
        <article>
          <small>Σ Sağlam (Telemetri)</small>
          <strong>{plantGood == null ? '—' : plantGood}</strong>
        </article>
      </section>

      <section className="andon-stations">
        {ANDON_STATIONS.map((stationId) => {
          const metric = oeeByStation[stationId];
          const oee = metric?.oee;
          const tone = oee == null ? 'idle' : oee >= 85 ? 'good' : oee >= 60 ? 'warn' : 'bad';
          return (
            <article key={stationId} className={`andon-station ${tone}`}>
              <header>
                <h2>{getStationDisplayName(stationId)}</h2>
                <span>{metric?.shiftName || metric?.shiftCode || '—'}</span>
              </header>
              <div className="andon-oee">
                <Activity size={22} />
                <strong>{oee == null ? '—' : `%${Number(oee).toFixed(1)}`}</strong>
              </div>
              <dl>
                <div><dt>Kullanılabilirlik</dt><dd>{metric?.availability ?? '—'}%</dd></div>
                <div><dt>Performans</dt><dd>{metric?.performance ?? '—'}%</dd></div>
                <div><dt>Kalite</dt><dd>{metric?.quality ?? '—'}%</dd></div>
                <div><dt>Sağlam / Fire</dt><dd>{metric?.goodProduction ?? '—'} / {metric?.scrapProduction ?? '—'}</dd></div>
                <div><dt>Duruş</dt><dd>{metric?.downtimeReason || 'Yok'}</dd></div>
              </dl>
            </article>
          );
        })}
      </section>

      <section className="andon-alarms">
        <header>
          <AlertTriangle size={20} />
          <h2>Canlı Alarmlar</h2>
        </header>
        {alarms.length === 0 ? (
          <p className="andon-empty">Aktif alarm yok.</p>
        ) : (
          <ul>
            {alarms.map((alarm) => (
              <li key={alarm.id ?? alarm.Id} className={`tone-${severityTone(alarm.severity)}`}>
                <div>
                  <strong>{alarm.title}</strong>
                  <span>{alarm.station} · {alarm.severity}</span>
                </div>
                <small>{alarm.time ? new Date(alarm.time).toLocaleTimeString('tr-TR') : '—'}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AndonPage;
