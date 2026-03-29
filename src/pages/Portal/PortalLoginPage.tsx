import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { portal, setPortalToken } from '../../services/api';
import styles from './Portal.module.css';

interface PortalLoginPageProps {
  onLogin: (morador: any) => void;
}

const PortalLoginPage: React.FC<PortalLoginPageProps> = ({ onLogin }) => {
  const [modo, setModo] = useState<'login' | 'primeiro-acesso'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [token, setToken] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await portal.login(email, senha);
      setPortalToken(res.token);
      onLogin(res.morador);
    } catch (err: any) {
      setErro(err.message || 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  };

  const handlePrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) {
      setErro('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    setCarregando(true);
    try {
      const res = await portal.primeiroAcesso(token, senha);
      setPortalToken(res.token);
      onLogin(res.morador);
    } catch (err: any) {
      setErro(err.message || 'Erro no primeiro acesso');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginIcon}>
          <Building2 size={32} />
        </div>
        <h1>Portal do Morador</h1>
        <p className={styles.subtitle}>
          {modo === 'login' ? 'Acesse sua área exclusiva' : 'Configure sua senha de acesso'}
        </p>

        {erro && <div className={styles.loginError}>{erro}</div>}

        {modo === 'login' ? (
          <form className={styles.loginForm} onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cor-texto-secundario)'
                  }}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className={styles.loginBtn} type="submit" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form className={styles.loginForm} onSubmit={handlePrimeiroAcesso}>
            <div className={styles.formGroup}>
              <label>Token de Acesso</label>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Cole o token recebido"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Crie sua senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <button className={styles.loginBtn} type="submit" disabled={carregando}>
              {carregando ? 'Configurando...' : 'Criar Senha e Entrar'}
            </button>
          </form>
        )}

        <div className={styles.loginToggle}>
          {modo === 'login' ? (
            <button onClick={() => { setModo('primeiro-acesso'); setErro(''); }}>
              Primeiro acesso? Clique aqui
            </button>
          ) : (
            <button onClick={() => { setModo('login'); setErro(''); }}>
              Já tenho senha, fazer login
            </button>
          )}
        </div>

        <div className={styles.loginBackLink}>
          <Link to="/login">Acesso administrativo</Link>
        </div>
      </div>
    </div>
  );
};

export default PortalLoginPage;
