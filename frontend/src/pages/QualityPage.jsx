import { AlertTriangle, RefreshCw, Trash2, XCircle } from 'lucide-react';
import AlarmPanel from '../components/AlarmPanel';
import TraceabilityPanel from '../components/TraceabilityPanel';
import UserRolePanel from '../components/UserRolePanel';
import WorkOrderBoard from '../components/WorkOrderBoard';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';

const QualityPage = ({
  workOrders,
  alarms,
  batches,
  deleted,
  production,
  permissions,
  alarmForm,
  workOrderForm,
}) => {
  const failedRecords = production.records.filter((record) => record.kaliteDurumu === 'NOK');

  return (
    <div className="flex flex-col gap-5">
      <WorkOrderBoard
        workOrders={workOrders.items}
        formValues={workOrderForm.values}
        onFieldChange={workOrderForm.onFieldChange}
        onSubmit={permissions.canManageWorkOrders ? workOrderForm.onSubmit : workOrderForm.onDenied}
        onAdvance={permissions.canManageWorkOrders ? workOrders.onAdvance : workOrderForm.onDenied}
        disabled={!permissions.canManageWorkOrders}
      />

      {permissions.canCreateAlarms && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <button type="button" className="btn-primary" onClick={alarms.onCreateTest} disabled={alarms.loading}>
            {alarms.loading ? 'Alarm oluşturuluyor...' : 'Test Alarmı Oluştur'}
          </button>
          <form onSubmit={alarmForm.onSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Başlık" value={alarmForm.title} onChange={alarmForm.onTitleChange} className="input-field" />
            <select value={alarmForm.station} onChange={alarmForm.onStationChange} className="input-field">
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
            <select value={alarmForm.severity} onChange={alarmForm.onSeverityChange} className="input-field">
              <option>Uyarı</option><option>Düşük</option><option>Yüksek</option><option>Kritik</option>
            </select>
            <input placeholder="Açıklama" value={alarmForm.description} onChange={alarmForm.onDescriptionChange} className="input-field" />
            <button type="submit" className="btn-primary" disabled={alarms.loading}>Manuel Alarm Ekle</button>
          </form>
          {alarms.error && <span className="error">{alarms.error}</span>}
        </div>
      )}

      <AlarmPanel
        alarms={alarms.items}
        onAcknowledge={permissions.canManageAlarms ? alarms.onAcknowledge : undefined}
        onDelete={permissions.canManageAlarms ? alarms.onDelete : undefined}
      />
      <TraceabilityPanel batches={batches} />
      {permissions.canManageUsers && <UserRolePanel />}

      {permissions.canViewDeleted && (
        <section className="custom-card">
          <div className="card-header">
            <RefreshCw size={20} />
            <span>Çöp Kutusu / Silinen Kayıtlar ({deleted.items.length})</span>
          </div>
          {deleted.loading && <p>Silinen kayıtlar yükleniyor...</p>}
          {deleted.error && <p className="error">{deleted.error}</p>}
          {!deleted.loading && !deleted.error && (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead><tr><th>ID</th><th>Ürün Kodu</th><th>Malzeme</th><th>İstasyon</th><th>Üretim Tarihi</th><th>Silen</th><th>Silinme Zamanı</th><th>Aksiyon</th></tr></thead>
                <tbody>
                  {deleted.items.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center' }}>Çöp kutusunda kayıt yok.</td></tr>
                  ) : deleted.items.map((record) => (
                    <tr key={record.id}>
                      <td>#{record.id}</td><td>{record.urun20liKod}</td><td>{record.malzeme12liKod}</td>
                      <td>{getStationDisplayName(record.istasyonAdi)}</td>
                      <td>{new Date(record.uretimTarihi).toLocaleString('tr-TR')}</td>
                      <td>{record.deletedByUsername || '—'}</td>
                      <td>{record.deletedAtUtc ? new Date(record.deletedAtUtc).toLocaleString('tr-TR') : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {permissions.canManageProduction ? (
                            <button type="button" className="btn-primary" onClick={() => deleted.onRestore(record.id)}>
                              <RefreshCw size={16} /> Geri Yükle
                            </button>
                          ) : <span>Yetki Yok</span>}
                          {permissions.canHardDelete && deleted.onHardDelete && (
                            <button type="button" className="btn-delete" onClick={() => deleted.onHardDelete(record.id)}>
                              <Trash2 size={16} /> Kalıcı Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="custom-card" style={{ borderLeft: '5px solid #ef4444' }}>
        <div className="card-header" style={{ color: '#ef4444' }}>
          <AlertTriangle size={20} />
          <span>Kalite Kontrol Alarm & Hata Özeti</span>
        </div>
        <p>Aşağıdaki tabloda NOK olarak işaretlenmiş ürünler listelenmektedir.</p>
      </section>

      <section className="custom-card">
        <div className="card-header"><XCircle color="#ef4444" size={20} /><span>Hatalı Ürünler ({failedRecords.length})</span></div>
        <div className="table-wrapper">
          <table className="modern-table">
            <thead><tr><th>ID</th><th>Ürün Kodu</th><th>Malzeme</th><th>İstasyon</th><th>Durum</th><th>Aksiyon</th></tr></thead>
            <tbody>
              {failedRecords.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#10b981' }}>Hatalı kayıt bulunmuyor.</td></tr>
              ) : failedRecords.map((record) => (
                <tr key={record.id}>
                  <td>#{record.id}</td><td>{record.urun20liKod}</td><td>{record.malzeme12liKod}</td><td>{getStationDisplayName(record.istasyonAdi)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={permissions.canChangeQuality ? () => production.onToggleQuality(record) : undefined}
                      className="badge badge-nok"
                      disabled={!permissions.canChangeQuality}
                    >
                      <XCircle size={14} /> {record.kaliteDurumu}
                    </button>
                  </td>
                  <td>
                    {permissions.canManageProduction ? (
                      <button type="button" onClick={() => production.onDelete(record.id)} className="btn-delete">
                        <Trash2 size={18} />
                      </button>
                    ) : <span>Yetki Yok</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default QualityPage;
