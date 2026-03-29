import React, { useEffect, useState } from 'react';
import { Loader2, User } from 'lucide-react';
import { portal } from '../../services/api';
import type { MoradorPortal } from '../../types';
import styles from './Portal.module.css';

interface Props {
  morador: MoradorPortal | null;
  onUpdate: (m: MoradorPortal) => void;
}

const PortalPerfilPage: React.FC<Props> = ({ morador: moradorProp, onUpdate }) => {
  const [perfil, setPerfil] = useState<MoradorPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({ nome: '', whatsapp: '' });
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [senhaMsg, setSenhaMsg] = useState('');
  const [senhaErro, setSenhaErro] = useState('');

  useEffect(() => {
    portal.me()
      .then((p: MoradorPortal) => {
        setPerfil(p);
        setForm({ nome: p.nome || '', whatsapp: p.whatsapp || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMsg('');
    try {
      const updated = await portal.updatePerfil(form);
      setPerfil(prev => prev ? { ...prev, ...updated } : prev);
      onUpdate({ ...moradorProp!, nome: form.nome, whatsapp: form.whatsapp });
      setMsg('Perfil atualizado!');
    } catch {
      setMsg('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMsg('');
    setSenhaErro('');
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      setSenhaErro('Senhas não conferem');
      return;
    }
    if (senhaForm.novaSenha.length < 6) {
      setSenhaErro('Nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    try {
      await portal.changeSenha(senhaForm.senhaAtual, senhaForm.novaSenha);
      setSenhaMsg('Senha alterada com sucesso!');
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmar: '' });
    } catch (err: any) {
      setSenhaErro(err.message || 'Erro ao alterar senha');
    }
  };

  if (loading) {
    return (
      <div className={styles.empty}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Meu Perfil</h1>
      </div>

      <div className={styles.perfilCard}>
        <div className={styles.perfilAvatar}>
          <div className={styles.avatarCircle}>
            {perfil?.avatarUrl ? (
              <img src={perfil.avatarUrl} alt="" />
            ) : (
              <User size={28} />
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--cor-texto)' }}>{perfil?.nome}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--cor-texto-secundario)' }}>
              {perfil?.perfil} — {perfil?.condominioNome}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cor-texto-secundario)' }}>
              {perfil?.bloco && `Bloco ${perfil.bloco}`}{perfil?.apartamento && `, Apto ${perfil.apartamento}`}
            </p>
          </div>
        </div>

        <form className={styles.perfilForm} onSubmit={handleSalvar}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Nome</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>E-mail</label>
            <input value={perfil?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          {msg && <div className={styles.success}>{msg}</div>}
          <button className={styles.btnSave} type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>

      <div className={styles.senhaSection}>
        <h2>Alterar Senha</h2>
        <form className={styles.perfilForm} onSubmit={handleSenha}>
          <div className={styles.formGroup}>
            <label>Senha Atual</label>
            <input type="password" value={senhaForm.senhaAtual} onChange={e => setSenhaForm({ ...senhaForm, senhaAtual: e.target.value })} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Nova Senha</label>
              <input type="password" value={senhaForm.novaSenha} onChange={e => setSenhaForm({ ...senhaForm, novaSenha: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>Confirmar</label>
              <input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm({ ...senhaForm, confirmar: e.target.value })} />
            </div>
          </div>
          {senhaMsg && <div className={styles.success}>{senhaMsg}</div>}
          {senhaErro && <div className={styles.loginError}>{senhaErro}</div>}
          <button className={styles.btnSave} type="submit">Alterar Senha</button>
        </form>
      </div>
    </>
  );
};

export default PortalPerfilPage;
