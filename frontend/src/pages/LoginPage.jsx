import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../services/api';
import { LogIn } from 'lucide-react';
import VestelMark from '../components/VestelMark';

const homeForUser = (user) => {
  const roles = user?.roles || [];
  if (roles.includes('Admin')) {
    sessionStorage.setItem('mm_active_persona', 'admin');
    return '/fabrika';
  }
  if (roles.includes('Operator')) {
    sessionStorage.setItem('mm_active_persona', 'operator');
    return '/operator';
  }
  sessionStorage.setItem('mm_active_persona', 'admin');
  return '/fabrika';
};

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
      const user = await login(username, password);
      navigate(homeForUser(user));
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Giriş yapılamadı.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(900px 420px at 15% 10%, rgba(200,16,46,0.18), transparent 60%), radial-gradient(700px 380px at 90% 20%, rgba(23,105,170,0.16), transparent 55%), linear-gradient(160deg, #0b1220 0%, #1a2332 45%, #0b1220 100%)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--color-vestel)] text-white">
            <VestelMark size={34} />
          </div>
          <h1 className="font-display m-0 text-3xl font-semibold tracking-wide text-[color:var(--color-ink)]">VESTEL MES</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">Üretim Takip ve Kontrol Sistemi</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[color:var(--color-ink)]">
            Kullanıcı adı
            <input className="mes-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[color:var(--color-ink)]">
            Parola
            <input className="mes-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="m-0 text-sm font-medium text-[color:var(--color-nok)]">{error}</p>}
          <button type="submit" className="mes-btn-primary w-full py-3" disabled={isSubmitting}>
            <LogIn size={18} />
            {isSubmitting ? 'Giriş yapılıyor...' : 'Sisteme Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
