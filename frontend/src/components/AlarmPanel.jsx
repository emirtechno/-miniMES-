import { AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

function AlarmPanel({ alarms, onAcknowledge, onDelete }) {
  return (
    <section className="custom-card">
      <div className="card-header">
        <AlertTriangle style={{ color: '#ef4444' }} size={20} />
        <span>Alarm ve Duruş Takibi ({alarms.length})</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {alarms.map((alarm, idx) => {
          const alarmId = alarm.id ?? alarm.Id ?? alarm.alarmId ?? alarm.AlarmId;
          return (
            <div
              key={alarmId || idx}
              style={{
                borderLeft: `5px solid ${alarm.status === 'Onaylandı' ? '#10b981' : '#ef4444'}`,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                position: 'relative'
              }}
            >
              {/* Kart Üst Başlık ve Silme Butonu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>{alarm.title}</h4>
                
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(alarm)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '4px'
                    }}
                    title="Alarmı Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}>{alarm.station}</p>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#334155' }}>{alarm.description}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {alarm.time ? new Date(alarm.time).toLocaleString('tr-TR') : ''}
                </span>
                
                {alarm.status === 'Açık' && onAcknowledge ? (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(alarmId)}
                    className="btn-primary"
                    style={{ background: '#ef4444', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCircle size={14} />
                    Onayla
                  </button>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Onaylandı</span>
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
