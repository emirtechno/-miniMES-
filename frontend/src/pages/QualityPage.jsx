import { AlertTriangle, BellPlus, XCircle } from 'lucide-react';
import AlarmPanel from '../components/AlarmPanel';
import TraceabilityPanel from '../components/TraceabilityPanel';
import UserRolePanel from '../components/UserRolePanel';
import WorkOrderBoard from '../components/WorkOrderBoard';
import CardHeader from '../components/CardHeader';
import { ACTIVE_STATION_DEFINITIONS, getStationDisplayName } from '../constants/stations';

const QualityPage = ({
  workOrders,
  alarms,
  batches,
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
        onCreateSample={permissions.canManageWorkOrders ? workOrders.onCreateSample : undefined}
        creatingSample={workOrders.creatingSample}
        disabled={!permissions.canManageWorkOrders}
      />

      {permissions.canCreateAlarms && (
        <section className="mes-surface p-5">
          <CardHeader
            icon={BellPlus}
            title="Alarm Oluşturma"
            subtitle="Test veya manuel shop-floor alarmı (Live Stream anomali alarmlarını da Andon’a düşürür)"
            actions={(
              <button type="button" className="mes-btn-primary" onClick={alarms.onCreateTest} disabled={alarms.loading}>
                <AlertTriangle size={16} />
                {alarms.loading ? 'Oluşturuluyor...' : 'Test Alarmı Oluştur'}
              </button>
            )}
          />
          <form onSubmit={alarmForm.onSubmit} className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <input placeholder="Başlık (≥3)" value={alarmForm.title} onChange={alarmForm.onTitleChange} className="mes-input" minLength={3} required />
            <select value={alarmForm.station} onChange={alarmForm.onStationChange} className="mes-input">
              {ACTIVE_STATION_DEFINITIONS.map((station) => (
                <option key={station.id} value={station.id}>{station.displayName}</option>
              ))}
            </select>
            <select value={alarmForm.severity} onChange={alarmForm.onSeverityChange} className="mes-input">
              <option>Uyarı</option><option>Düşük</option><option>Yüksek</option><option>Kritik</option>
            </select>
            <input placeholder="Açıklama" value={alarmForm.description} onChange={alarmForm.onDescriptionChange} className="mes-input" />
            <button type="submit" className="mes-btn-primary" disabled={alarms.loading}>
              Manuel Alarm Ekle
            </button>
          </form>
          {alarms.error && <p className="mt-2 text-sm text-[color:var(--color-nok)]">{alarms.error}</p>}
        </section>
      )}

      <AlarmPanel
        alarms={alarms.items}
        onAcknowledge={permissions.canManageAlarms ? alarms.onAcknowledge : undefined}
        onResolve={permissions.canManageAlarms ? alarms.onResolve : undefined}
      />

      <TraceabilityPanel batches={batches} />

      {permissions.canManageUsers && <UserRolePanel />}

      <section className="mes-surface p-5">
        <CardHeader
          icon={XCircle}
          title={`NOK Telemetri Kayıtları (${failedRecords.length})`}
          subtitle="Sensör olayları değişmez; yalnızca kalite sınıflandırması (NOK→OK) yetkili kullanıcı tarafından güncellenebilir"
        />
        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>ID</th><th>Ürün</th><th>Malzeme</th><th>İstasyon</th><th>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {failedRecords.map((record) => (
                <tr key={record.id}>
                  <td>#{record.id}</td>
                  <td>{record.urun20liKod}</td>
                  <td>{record.malzeme12liKod}</td>
                  <td>{getStationDisplayName(record.istasyonAdi)}</td>
                  <td>
                    {permissions.canChangeQuality ? (
                      <button type="button" className="mes-pill-nok" onClick={() => production.onToggleQuality(record)}>NOK → OK</button>
                    ) : <span className="text-xs text-[color:var(--color-muted)]">Salt okunur</span>}
                  </td>
                </tr>
              ))}
              {failedRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[color:var(--color-muted)]">
                    Açık NOK telemetri kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default QualityPage;
