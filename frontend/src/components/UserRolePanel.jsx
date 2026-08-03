import { useEffect, useState } from 'react';
import { Shield, UserPlus, Users } from 'lucide-react';
import {
  createUser,
  fetchUsers,
  getApiErrorMessage,
  getApiValidationErrors,
  updateUserRoles,
  updateUserStatus,
} from '../services/api';
import PermissionChips from './PermissionChips';

const roles = ['Admin', 'Operator', 'Auditor'];

const roleHints = {
  Admin: 'Tüm üretim, alarm, iş emri ve kullanıcı yetkileri',
  Operator: 'Üretim yazma, alarm oluşturma, metrik görüntüleme',
  Auditor: 'Metrik ve silinen kayıtları görüntüleme (salt okuma ağırlıklı)',
};

const UserRolePanel = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'Operator',
  });

  const loadUsers = async () => {
    try {
      const page = await fetchUsers();
      setUsers(page.items);
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Kullanıcılar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      await createUser(form);
      setForm({ username: '', displayName: '', password: '', role: 'Operator' });
      setError('');
      await loadUsers();
    } catch (requestError) {
      const details = getApiValidationErrors(requestError);
      setError(
        details.length
          ? details.join(' · ')
          : getApiErrorMessage(requestError, 'Kullanıcı oluşturulamadı.'),
      );
    }
  };

  const handleRoleChange = async (user, selectedRoles) => {
    try {
      const updated = await updateUserRoles(user.id, selectedRoles);
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Rol güncellenemedi.'));
    }
  };

  const handleStatusChange = async (user) => {
    try {
      const updated = await updateUserStatus(user.id, !user.isActive);
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Hesap durumu güncellenemedi.'));
    }
  };

  return (
    <section className="mes-surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[color:var(--color-vestel)]" />
            <h2 className="mes-section-title m-0">Kullanıcı ve Rol Yönetimi</h2>
          </div>
          <p className="mes-helper mt-1 mb-0">
            Teknik yetki kodları yerine saha diliyle etiketler gösterilir. Bir role tıklayınca yetkiler otomatik güncellenir.
          </p>
        </div>
        <span className="mes-pill-neutral">
          <Shield size={13} />
          Identity + JWT
        </span>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-5 grid gap-2 rounded-xl border border-[color:var(--color-line)] bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          className="mes-input"
          placeholder="Kullanıcı adı"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
          minLength={3}
          required
        />
        <input
          className="mes-input"
          placeholder="Görünen ad"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          minLength={3}
          required
        />
        <input
          className="mes-input"
          type="password"
          placeholder="Parola (en az 6 karakter, 1 rakam)"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          minLength={6}
          required
          title="Parola en az 6 karakter ve en az bir rakam içermelidir."
        />
        <select
          className="mes-input"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          title={roleHints[form.role]}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button type="submit" className="mes-btn-primary">
          <UserPlus size={16} />
          Kullanıcı Ekle
        </button>
      </form>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">
          {error}
        </div>
      )}

      <p className="mes-helper mb-3">
        Parola kuralları (saha operatörü): en az 6 karakter ve en az bir rakam. Büyük/küçük harf veya özel karakter zorunlu değildir.
      </p>

      {loading ? (
        <p className="mes-helper">Kullanıcılar yükleniyor...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="border-b border-[color:var(--color-line)] px-2 py-2 font-semibold">Kullanıcı</th>
                <th className="border-b border-[color:var(--color-line)] px-2 py-2 font-semibold">Rol</th>
                <th className="border-b border-[color:var(--color-line)] px-2 py-2 font-semibold">Durum</th>
                <th className="border-b border-[color:var(--color-line)] px-2 py-2 font-semibold">Yetkiler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    <div className="font-semibold text-[color:var(--color-ink)]">{user.displayName}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">{user.username}</div>
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    <select
                      className="mes-input min-h-20"
                      multiple
                      value={user.roles}
                      onChange={(event) =>
                        handleRoleChange(
                          user,
                          Array.from(event.target.selectedOptions, (option) => option.value),
                        )
                      }
                    >
                      {roles.map((role) => (
                        <option key={role} value={role} title={roleHints[role]}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    <button
                      type="button"
                      className={user.isActive ? 'mes-pill-ok' : 'mes-pill-neutral'}
                      onClick={() => handleStatusChange(user)}
                    >
                      {user.isActive ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="border-b border-[color:var(--color-line)] px-2 py-3">
                    <PermissionChips permissions={user.permissions || []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default UserRolePanel;
