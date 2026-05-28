import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Eye, EyeOff, Mail, Lock, MessageCircle, UserPlus } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import styles from './Auth.module.css';

const REMEMBER_STORAGE_KEY = 'manutencao_lembrar_credenciais';

interface CredenciaisSalvas {
  email: string;
  senha: string;
}

function carregarCredenciais(): CredenciaisSalvas | null {
  try {
    const raw = localStorage.getItem(REMEMBER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === 'string' && typeof parsed?.senha === 'string') return parsed;
  } catch { /* ignore */ }
  return null;
}

const LoginPage: React.FC = () => {
  const salvas = carregarCredenciais();
  const [email, setEmail] = useState(salvas?.email ?? '');
  const [senha, setSenha] = useState(salvas?.senha ?? '');
  const [lembrar, setLembrar] = useState(!!salvas);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const { login } = useAuth();
  const { tema } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lembrar) localStorage.removeItem(REMEMBER_STORAGE_KEY);
  }, [lembrar]);

  const logoExibida = tema.logoUrl;
  const tituloExibido = tema.loginTitulo || 'Manutenção X';
  const subtituloExibido = tema.loginSubtitulo || 'Faça login para acessar o sistema';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      await login(email, senha);
      if (lembrar) {
        localStorage.setItem(REMEMBER_STORAGE_KEY, JSON.stringify({ email, senha }));
      } else {
        localStorage.removeItem(REMEMBER_STORAGE_KEY);
      }
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Erro ao fazer login.';
      if (msg.includes('bloqueada') || msg.includes('bloqueado') || msg.includes('desativada') || msg.includes('Desativada')) {
        setErro(msg);
      } else if (msg.includes('inválid') || msg.includes('invalid') || msg.includes('Credenciais') || msg.includes('incorret')) {
        setErro('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else if (msg.includes('tentativas') || msg.includes('requests') || msg.includes('429') || msg.includes('Muitas')) {
        setErro('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (msg.includes('expirada')) {
        setErro('Sua sessão expirou. Faça login novamente.');
      } else if (msg.includes('Sem conexão') || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('internet')) {
        setErro('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
      } else if (msg.includes('demorou') || msg.includes('timeout') || msg.includes('Timeout') || msg.includes('AbortError')) {
        setErro('O servidor demorou para responder. Tente novamente.');
      } else if (msg.includes('indisponível') || msg.includes('500') || msg.includes('503')) {
        setErro('Servidor temporariamente indisponível. Tente novamente em instantes.');
      } else if (msg.includes('negado') || msg.includes('403')) {
        setErro(msg);
      } else {
        setErro('Não foi possível conectar. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  const abrirSuporte = () => {
    window.open('https://wa.me/5511933284364?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20Manuten%C3%A7%C3%A3o%20X', '_blank');
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className={styles.illustration}>
            <div className={styles.circles}>
              <div className={styles.circle1} />
              <div className={styles.circle2} />
              <div className={styles.circle3} />
            </div>
            <img src={logoImg} alt="Manutenção X" className={styles.illustrationLogo} />
          </div>
          <h2>Manutenção <span style={{ color: '#000' }}>X</span></h2>
          <p>Sistema completo de manutenção predial e gestão de serviços. Controle ordens de serviço, equipes, materiais e muito mais.</p>
          <div className={styles.features}>
            <div className={styles.feature}>✓ Ordens de Serviço</div>
            <div className={styles.feature}>✓ Checklists de Manutenção</div>
            <div className={styles.feature}>✓ Geolocalização em Tempo Real</div>
            <div className={styles.feature}>✓ Relatórios com Gráficos</div>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <img src={logoExibida || logoImg} alt="Logo" className={logoExibida ? styles.formLogo : styles.formLogoDefault} />
            <h1>{tema.loginTitulo || <>Manutenção <span style={{ color: '#f57c00' }}>X</span></>}</h1>
            <p>{subtituloExibido}</p>
          </div>

          {erro && (
            <div className={styles.erro}>{erro}</div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>E-mail</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Senha</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>

            <div className={styles.forgotRow}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={e => setLembrar(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Lembrar de mim
              </label>
              <Link to="/esqueci-senha" className={styles.forgotLink}>Esqueceu sua senha?</Link>
            </div>
          </form>

          <div className={styles.registerRow}>
            <span>Não tem uma conta?</span>{' '}
            <Link to="/cadastro" className={styles.registerLink}>Criar conta</Link>
          </div>

          <button className={styles.supportBtn} onClick={abrirSuporte}>
            <MessageCircle size={18} />
            <span>Suporte</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
