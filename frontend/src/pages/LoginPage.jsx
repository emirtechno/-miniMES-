import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Factory, LogIn } from 'lucide-react';

function LoginPage() {
  const { users, activeUserId, setActiveUserId, login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    login(activeUserId);
    navigate('/dashboard');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#f1f5f9',
      boxSizing: 'border-box',
      padding: '20px'
    }}>
      <div 
        className="custom-card" 
        style={{ 
          width: '100%', 
          maxWidth: '420px', 
          padding: '36px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          borderRadius: '16px',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: '#e0f2fe',
            marginBottom: '16px'
          }}>
            <Factory size={36} color="#0284c7" />
          </div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.6rem', fontWeight: 700 }}>VESTEL MES</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>Üretim Takip ve Kontrol Sistemi</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
              Giriş Yapılacak Kullanıcı
            </label>
            <select
              className="input-field"
              value={activeUserId}
              onChange={(e) => setActiveUserId(Number(e.target.value))}
              style={{ 
                width: '100%', 
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role} - {user.status})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ 
              width: '100%', 
              padding: '12px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <LogIn size={18} />
            Sisteme Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;