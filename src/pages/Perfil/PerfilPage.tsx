import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { perfil as perfilApi, upload as uploadApi } from '../../services/api';
import { validarImagem } from '../../utils/imageUtils';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { User, Mail, Phone, Briefcase, Camera, Lock, Check, AlertTriangle } from 'lucide-react';
import styles from './Perfil.module.css';

const PerfilPage: React.FC = () => {
  const { usuario } = useAuth();
  const [form, setForm] = useState({ nome: '', telefone: '', cargo: '' });
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    perfilApi.get().then((data: any) => {
      setForm({ nome: data.nome || '', telefone: data.telefone || '', cargo: data.cargo || '' });
      setAvatarUrl(data.avatarUrl);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const salvarPerfil = async () => {
    setSalvando(true); setMsg(null);
    try {
      await perfilApi.update(form);
      setMsg({ tipo: 'sucesso', texto: 'Perfil atualizado com sucesso!' });
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao salvar perfil' }); }
    setSalvando(false);
  };

  const salvarSenha = async () => {
    if (senhaForm.novaSenha !== senhaForm.confirmar) { setMsg({ tipo: 'erro', texto: 'As senhas não coincidem' }); return; }
    if (senhaForm.novaSenha.length < 6) { setMsg({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 6 caracteres' }); return; }
    setSalvando(true); setMsg(null);
    try {
      await perfilApi.changeSenha(senhaForm.senhaAtual, senhaForm.novaSenha);
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmar: '' });
      setMsg({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' });
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao alterar senha' });
    }
    setSalvando(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { setMsg({ tipo: 'erro', texto: erro }); return; }
    try {
      const url = await uploadApi.avatar(file);
      await perfilApi.updateAvatar(url);
      setAvatarUrl(url);
      setMsg({ tipo: 'sucesso', texto: 'Avatar atualizado!' });
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao enviar avatar' }); }
  };

  const roleLabel: Record<string, string> = { master: 'Master', administrador: 'Administrador', supervisor: 'Supervisor', funcionario: 'Funcionário' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>Carregando...</div>;

  return (
    <div>
      <PageHeader titulo="Meu Perfil" subtitulo="Gerencie sua informações pessoais e senha" />

      {msg && (
        <div className={`${styles.alert} ${msg.tipo === 'sucesso' ? styles.alertSuccess : styles.alertError}`}>
          {msg.tipo === 'sucesso' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {msg.texto}
        </div>
      )}

      <div className={styles.grid}>
        <Card padding="md">
          <div className={styles.avatarSection}>
            <div className={styles.avatarLarge} onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <span>{form.nome.charAt(0).toUpperCase() || '?'}</span>
              )}
              <div className={styles.avatarOverlay}><Camera size={20} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            <div className={styles.avatarInfo}>
              <h3>{form.nome || usuario?.nome}</h3>
              <span className={styles.roleTag}>{roleLabel[usuario?.role || 'funcionario']}</span>
              <span className={styles.emailText}>{usuario?.email}</span>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <h3 className={styles.sectionTitle}><User size={16} /> Informações Pessoais</h3>
          <div className={styles.formGroup}>
            <label>Nome</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label><Phone size={13} /> Telefone</label>
              <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
            <div className={styles.formGroup}>
              <label><Briefcase size={13} /> Cargo</label>
              <input value={form.cargo} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Zelador" />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label><Mail size={13} /> E-mail</label>
            <input value={usuario?.email || ''} disabled className={styles.inputDisabled} />
          </div>
          <button className={styles.btnSalvar} onClick={salvarPerfil} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </Card>

        <Card padding="md">
          <h3 className={styles.sectionTitle}><Lock size={16} /> Alterar Senha</h3>
          <div className={styles.formGroup}>
            <label>Senha Atual</label>
            <input type="password" value={senhaForm.senhaAtual} onChange={e => setSenhaForm(p => ({ ...p, senhaAtual: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label>Nova Senha</label>
            <input type="password" value={senhaForm.novaSenha} onChange={e => setSenhaForm(p => ({ ...p, novaSenha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className={styles.formGroup}>
            <label>Confirmar Nova Senha</label>
            <input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} />
          </div>
          <button className={styles.btnSalvar} onClick={salvarSenha} disabled={salvando || !senhaForm.senhaAtual || !senhaForm.novaSenha}>
            {salvando ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </Card>
      </div>
    </div>
  );
};

export default PerfilPage;
