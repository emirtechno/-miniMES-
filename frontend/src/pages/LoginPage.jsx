import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../services/api';
import { Factory, LogIn } from 'lucide-react';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Giriş yapılamadı.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', backgroundColor: '#f1f5f9', boxSizing: 'border-box', padding: '20px' }}>
      <div className="custom-card" style={{ width: '100%', maxWidth: '420px', padding: '36px', borderRadius: '16px', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#e0f2fe', marginBottom: '16px' }}>
            <Factory size={36} color="#0284c7" />
          </div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.6rem' }}>VESTEL miniMES</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>Üretim Takip ve Kontrol Sistemi</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label className="input-group">
            Kullanıcı adı
            <input className="input-field" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label className="input-group">
            Parola
            <input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem', borderRadius: '8px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
            <LogIn size={18} />
            {isSubmitting ? 'Giriş yapılıyor...' : 'Sisteme Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
