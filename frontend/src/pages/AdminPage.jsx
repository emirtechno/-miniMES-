import { AlertTriangle, BellPlus } from 'lucide-react';
import UserRolePanel from '../components/UserRolePanel';
import ShopFloorResetPanel from '../components/ShopFloorResetPanel';
import CardHeader from '../components/CardHeader';
import { ACTIVE_STATION_DEFINITIONS } from '../constants/stations';

/**
 * System administration — users/roles and manual/test alarm tools.
 * Kept separate from Quality Reports (lot / WO / scrap ops).
 */
const AdminPage = ({
  permissions = {},
  alarms = {},
  alarmForm,
}) => (
  <div className="flex flex-col gap-5">
    {permissions.canManageUsers ? (
      <UserRolePanel />
    ) : (
      <section className="mes-surface p-5 text-sm text-[color:var(--color-muted)]">
        Kullanıcı yönetimi için <code className="text-xs">users.manage</code> yetkisi gerekir.
      </section>
    )}

    {permissions.canResetShopFloor && <ShopFloorResetPanel />}

    {permissions.canCreateAlarms && alarmForm && (
      <section className="mes-surface p-5">
        <CardHeader
          icon={BellPlus}
          title="Alarm Oluşturma"
          subtitle="Test veya manuel shop-floor alarmı (backend telemetri anomali alarmları Andon’a düşer)"
          actions={(
            <button type="button" className="mes-btn-primary" onClick={alarms.onCreateTest} disabled={alarms.loading}>
              <AlertTriangle size={16} />
              {alarms.loading ? 'Oluşturuluyor...' : 'Test Alarmı Oluştur'}
            </button>
          )}
        />
        <form onSubmit={alarmForm.onSubmit} className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input
            placeholder="Başlık (≥3)"
            value={alarmForm.title}
            onChange={alarmForm.onTitleChange}
            className="mes-input"
            minLength={3}
            required
          />
          <select value={alarmForm.station} onChange={alarmForm.onStationChange} className="mes-input">
            {ACTIVE_STATION_DEFINITIONS.map((station) => (
              <option key={station.id} value={station.id}>{station.displayName}</option>
            ))}
          </select>
          <select value={alarmForm.severity} onChange={alarmForm.onSeverityChange} className="mes-input">
            <option>Uyarı</option>
            <option>Düşük</option>
            <option>Yüksek</option>
            <option>Kritik</option>
          </select>
          <input
            placeholder="Açıklama"
            value={alarmForm.description}
            onChange={alarmForm.onDescriptionChange}
            className="mes-input"
          />
          <button type="submit" className="mes-btn-primary" disabled={alarms.loading}>
            Manuel Alarm Ekle
          </button>
        </form>
        {alarms.error && <p className="mt-2 text-sm text-[color:var(--color-nok)]">{alarms.error}</p>}
      </section>
    )}
  </div>
);

export default AdminPage;
