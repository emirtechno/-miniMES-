import { useCallback, useEffect, useState } from 'react';
import {
  acknowledgeAlarm,
  createAlarm,
  deleteAlarm,
  fetchAlarms,
  getApiErrorMessage,
} from '../services/api';
import { DEFAULT_STATION } from '../constants/stations';
import { useMesHub } from './useMesHub';

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
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [alarmError, setAlarmError] = useState(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualStation, setManualStation] = useState(DEFAULT_STATION);
  const [manualSeverity, setManualSeverity] = useState('Uyarı');
  const [manualDescription, setManualDescription] = useState('');
  const [liveAlarmToast, setLiveAlarmToast] = useState(null);

  const loadAlarms = useCallback(async (signal) => {
    try {
      setAlarmLoading(true);
      const page = await fetchAlarms({ signal });
      setAlarms(page.items);
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
      setAlarms((current) => upsertAlarm(current, alarm));
      setLiveAlarmToast(alarm);
      notify(`Yeni alarm: ${alarm.title || alarm.Title}`, 'error');
    },
    onAlarmUpdated: (alarm) => {
      setAlarms((current) => upsertAlarm(current, alarm));
    },
    onAlarmDeleted: (payload) => {
      const id = payload?.id ?? payload?.Id;
      setAlarms((current) => current.filter((item) => (item.id ?? item.Id) !== id));
    },
  });

  useEffect(() => {
    if (!liveAlarmToast) return undefined;
    const timer = window.setTimeout(() => setLiveAlarmToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [liveAlarmToast]);

  const createTestAlarm = useCallback(async () => {
    if (!canCreateAlarms) {
      notify('Alarm oluşturma yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    try {
      setAlarmLoading(true);
      await createAlarm({
        title: 'Test Alarmı - Sensör Uyarısı',
        station: DEFAULT_STATION,
        severity: 'Uyarı',
        description: 'Test amaçlı oluşturulmuş alarm.',
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

  const handleDeleteAlarm = useCallback(async (alarmOrId) => {
    const id = typeof alarmOrId === 'object'
      ? (alarmOrId.id ?? alarmOrId.Id ?? alarmOrId.alarmId ?? alarmOrId.AlarmId)
      : alarmOrId;
    if (!canManageAlarms) {
      notify('Alarm silme yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    if (!id) {
      notify('Hata: Silinecek alarmın ID bilgisi okunamadı!', 'error');
      return;
    }
    if (!(await confirm('Bu alarmı silmek istediğinize emin misiniz?'))) return;
    try {
      await deleteAlarm(id);
      if (!connected) await loadAlarms();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm silinirken hata oluştu.'), 'error');
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
    } catch (err) {
      notify(getApiErrorMessage(err, 'Alarm onayı kaydedilirken hata oluştu.'), 'error');
      console.error(err);
    }
  }, [canManageAlarms, connected, loadAlarms, notify]);

  return {
    alarms,
    alarmLoading,
    alarmError,
    liveConnected: connected,
    liveAlarmToast,
    loadAlarms,
    createTestAlarm,
    createManualAlarm,
    handleDeleteAlarm,
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
