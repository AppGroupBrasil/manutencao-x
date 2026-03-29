import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { auth as authApi } from '../../services/api';
import logoImg from '../../assets/logo.png';
import styles from './Auth.module.css';

const EsqueciSenhaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  // Step 1: request reset
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  // Step 2: reset with token
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [resetSucesso, setResetSucesso] = useState(false);

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!email) {
      setErro('Informe seu e-mail.');
      return;
    }
    setCarregando(true);
    try {
      const res = await authApi.forgotPassword(email);
      setMensagem(res.message);
    } catch (err: any) {
      setErro(err.message || 'Erro ao solicitar redefinição.');
    } finally {
      setCarregando(false);
    }
  };

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    try {
      await authApi.resetPassword(tokenFromUrl!, novaSenha);
      setResetSucesso(true);
    } catch (err: any) {
      setErro(err.message || 'Token inválido ou expirado.');
    } finally {
      setCarregando(false);
    }
  };

  const renderContent = () => {
    // Token provided — show reset password form
    if (tokenFromUrl) {
      if (resetSucesso) {
        return (
          <div className={styles.formContainer}>
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <h2>Senha redefinida!</h2>
              <p>Sua senha foi alterada com sucesso.</p>
              <Link to="/login" className={styles.backToLoginBtn}>Ir para o Login</Link>
            </div>
          </div>
        );
      }

      return (
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <img src={logoImg} alt="Logo" className={styles.formLogoDefault} />
            <h1>Nova senha</h1>
            <p>Digite sua nova senha abaixo</p>
          </div>

          {erro && <div className={styles.erro}>{erro}</div>}

          <form onSubmit={handleRedefinir} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Nova senha</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setMostrarSenha(!mostrarSenha)}>
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Confirmar nova senha</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={carregando}>
              {carregando ? 'Redefinindo...' : 'Redefinir senha'}
            </button>
          </form>

          <div className={styles.registerRow}>
            <Link to="/login" className={styles.registerLink}>Voltar ao login</Link>
          </div>
        </div>
      );
    }

    // No token — show request form
    if (mensagem) {
      return (
        <div className={styles.formContainer}>
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✉</div>
            <h2>Verifique seu e-mail</h2>
            <p>{mensagem}</p>
            <Link to="/login" className={styles.backToLoginBtn}>Voltar ao Login</Link>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.formContainer}>
        <div className={styles.formHeader}>
          <img src={logoImg} alt="Logo" className={styles.formLogoDefault} />
          <h1>Esqueceu sua senha?</h1>
          <p>Informe seu e-mail para receber instruções de redefinição</p>
        </div>

        {erro && <div className={styles.erro}>{erro}</div>}

        <form onSubmit={handleSolicitar} className={styles.form}>
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

          <button type="submit" className={styles.submitBtn} disabled={carregando}>
            {carregando ? 'Enviando...' : 'Enviar instruções'}
          </button>
        </form>

        <div className={styles.registerRow}>
          <span>Lembrou a senha?</span>{' '}
          <Link to="/login" className={styles.registerLink}>Fazer login</Link>
        </div>
      </div>
    );
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
          <h2>Manutenção X</h2>
          <p>Sistema completo de manutenção predial e gestão de serviços.</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        {renderContent()}
      </div>
    </div>
  );
};

export default EsqueciSenhaPage;
