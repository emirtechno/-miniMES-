import { AlertTriangle, CheckCircle, CheckCheck } from 'lucide-react';
import CardHeader from './CardHeader';
import { getStationDisplayName } from '../constants/stations';

function AlarmPanel({ alarms, onAcknowledge, onResolve }) {
  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={AlertTriangle}
        title={`Alarm ve Duruş Takibi (${alarms.length})`}
        subtitle="Onayla = farkındalık kaydı · Çöz/Kapat = duruşu kapatır (silinmez)"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {alarms.map((alarm, idx) => {
          const alarmId = alarm.id ?? alarm.Id ?? alarm.alarmId ?? alarm.AlarmId;
          const status = alarm.status || '';
          const isOpen = status === 'Açık';
          const isAcknowledged = status === 'Onaylandı';
          const isResolved = status === 'Çözüldü';
          const borderTone = isResolved
            ? 'border-l-slate-400'
            : isAcknowledged
              ? 'border-l-amber-500'
              : 'border-l-red-500';

          return (
            <div
              key={alarmId || idx}
              className={`rounded-xl border border-[color:var(--color-line)] border-l-4 bg-white p-4 ${borderTone}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="m-0 text-base font-semibold text-slate-900">{alarm.title}</h4>
                <span className={
                  isResolved ? 'mes-pill-neutral' : isAcknowledged ? 'mes-pill-warn' : 'mes-pill-nok'
                }>
                  {status || '—'}
                </span>
              </div>

              <p className="mt-1 mb-2 text-sm text-[color:var(--color-muted)]">
                {getStationDisplayName(alarm.station) || alarm.station}
              </p>
              <p className="mb-3 text-sm text-slate-700">{alarm.description}</p>

              <div className="mb-3 space-y-1 text-xs text-[color:var(--color-muted)]">
                <div>Oluşturma: {alarm.time ? new Date(alarm.time).toLocaleString('tr-TR') : '—'}</div>
                {alarm.acknowledgedAt && (
                  <div>
                    Onay: {new Date(alarm.acknowledgedAt).toLocaleString('tr-TR')}
                    {alarm.acknowledgedBy ? ` · ${alarm.acknowledgedBy}` : ''}
                  </div>
                )}
                {alarm.resolvedAt && (
                  <div>
                    Çözüm: {new Date(alarm.resolvedAt).toLocaleString('tr-TR')}
                    {alarm.resolvedBy ? ` · ${alarm.resolvedBy}` : ''}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isOpen && onAcknowledge && alarmId != null && (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(alarmId)}
                    className="mes-btn-secondary"
                    title="Yönetici farkındalığını kaydet"
                  >
                    <CheckCircle size={16} />
                    Onayla
                  </button>
                )}
                {!isResolved && onResolve && alarmId != null && (
                  <button
                    type="button"
                    onClick={() => onResolve(alarmId)}
                    className="mes-btn-primary"
                    title="Duruşu kapat / çöz (audit kaydı korunur)"
                  >
                    <CheckCheck size={16} />
                    Çöz / Kapat
                  </button>
                )}
                {isResolved && (
                  <span className="text-xs font-semibold text-slate-600">Kapalı (audit korundu)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default AlarmPanel;
