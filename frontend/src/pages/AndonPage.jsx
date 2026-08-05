import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AlertTriangle, CheckCheck, CheckCircle, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import { useSimulationStatus } from '../context/SimulationStatusContext';
import {
  acknowledgeAlarm,
  fetchAlarms,
  fetchShiftCurrentOeeAll,
  fetchShiftSessionBoard,
  getApiErrorMessage,
  resolveAlarm,
} from '../services/api';
import { useMesHub } from '../hooks/useMesHub';
import VestelMark from '../components/VestelMark';
import OeeGauge from '../components/OeeGauge';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import './AndonPage.css';

const ANDON_STATIONS = ACTIVE_STATION_DEFINITIONS.map((station) => station.id);

const isClosedAlarm = (status) => {
  const value = (status || '').toLowerCase();
  // Onaylandı stays on the live list until Çözüldü/Kapalı.
  return value === 'çözüldü' || value === 'kapalı' || value === 'resolved';
};

const isAcknowledgedAlarm = (status) => {
  const value = (status || '').toLowerCase();
  return value === 'onaylandı' || value === 'acknowledged';
};

const severityTone = (severity) => {
  const value = (severity || '').toLowerCase();
  if (value.includes('kritik') || value.includes('critical')) return 'critical';
  if (value.includes('yüksek') || value.includes('high')) return 'high';
  return 'warn';
};

const hasActiveDowntime = (metric) => {
  const reason = (metric?.downtimeReason || metric?.downtimeReasonCode || '').trim();
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return normalized !== 'yok' && normalized !== 'none' && normalized !== '—' && normalized !== 'duruş yok';
};

const isDownAlarm = (alarm) => {
  const severity = (alarm?.severity || '').toLowerCase();
  const title = alarm?.title || alarm?.Title || '';
  return severity.includes('kritik')
    || severity.includes('critical')
    || /acil|emergency|ar[iı]za/i.test(title);
};

const runtimeBadgeLabel = ({ simEnabled, hasMetric, paused, hasAlarm, isDown }) => {
  if (isDown) return 'DURDU';
  if (paused && hasAlarm) return 'DURAKLADI · Alarm';
  if (!simEnabled) return 'SİM KAPALI';
  if (!hasMetric && !paused && !hasAlarm) return 'BOŞTA';
  if (paused) return 'DURAKLADI';
  return 'ÇALIŞIYOR';
};

const averageNumeric = (values) => {
  const nums = values.filter((value) => typeof value === 'number');
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

const sumNumeric = (values) => {
  const nums = values.filter((value) => typeof value === 'number');
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0);
};

const AndonPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const { notify, confirm } = useNotify();
  const { enabled: simEnabled } = useSimulationStatus();
  const [oeeByStation, setOeeByStation] = useState({});
  const [sessionByStation, setSessionByStation] = useState({});
  const [alarms, setAlarms] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [hubConnected, setHubConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState(null);

  const canManageAlarms = Boolean(currentUser?.permissions?.includes('alarms.manage'));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const applyShiftOee = useCallback((rows) => {
    const map = {};
    for (const metric of rows || []) {
      if (metric?.stationId) map[metric.stationId] = metric;
    }
    setOeeByStation(map);
  }, []);

  const applySessionBoard = useCallback((rows) => {
    const map = {};
    for (const item of rows || []) {
      if (item?.stationId) map[item.stationId] = item;
    }
    setSessionByStation(map);
  }, []);

  const loadOeeScopes = useCallback(async (signal) => {
    try {
      const [shiftOee, sessionBoard] = await Promise.all([
        fetchShiftCurrentOeeAll({ signal }),
        fetchShiftSessionBoard({ signal }),
      ]);
      applyShiftOee(shiftOee);
      applySessionBoard(sessionBoard);
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error(error);
      }
    }
  }, [applyShiftOee, applySessionBoard]);

  const loadAndonBoard = useCallback(async (signal, { showLoading = false } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const [alarmPage, shiftOee, sessionBoard] = await Promise.all([
        fetchAlarms({ signal, limit: 40, openOnly: true }),
        fetchShiftCurrentOeeAll({ signal }),
        fetchShiftSessionBoard({ signal }),
      ]);
      setAlarms((alarmPage.items || []).filter((alarm) => !isClosedAlarm(alarm.status)));
      applyShiftOee(shiftOee);
      applySessionBoard(sessionBoard);
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error(error);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyShiftOee, applySessionBoard]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    loadAndonBoard(controller.signal, { showLoading: true });
    const refresh = window.setInterval(() => loadAndonBoard(controller.signal), 20000);
    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [isAuthenticated, loadAndonBoard]);

  const { connected } = useMesHub({
    onOeeUpdated: () => {
      // Tick hub payload is single-tick scoped; re-fetch both OEE scopes so cards stay consistent.
      loadOeeScopes(undefined);
    },
    onShiftUpdated: () => {
      loadOeeScopes(undefined);
    },
    onAlarmCreated: (alarm) => {
      if (isClosedAlarm(alarm.status)) return;
      setAlarms((current) => [alarm, ...current.filter((item) => (item.id ?? item.Id) !== (alarm.id ?? alarm.Id))]);
    },
    onAlarmUpdated: (alarm) => {
      setAlarms((current) => {
        const id = alarm.id ?? alarm.Id;
        if (isClosedAlarm(alarm.status)) {
          return current.filter((item) => (item.id ?? item.Id) !== id);
        }
        return [alarm, ...current.filter((item) => (item.id ?? item.Id) !== id)];
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

  const averageCatalogOee = useMemo(
    () => averageNumeric(ANDON_STATIONS.map((id) => oeeByStation[id]?.oee)),
    [oeeByStation],
  );

  const averageSessionOee = useMemo(
    () => averageNumeric(ANDON_STATIONS.map((id) => sessionByStation[id]?.oee?.oee)),
    [sessionByStation],
  );

  const plantCatalogGood = useMemo(
    () => sumNumeric(ANDON_STATIONS.map((id) => oeeByStation[id]?.goodProduction)),
    [oeeByStation],
  );

  const plantSessionGood = useMemo(
    () => sumNumeric(ANDON_STATIONS.map((id) => sessionByStation[id]?.oee?.goodProduction)),
    [sessionByStation],
  );

  const alarmsByStation = useMemo(() => {
    const map = {};
    for (const alarm of alarms) {
      const station = alarm.station || alarm.Station;
      if (!station) continue;
      const entry = map[station] || { count: 0, isDown: false, titles: [] };
      entry.count += 1;
      if (isDownAlarm(alarm)) entry.isDown = true;
      const title = (alarm.title || alarm.Title || '').trim();
      if (title && !entry.titles.includes(title)) entry.titles.push(title);
      map[station] = entry;
    }
    return map;
  }, [alarms]);

  const openAlarmCount = alarms.length;

  const handleAcknowledge = useCallback(async (alarmId) => {
    if (!canManageAlarms) {
      notify('Alarm onaylama yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    if (alarmId == null) {
      notify('Hata: Alarm kimliği okunamadı.', 'error');
      return;
    }
    try {
      setActionBusyId(alarmId);
      await acknowledgeAlarm(alarmId);
      notify('Alarm onaylandı.', 'success');
    } catch (error) {
      notify(getApiErrorMessage(error, 'Alarm onayı kaydedilemedi.'), 'error');
    } finally {
      setActionBusyId(null);
    }
  }, [canManageAlarms, notify]);

  const handleResolve = useCallback(async (alarmId) => {
    if (!canManageAlarms) {
      notify('Alarm çözme yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    if (alarmId == null) {
      notify('Hata: Alarm kimliği okunamadı.', 'error');
      return;
    }
    if (!(await confirm('Bu alarmı Çöz olarak işaretlemek istediğinize emin misiniz? Kayıt silinmez.'))) {
      return;
    }
    try {
      setActionBusyId(alarmId);
      await resolveAlarm(alarmId);
      setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== alarmId));
      notify('Alarm çözüldü / kapatıldı.', 'success');
    } catch (error) {
      notify(getApiErrorMessage(error, 'Alarm çözülemedi.'), 'error');
    } finally {
      setActionBusyId(null);
    }
  }, [canManageAlarms, confirm, notify]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Andon sits outside MainLayout; respect UI persona from session (operator has no Andon access).
  let activePersona = 'admin';
  try {
    activePersona = sessionStorage.getItem('mm_active_persona') || 'admin';
  } catch {
    // ignore
  }
  if (activePersona === 'operator') {
    return <Navigate to="/operator" replace />;
  }

  return (
    <div className="andon-shell">
      <header className="andon-top">
        <div className="andon-brand">
          <VestelMark className="text-[color:var(--color-vestel)]" size={28} />
          <div>
            <strong>VESTEL MES ANDON</strong>
            <span>{currentUser?.name} · Canlı saha panosu{loading ? ' · yükleniyor…' : ''}</span>
          </div>
        </div>
        <div className="andon-meta">
          <span className={`andon-live ${hubConnected ? 'on' : 'off'}`}>
            <Radio size={16} />
            {hubConnected ? 'CANLI' : 'YENİDEN BAĞLANIYOR'}
          </span>
          <span
            className={`andon-live ${simEnabled === true ? 'on' : 'off'}`}
            title="Backend fabrika simülasyonu (DB’de kalıcı)"
          >
            {simEnabled == null ? 'SİM …' : simEnabled ? 'SİM AÇIK' : 'SİM KAPALI'}
          </span>
          <strong>{clock.toLocaleTimeString('tr-TR')}</strong>
          <Link to="/fabrika" className="andon-exit">Panele Dön</Link>
        </div>
      </header>

      <section className="andon-summary">
        <article>
          <small>Ortalama OEE (Oturum)</small>
          <strong>{averageSessionOee == null ? '—' : `%${averageSessionOee.toFixed(1)}`}</strong>
          {plantSessionGood != null && (
            <span className="andon-summary-sub">Σ Sağlam {plantSessionGood}</span>
          )}
        </article>
        <article className={openAlarmCount > 0 ? 'alert' : ''}>
          <small>Açık Alarm</small>
          <strong>{openAlarmCount}</strong>
        </article>
        <article>
          <small>Ortalama OEE (Katalog)</small>
          <strong>{averageCatalogOee == null ? '—' : `%${averageCatalogOee.toFixed(1)}`}</strong>
          {plantCatalogGood != null && (
            <span className="andon-summary-sub">Σ Sağlam {plantCatalogGood}</span>
          )}
        </article>
      </section>

      <section className="andon-stations">
        {ANDON_STATIONS.map((stationId) => {
          const catalog = oeeByStation[stationId];
          const session = sessionByStation[stationId];
          const sessionOee = session?.oee;
          const hasSession = Boolean(session);
          const primary = hasSession ? sessionOee : catalog;
          const oee = primary?.oee;
          const alarmMeta = alarmsByStation[stationId] || { count: 0, isDown: false };
          const stationAlarmCount = alarmMeta.count;
          // Open alarms (and latest-tick downtime) drive DURAKLADI — sim no longer writes
          // identical downtime ticks every interval while Paused/Down.
          const downtimeSource = sessionOee || catalog;
          const paused = hasActiveDowntime(downtimeSource) || stationAlarmCount > 0;
          const isDown = alarmMeta.isDown || (paused && stationAlarmCount > 0 && (downtimeSource?.downtimeReasonCode === 'BREAKDOWN'));
          const tone = stationAlarmCount > 0
            ? 'alarm'
            : !simEnabled
              ? 'idle'
              : paused
                ? 'paused'
                : oee == null
                  ? 'idle'
                  : oee >= 85
                    ? 'good'
                    : oee >= 60
                      ? 'warn'
                      : 'bad';
          const statusLabel = runtimeBadgeLabel({
            simEnabled,
            hasMetric: primary != null && oee != null,
            paused,
            hasAlarm: stationAlarmCount > 0,
            isDown,
          });
          const statusClass = isDown
            ? 'down'
            : stationAlarmCount > 0
              ? 'paused'
              : !simEnabled
                ? 'sim-off'
                : paused
                  ? 'paused'
                  : (primary == null || oee == null)
                    ? 'idle'
                    : 'running';
          const catalogOeeLabel = catalog?.oee == null ? '—' : `%${Number(catalog.oee).toFixed(1)}`;
          const catalogOk = catalog?.goodProduction ?? '—';
          const catalogNok = catalog?.scrapProduction ?? '—';
          // Open blocking alarms pause the line but may not yet appear on the last metric tick.
          const metricDowntime = primary?.downtimeReason || catalog?.downtimeReason;
          const downtimeLabel = (() => {
            if (stationAlarmCount > 0) {
              const titles = alarmMeta.titles || [];
              if (titles.length === 1) return `Alarm · ${titles[0]}`;
              if (titles.length > 1) return `Alarm · ${titles[0]} (+${titles.length - 1})`;
              return `Açık alarm (${stationAlarmCount})`;
            }
            if (metricDowntime && hasActiveDowntime({ downtimeReason: metricDowntime })) {
              return metricDowntime;
            }
            return 'Yok';
          })();
          return (
            <article key={stationId} className={`andon-station ${tone}`}>
              <header>
                <h2>{getStationDisplayName(stationId)}</h2>
                <div className="andon-station-badges">
                  {stationAlarmCount > 0 && (
                    <span className="andon-badge alarm">Alarm{stationAlarmCount > 1 ? ` ×${stationAlarmCount}` : ''}</span>
                  )}
                  <span className={`andon-badge ${statusClass}`}>{statusLabel}</span>
                  {hasSession ? (
                    <span className="andon-badge session">
                      OTURUM · {session.operatorName || 'Operatör'}
                    </span>
                  ) : (
                    <span className="andon-badge idle">Oturum yok</span>
                  )}
                  {!stationAlarmCount && !paused && simEnabled && catalog?.shiftName && (
                    <span className="andon-badge shift">{catalog.shiftName || catalog.shiftCode}</span>
                  )}
                </div>
              </header>
              <div className="andon-oee">
                <OeeGauge
                  value={oee == null ? null : Number(oee)}
                  label="OEE"
                  ariaLabel={
                    oee == null
                      ? (hasSession ? 'Oturum OEE veri yok' : 'Katalog OEE veri yok')
                      : `${hasSession ? 'Oturum' : 'Katalog'} OEE ${Number(oee).toFixed(1)} yüzde`
                  }
                />
              </div>
              <p className="andon-catalog-line">
                Katalog {catalogOeeLabel} · OK {catalogOk} / NOK {catalogNok}
              </p>
              <dl>
                <div><dt>Kullanılabilirlik</dt><dd>{primary?.availability ?? '—'}%</dd></div>
                <div><dt>Performans</dt><dd>{primary?.performance ?? '—'}%</dd></div>
                <div><dt>Kalite</dt><dd>{primary?.quality ?? '—'}%</dd></div>
                <div>
                  <dt>Σ Sağlam / Fire</dt>
                  <dd>{primary?.goodProduction ?? '—'} / {primary?.scrapProduction ?? '—'}</dd>
                </div>
                <div><dt>Duruş</dt><dd>{downtimeLabel}</dd></div>
              </dl>
              {(paused || stationAlarmCount > 0) && (
                <p className="andon-resume-hint">
                  {stationAlarmCount > 0
                    ? 'Kalite/Andon\'dan alarm çöz → Üretime Dön'
                    : 'Operatör panelinden Üretime Dön veya Vardiya Başlat'}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="andon-alarms" id="andon-alarms">
        <header>
          <div className="andon-alarms-title">
            <AlertTriangle size={20} />
            <div>
              <h2>Canlı Alarmlar</h2>
              <span>
                {openAlarmCount === 0
                  ? 'Aktif açık alarm yok'
                  : `${openAlarmCount} açık alarm · istasyonların altında`}
                {canManageAlarms ? ' · Onayla / Çöz aktif' : ''}
              </span>
            </div>
          </div>
          {openAlarmCount > 0 && (
            <span className="andon-alarms-count">{openAlarmCount}</span>
          )}
        </header>

        {alarms.length === 0 ? (
          <p className="andon-empty">Aktif alarm yok — hat temiz.</p>
        ) : (
          <ul>
            {alarms.map((alarm) => {
              const alarmId = alarm.id ?? alarm.Id ?? alarm.alarmId ?? alarm.AlarmId;
              const status = alarm.status || 'Açık';
              const acknowledged = isAcknowledgedAlarm(status);
              const busy = actionBusyId === alarmId;
              return (
                <li key={alarmId} className={`tone-${severityTone(alarm.severity)}`}>
                  <div className="andon-alarm-main">
                    <strong>{alarm.title}</strong>
                    <span>
                      {getStationDisplayName(alarm.station) || alarm.station || '—'}
                      {' · '}
                      {alarm.severity || '—'}
                      {' · '}
                      {status}
                    </span>
                  </div>
                  <div className="andon-alarm-side">
                    <small>{alarm.time ? new Date(alarm.time).toLocaleTimeString('tr-TR') : '—'}</small>
                    {canManageAlarms && (
                      <div className="andon-alarm-actions">
                        {!acknowledged && (
                          <button
                            type="button"
                            className="andon-btn secondary"
                            disabled={busy || alarmId == null}
                            onClick={() => handleAcknowledge(alarmId)}
                          >
                            <CheckCircle size={14} />
                            Onayla
                          </button>
                        )}
                        <button
                          type="button"
                          className="andon-btn primary"
                          disabled={busy || alarmId == null}
                          onClick={() => handleResolve(alarmId)}
                        >
                          <CheckCheck size={14} />
                          Çöz
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AndonPage;
