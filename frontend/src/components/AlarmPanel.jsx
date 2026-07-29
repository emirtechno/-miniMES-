import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react';

const AlarmPanel = ({ alarms, onAcknowledge }) => {
  return (
    <section className="custom-card">
      <div className="card-header">
        <AlertTriangle size={20} />
        <span>Alarm ve Duruş Takibi</span>
      </div>

      <div className="grid-two">
        {alarms.map((alarm) => (
          <div key={alarm.id} className={`alarm-card ${alarm.status === 'Açık' ? 'alarm-open' : 'alarm-ack'}`}>
            <div className="alarm-header">
              <div>
                <div className="alarm-title">{alarm.title}</div>
                <div className="alarm-subtitle">{alarm.station}</div>
              </div>
              <span className={`badge ${alarm.severity === 'Kritik' ? 'badge-nok' : alarm.severity === 'Uyarı' ? 'badge-warning' : 'badge-neutral'}`}>
                {alarm.severity}
              </span>
            </div>

            <div className="alarm-meta">
              <span><Clock3 size={14} /> {alarm.time}</span>
              <span>{alarm.status}</span>
            </div>

            <div className="alarm-description">{alarm.description}</div>

            {alarm.status === 'Açık' && (
              <button className="btn-primary" style={{ marginTop: '10px', height: '36px' }} onClick={() => onAcknowledge(alarm.id)}>
                <ShieldCheck size={16} />
                Onayla
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default AlarmPanel;
