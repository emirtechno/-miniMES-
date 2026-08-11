import { useState } from 'react';
import { AlertTriangle, CheckCircle, CheckCheck, ChevronDown, ChevronRight, History } from 'lucide-react';
import CardHeader from './CardHeader';
import { getStationDisplayName } from '../constants/stations';

// NEDEN: Alarm kartı — Onayla = farkındalık (hâlâ açık); Çöz/Kapat = soft-resolve (kayıt silinmez, audit kalır).
// NASIL: Açık/Onaylandı/Çözüldü kenar rengi; geçmiş paneli scope=resolved listesini gösterir.
function AlarmCard({ alarm, onAcknowledge, onResolve, readOnly }) {
  const alarmId = alarm.id ?? alarm.Id ?? alarm.alarmId ?? alarm.AlarmId;
  const status = alarm.status || '';
  const isOpen = status === 'Açık';
  const isAcknowledged = status === 'Onaylandı';
  const isResolved = status === 'Çözüldü' || status === 'Kapalı';
  const borderTone = isResolved
    ? 'border-l-slate-400'
    : isAcknowledged
      ? 'border-l-amber-500'
      : 'border-l-red-500';

  return (
    <div className={`rounded-xl border border-[color:var(--color-line)] border-l-4 bg-white p-4 ${borderTone}`}>
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

      {!readOnly && (
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
      )}
      {readOnly && isResolved && (
        <div className="flex justify-end">
          <span className="text-xs font-semibold text-slate-600">Kapalı (audit korundu)</span>
        </div>
      )}
    </div>
  );
}

function AlarmPanel({ alarms, historyAlarms = [], onAcknowledge, onResolve }) {
  // NEDEN: Canlı liste + daraltılabilir geçmiş (resolved). DELETE ürün modelinde hard-delete değil.
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={AlertTriangle}
        title={`Alarm ve Duruş Takibi (${alarms.length})`}
        subtitle="Onayla = farkındalık kaydı · Çöz/Kapat = duruşu kapatır (silinmez)"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {alarms.map((alarm, idx) => (
          <AlarmCard
            key={alarm.id ?? alarm.Id ?? idx}
            alarm={alarm}
            onAcknowledge={onAcknowledge}
            onResolve={onResolve}
          />
        ))}
        {alarms.length === 0 && (
          <p className="col-span-full text-sm text-[color:var(--color-muted)]">
            Aktif açık alarm yok.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-[color:var(--color-line)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <History size={16} className="text-[color:var(--color-muted)]" />
            Alarm Geçmişi
            <span className="text-[color:var(--color-muted)]">({historyAlarms.length})</span>
          </span>
          <span className="text-xs text-[color:var(--color-muted)]">
            Çözülmüş / kapatılmış alarmlar (audit)
          </span>
        </button>
        {historyOpen && (
          <div className="border-t border-[color:var(--color-line)] px-3 pb-3 pt-3">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {historyAlarms.map((alarm, idx) => (
                <AlarmCard
                  key={alarm.id ?? alarm.Id ?? `h-${idx}`}
                  alarm={alarm}
                  readOnly
                />
              ))}
              {historyAlarms.length === 0 && (
                <p className="col-span-full py-4 text-center text-sm text-[color:var(--color-muted)]">
                  Alarm geçmişi boş.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AlarmPanel;
