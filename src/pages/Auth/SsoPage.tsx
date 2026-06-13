import React from 'react';
import { setToken, setRefreshToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Página de aterrissagem do SSO da central (App Condomínio).
// O hub redireciona o navegador para /sso?token=<token-da-central>. Aqui trocamos
// esse token pelo token PRÓPRIO do app e recarregamos já autenticado no dashboard.
const SsoPage: React.FC = () => {
  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      window.location.replace('/login?sso=invalido');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('sso');
        const data = await res.json();
        if (!data?.token) throw new Error('sso');
        setToken(data.token);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        window.location.replace('/dashboard');
      } catch {
        window.location.replace('/login?sso=invalido');
      }
    })();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cor-fundo)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--cor-borda)', borderTop: '3px solid var(--cor-primaria)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--cor-texto-secundario)', fontSize: 14 }}>Entrando…</p>
      </div>
    </div>
  );
};

export default SsoPage;
