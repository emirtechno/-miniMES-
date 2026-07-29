import { Users, Lock, RefreshCw } from 'lucide-react';

const roles = ['Operatör', 'Kalite', 'Saha Müdürü', 'Bakım'];
const permissions = ['Üretim Girişi', 'Kalite Onayı', 'Rapor Görüntüleme', 'Tam Yetki'];

const UserRolePanel = ({ users, activeUserId, onUpdateUser, onToggleUserStatus, onSetActiveUser }) => {
  return (
    <section className="custom-card">
      <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={20} />
          <span>Kullanıcı ve Rol Yönetimi</span>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Rol / yetki değişiklikleri anlık kaydedilir.</span>
      </div>

      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Yetki</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><b>{user.name}</b></td>
                <td>
                  <select
                    className="input-field"
                    value={user.role}
                    onChange={(e) => onUpdateUser(user.id, 'role', e.target.value)}
                    style={{ minWidth: '140px' }}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span
                    className={`badge ${user.status === 'Aktif' ? 'badge-ok' : 'badge-neutral'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onToggleUserStatus(user.id)}
                    title="Durumu değiştir"
                  >
                    {user.status}
                  </span>
                </td>
                <td>
                  <select
                    className="input-field"
                    value={user.permission}
                    onChange={(e) => onUpdateUser(user.id, 'permission', e.target.value)}
                    style={{ minWidth: '180px' }}
                  >
                    {permissions.map((permission) => (
                      <option key={permission} value={permission}>{permission}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className={user.id === activeUserId ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => onSetActiveUser(user.id)}
                    style={{ padding: '8px 10px', fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={14} />
                    {user.id === activeUserId ? 'Etkin Kullanıcı' : 'Aktifleştir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UserRolePanel;
