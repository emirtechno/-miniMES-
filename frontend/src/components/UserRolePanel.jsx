import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import {
  createUser,
  fetchUsers,
  getApiErrorMessage,
  updateUserRoles,
  updateUserStatus,
} from '../services/api';

const roles = ['Admin', 'Operator', 'Auditor'];

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
      await loadUsers();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Kullanıcı oluşturulamadı.'));
    }
  };

  const handleRoleChange = async (user, selectedRoles) => {
    try {
      const updated = await updateUserRoles(user.id, selectedRoles);
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Rol güncellenemedi.'));
    }
  };

  const handleStatusChange = async (user) => {
    try {
      const updated = await updateUserStatus(user.id, !user.isActive);
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Hesap durumu güncellenemedi.'));
    }
  };

  return (
    <section className="custom-card">
      <div className="card-header">
        <Users size={20} />
        <span>Identity Kullanıcı ve Rol Yönetimi</span>
      </div>

      <form onSubmit={handleCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <input
          className="input-field"
          placeholder="Kullanıcı adı"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
          required
        />
        <input
          className="input-field"
          placeholder="Görünen ad"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          required
        />
        <input
          className="input-field"
          type="password"
          placeholder="Güçlü parola"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          minLength={12}
          required
        />
        <select
          className="input-field"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
        >
          {roles.map((role) => <option key={role}>{role}</option>)}
        </select>
        <button type="submit" className="btn-primary">
          <UserPlus size={16} />
          Kullanıcı Ekle
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? <p>Kullanıcılar yükleniyor...</p> : (
        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Yetkiler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><b>{user.displayName}</b><br /><small>{user.username}</small></td>
                  <td>
                    <select
                      className="input-field"
                      multiple
                      value={user.roles}
                      onChange={(event) => handleRoleChange(
                        user,
                        Array.from(event.target.selectedOptions, (option) => option.value),
                      )}
                    >
                      {roles.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={user.isActive ? 'badge badge-ok' : 'badge badge-neutral'}
                      onClick={() => handleStatusChange(user)}
                    >
                      {user.isActive ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td><small>{user.permissions.join(', ') || 'Salt okunur'}</small></td>
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
