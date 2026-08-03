import { AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import CardHeader from './CardHeader';
import { getStationDisplayName } from '../constants/stations';

function AlarmPanel({ alarms, onAcknowledge, onDelete }) {
  return (
    <section className="mes-surface p-5">
      <CardHeader
        icon={AlertTriangle}
        title={`Alarm ve Duruş Takibi (${alarms.length})`}
        subtitle="Açık alarmları onaylayın veya silin"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {alarms.map((alarm, idx) => {
          const alarmId = alarm.id ?? alarm.Id ?? alarm.alarmId ?? alarm.AlarmId;
          const isOpen = alarm.status === 'Açık';
          return (
            <div
              key={alarmId || idx}
              className={`rounded-xl border border-[color:var(--color-line)] bg-white p-4 border-l-4 ${
                isOpen ? 'border-l-red-500' : 'border-l-emerald-500'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="m-0 text-base font-semibold text-slate-900">{alarm.title}</h4>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(alarm)}
                    className="mes-btn-ghost shrink-0"
                    title="Alarmı Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <p className="mt-1 mb-2 text-sm text-[color:var(--color-muted)]">
                {getStationDisplayName(alarm.station) || alarm.station}
              </p>
              <p className="mb-3 text-sm text-slate-700">{alarm.description}</p>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[color:var(--color-muted)]">
                  {alarm.time ? new Date(alarm.time).toLocaleString('tr-TR') : ''}
                </span>

                {isOpen && onAcknowledge && alarmId != null ? (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(alarmId)}
                    className="mes-btn-danger"
                  >
                    <CheckCircle size={16} />
                    Onayla
                  </button>
                ) : isOpen ? (
                  <span className="text-xs font-semibold text-amber-700">Kimlik yok</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600">Onaylandı</span>
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
