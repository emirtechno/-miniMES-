import { useCallback, useEffect, useState } from 'react';
import {
  acknowledgeAlarm,
  createAlarm,
  resolveAlarm,
  fetchAlarms,
  getApiErrorMessage,
} from '../services/api';
import { DEFAULT_STATION, ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';
import { useMesHub } from './useMesHub';

const ACTIVE_STATION_IDS = new Set(ACTIVE_STATION_DEFINITIONS.map((s) => s.id));

// NEDEN: Operatör/admin alarm listesi — açık + geçmiş; SignalR ile anında upsert.
// NASIL: openOnly canlı; scope=resolved geçmiş; emekli istasyon alarmları filtrelenir.

const isActiveStationAlarm = (alarm) => {
  const station = alarm?.station || alarm?.Station;
  return Boolean(station && ACTIVE_STATION_IDS.has(station));
};

const isClosedAlarm = (status) => {
  const value = (status || '').toLowerCase();
  return value === 'çözüldü' || value === 'kapalı' || value === 'resolved';
};

const TEST_ALARM_TEMPLATES = [
  {
    title: 'Aşırı Isınma Uyarısı - Motor #2',
    severity: 'Kritik',
    description: 'Motor #2 yatak sıcaklığı eşik değerini aştı. Hat duruş riski.',
  },
  {
    title: 'Konveyör Sıkışması',
    severity: 'Yüksek',
    description: 'Paketleme konveyöründe ürün sıkışması algılandı.',
  },
  {
    title: 'Kalite Sapması - Vision Sensör',
    severity: 'Uyarı',
    description: 'Vision kamera NOK oranı son 5 dakikada yükseldi.',
  },
  {
    title: 'Hammadde Besleme Hatası',
    severity: 'Yüksek',
    description: 'Montaj hattı hammadde besleme ünitesinde kesinti.',
  },
  {
    title: 'Acil Stop Butonu Basıldı',
    severity: 'Kritik',
    description: 'Operatör acil stop butonunu aktive etti. Hat güvenli moda alındı.',
  },
];

const upsertAlarm = (current, alarm) => {
  const id = alarm.id ?? alarm.Id;
  const next = [alarm, ...current.filter((item) => (item.id ?? item.Id) !== id)];
  return next.slice(0, 200);
};

export function useAlarms({
  isAuthenticated,
  canCreateAlarms,
  canManageAlarms,
  notify,
  confirm,
}) {
  const [alarms, setAlarms] = useState([]);
  const [historyAlarms, setHistoryAlarms] = useState([]);
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [alarmError, setAlarmError] = useState(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualStation, setManualStation] = useState(DEFAULT_STATION);
  const [manualSeverity, setManualSeverity] = useState('Uyarı');
  const [manualDescription, setManualDescription] = useState('');

  const loadAlarms = useCallback(async (signal) => {
    try {
      setAlarmLoading(true);
      // Canlı liste = açık (+ Onaylandı); geçmiş = soft-resolve (aynı Alarms tablosu).
      const [openPage, historyPage] = await Promise.all([
        fetchAlarms({ signal, openOnly: true, limit: 50 }),
        fetchAlarms({ signal, scope: 'resolved', limit: 50 }),
      ]);
      setAlarms((openPage.items || []).filter(isActiveStationAlarm));
      setHistoryAlarms((historyPage.items || []).filter(isActiveStationAlarm));
      setAlarmError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setAlarmError(getApiErrorMessage(err, 'Alarmlar alınırken hata oluştu.'));
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    loadAlarms(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadAlarms]);

  const { connected } = useMesHub({
    onAlarmCreated: (alarm) => {
      if (!isActiveStationAlarm(alarm)) return;
      setAlarms((current) => upsertAlarm(current, alarm));
      const title = alarm.title || alarm.Title || 'Alarm';
      const stationId = alarm.station || alarm.Station || '';
      const station = stationId ? getStationDisplayName(stationId) : 'İstasyon';
      const severity = alarm.severity || alarm.Severity || '';
      notify(
        `Yeni alarm · ${station}${severity ? ` · ${severity}` : ''}: ${title}`,
        'error',
      );
    },
    onAlarmUpdated: (alarm) => {
      const status = alarm.status || alarm.Status || '';
      // Onaylandı canlı listede kalır (Çöz gerekir); yalnızca Çözüldü/Kapalı canlıdan düşer.
      const closed = isClosedAlarm(status);
      const id = alarm.id ?? alarm.Id;
      if (closed) {
        setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
        if (isActiveStationAlarm(alarm)) {
          setHistoryAlarms((current) => upsertAlarm(current, alarm));
        }
        return;
      }
      if (!isActiveStationAlarm(alarm)) {
        setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
        return;
      }
      setAlarms((current) => upsertAlarm(current, alarm));
    },
    onAlarmDeleted: (payload) => {
      const id = payload?.id ?? payload?.Id;
      setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
      setHistoryAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
    },
  });

  const createTestAlarm = useCallback(async () => {
    if (!canCreateAlarms) {
      notify('Alarm oluşturma yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      setAlarmLoading(true);
      const template = TEST_ALARM_TEMPLATES[Math.floor(Math.random() * TEST_ALARM_TEMPLATES.length)];
      const stations = ACTIVE_STATION_DEFINITIONS.map((s) => s.id);
      const station = stations[Math.floor(Math.random() * stations.length)] || DEFAULT_STATION;
      await createAlarm({
        title: template.title,
        station,
        severity: template.severity,
        description: template.description,
      });
      if (!connected) await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Test alarmı oluşturulurken hata oluştu.'), 'error');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  }, [canCreateAlarms, connected, loadAlarms, notify]);

  const createManualAlarm = useCallback(async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!canCreateAlarms) {
      notify('Alarm oluşturma yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      setAlarmLoading(true);
      await createAlarm({
        title: manualTitle || 'Manuel Alarm',
        station: manualStation || DEFAULT_STATION,
        severity: manualSeverity || 'Uyarı',
        description: manualDescription || '',
      });
      setManualTitle('');
      setManualStation(DEFAULT_STATION);
      setManualSeverity('Uyarı');
      setManualDescription('');
      if (!connected) await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Manuel alarm eklenirken hata oluştu.'), 'error');
      console.error(err);
    } finally {
      setAlarmLoading(false);
    }
  }, [canCreateAlarms, connected, loadAlarms, manualDescription, manualSeverity, manualStation, manualTitle, notify]);

  const handleResolveAlarm = useCallback(async (id) => {
    if (!canManageAlarms) {
      notify('Alarm çözme yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    if (!id) {
      notify('Hata: Alarm kimliği okunamadı.', 'error');
      return;
    }
    if (!(await confirm('Bu alarmı Çöz/Kapat olarak işaretlemek istediğinize emin misiniz? Kayıt silinmez.'))) {
      return;
    }
    try {
      const resolved = await resolveAlarm(id);
      if (!connected) {
        await loadAlarms();
      } else if (resolved) {
        setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
        if (isActiveStationAlarm(resolved)) {
          setHistoryAlarms((current) => upsertAlarm(current, resolved));
        }
      }
      notify('Alarm çözüldü / kapatıldı (audit korundu).', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm çözülemedi.'), 'error');
      console.error(err);
    }
  }, [canManageAlarms, confirm, connected, loadAlarms, notify]);

  const handleAcknowledgeAlarm = useCallback(async (id) => {
    if (!canManageAlarms) {
      notify('Alarm onaylama yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      await acknowledgeAlarm(id);
      if (!connected) await loadAlarms();
      notify('Alarm onaylandı — yönetici farkındalığı kaydedildi.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm onayı kaydedilirken hata oluştu.'), 'error');
      console.error(err);
    }
  }, [canManageAlarms, connected, loadAlarms, notify]);

  return {
    alarms,
    historyAlarms,
    alarmLoading,
    alarmError,
    liveConnected: connected,
    loadAlarms,
    createTestAlarm,
    createManualAlarm,
    handleResolveAlarm,
    handleAcknowledgeAlarm,
    alarmForm: {
      title: manualTitle,
      station: manualStation,
      severity: manualSeverity,
      description: manualDescription,
      onTitleChange: (event) => setManualTitle(event.target.value),
      onStationChange: (event) => setManualStation(event.target.value),
      onSeverityChange: (event) => setManualSeverity(event.target.value),
      onDescriptionChange: (event) => setManualDescription(event.target.value),
      onSubmit: createManualAlarm,
    },
  };
}
