import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Activity, AlertTriangle, Factory, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAlarms, fetchLatestOeeAll, fetchTelemetrySummary } from '../services/api';
import { useMesHub } from '../hooks/useMesHub';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import './AndonPage.css';

const ANDON_STATIONS = ACTIVE_STATION_DEFINITIONS.map((station) => station.id);

const isClosedAlarm = (status) => {
  const value = (status || '').toLowerCase();
  return value === 'onaylandı' || value === 'çözüldü' || value === 'kapalı' || value === 'resolved';
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        // 3 parallel calls (was 2 + N station OEE fan-out).
        const [alarmPage, summaries, latestOee] = await Promise.all([
          fetchAlarms({ signal: controller.signal, limit: 30, openOnly: true }),
          fetchTelemetrySummary({ signal: controller.signal }),
          fetchLatestOeeAll({ signal: controller.signal }),
        ]);
        setAlarms((alarmPage.items || []).filter((alarm) => !isClosedAlarm(alarm.status)).slice(0, 8));
        const plant = (summaries || []).find((row) => !row.stationId);
        setPlantGood(plant ? Number(plant.good) || 0 : null);
        const map = {};
        for (const metric of latestOee || []) {
          if (metric?.stationId) map[metric.stationId] = metric;
        }
        setOeeByStation(map);
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    const refresh = window.setInterval(load, 20000);
    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
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
      if (isClosedAlarm(alarm.status)) return;
      setAlarms((current) => [alarm, ...current.filter((item) => (item.id ?? item.Id) !== (alarm.id ?? alarm.Id))].slice(0, 8));
    },
    onAlarmUpdated: (alarm) => {
      setAlarms((current) => {
        const id = alarm.id ?? alarm.Id;
        if (isClosedAlarm(alarm.status)) {
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

  const averageOee = useMemo(() => {
    const values = ANDON_STATIONS
      .map((id) => oeeByStation[id]?.oee)
      .filter((value) => typeof value === 'number');
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [oeeByStation]);

  const openAlarmCount = alarms.length;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="andon-shell">
      <header className="andon-top">
        <div className="andon-brand">
          <Factory size={28} />
          <div>
            <strong>VESTEL MES ANDON</strong>
            <span>{currentUser?.name} · Saha Ekranı{loading ? ' · yükleniyor…' : ''}</span>
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
          <h2>Canlı Alarmlar (yalnızca açık)</h2>
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
