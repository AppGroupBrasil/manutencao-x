import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { auth as authApi } from '../../services/api';
import logoImg from '../../assets/logo.png';
import styles from './Auth.module.css';

const CadastroPage: React.FC = () => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!nome.trim() || !email || !senha) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      const res = await authApi.selfRegister({ email, senha, nome: nome.trim(), telefone: telefone.trim() || undefined });
      setSucesso(res.message);
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar conta.');
    } finally {
      setCarregando(false);
    }
  };

  if (sucesso) {
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
          <div className={styles.formContainer}>
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <h2>Conta criada!</h2>
              <p>{sucesso}</p>
              <Link to="/login" className={styles.backToLoginBtn}>Ir para o Login</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <p>Sistema completo de manutenção predial e gestão de serviços. Controle ordens de serviço, equipes, materiais e muito mais.</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <img src={logoImg} alt="Logo" className={styles.formLogoDefault} />
            <h1>Criar conta</h1>
            <p>Preencha seus dados para se cadastrar</p>
          </div>

          {erro && <div className={styles.erro}>{erro}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Nome completo *</label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>E-mail *</label>
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
              <label>Telefone</label>
              <div className={styles.inputWrapper}>
                <Phone size={18} className={styles.inputIcon} />
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Senha *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setMostrarSenha(!mostrarSenha)}>
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Confirmar senha *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Repita sua senha"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={carregando}>
              {carregando ? 'Cadastrando...' : 'Criar conta'}
            </button>
          </form>

          <div className={styles.registerRow}>
            <span>Já tem uma conta?</span>{' '}
            <Link to="/login" className={styles.registerLink}>Fazer login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CadastroPage;
