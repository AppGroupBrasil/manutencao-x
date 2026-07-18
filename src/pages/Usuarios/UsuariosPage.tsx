import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import StatusBadge from '../../components/Common/StatusBadge';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import type { User, UserRole } from '../../types';
import { ROLE_HIERARCHY } from '../../types';
import {
  UserPlus, Search, Shield, ShieldOff, Edit2, Trash2, MapPin,
  Mail, Phone, MoreVertical, Filter, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { auth, usuarios as usuariosApi, condominios as condominiosApi } from '../../services/api';
import styles from './Usuarios.module.css';



const CORES = ['#1a73e8', '#00897b', '#f57c00'];

const roleLabel: Record<string, string> = {
  master: 'Master',
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  funcionario: 'Funcionário',
};

const UsuariosPage: React.FC = () => {
  const { usuario } = useAuth();
  const { podeBloquear, podeExcluir, hierarquiaSuperior } = usePermissions();
  const { tentarAcao } = useDemo();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<string>('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState<User | null>(null);
  const [modalEditar, setModalEditar] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', telefone: '', cargo: '', role: 'funcionario' as UserRole, condominioId: '' });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', senha: '', role: 'funcionario' as UserRole, cargo: '', condominioId: '' });
  const [conds, setConds] = useState<{ id: string; nome: string }[]>([]);

  const podeGerenciarUsuario = usuario?.role === 'master' || usuario?.role === 'administrador';

  useEffect(() => {
    usuariosApi.list().then((data: any[]) => {
      setUsers(data.map((u: any) => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role || 'funcionario',
        ativo: u.ativo !== false,
        bloqueado: u.bloqueado || false,
        motivoBloqueio: u.motivoBloqueio ?? u.motivo_bloqueio,
        criadoPor: u.criadoPor ?? u.criado_por,
        administradorId: u.administradorId ?? u.administrador_id,
        supervisorId: u.supervisorId ?? u.supervisor_id,
        condominioId: u.condominioId ?? u.condominio_id,
        cargo: u.cargo,
        telefone: u.telefone,
        criadoEm: (u.criadoEm ?? u.criado_em) ? new Date(u.criadoEm ?? u.criado_em).getTime() : Date.now(),
        atualizadoEm: (u.atualizadoEm ?? u.atualizado_em) ? new Date(u.atualizadoEm ?? u.atualizado_em).getTime() : Date.now(),
      })));
    }).catch(() => {}).finally(() => setLoading(false));
    condominiosApi.list().then((data: any[]) => {
      const lista = (Array.isArray(data) ? data : []).map((c: any) => ({ id: c.id, nome: c.nome }));
      setConds(lista);
      if (lista.length === 1) setNovoUser(prev => ({ ...prev, condominioId: lista[0].id }));
    }).catch(() => {});
  }, []);

  const chartRoles = [
    { nome: 'Administradores', valor: users.filter(u => u.role === 'administrador').length },
    { nome: 'Supervisores', valor: users.filter(u => u.role === 'supervisor').length },
    { nome: 'Funcionários', valor: users.filter(u => u.role === 'funcionario').length },
  ];

  const filteredUsers = users.filter(u => {
    const matchBusca = u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());
    const matchRole = filtroRole === 'todos' || u.role === filtroRole;
    return matchBusca && matchRole;
  });

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tentarAcao()) return;
    try {
      const created = await auth.register({ ...novoUser, condominioId: novoUser.condominioId || undefined });
      setUsers(prev => [{ ...created, condominioId: novoUser.condominioId || undefined, criadoEm: Date.now(), atualizadoEm: Date.now(), ativo: true, bloqueado: false }, ...prev.filter(u => u.id !== created.id)]);
      setModalAberto(false);
      setNovoUser({ nome: '', email: '', senha: '', role: 'funcionario', cargo: '', condominioId: conds.length === 1 ? conds[0].id : '' });
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Erro ao cadastrar usuário.';
      alert(msg);
    }
  };

  const handleBloquear = async (user: User) => {
    if (!tentarAcao()) return;
    try {
      await usuariosApi.bloquear(user.id, !user.bloqueado, user.bloqueado ? undefined : 'Inadimplência');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, bloqueado: !u.bloqueado } : u));
    } catch (err: any) {
      alert(err?.error || err?.message || 'Erro ao bloquear/desbloquear usuário.');
    }
  };

  const handleExcluir = async (user: User) => {
    if (!tentarAcao()) return;
    if (confirm(`Deseja realmente excluir o usuário ${user.nome}?`)) {
      try {
        await usuariosApi.remove(user.id);
        setUsers(prev => prev.filter(u => u.id !== user.id));
      } catch (err: any) {
        alert(err?.error || err?.message || 'Erro ao excluir usuário.');
      }
    }
  };

  const abrirEdicao = (user: User) => {
    setEditForm({ nome: user.nome, telefone: user.telefone || '', cargo: user.cargo || '', role: user.role, condominioId: user.condominioId || '' });
    setModalEditar(user);
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar || !tentarAcao()) return;
    setSalvandoEdicao(true);
    try {
      await usuariosApi.update(modalEditar.id, {
        nome: editForm.nome.trim(),
        role: editForm.role,
        ativo: modalEditar.ativo,
        condominioId: editForm.condominioId || modalEditar.condominioId || null,
        supervisorId: modalEditar.supervisorId,
        telefone: editForm.telefone.trim(),
        cargo: editForm.cargo.trim(),
      } as any);
      setUsers(prev => prev.map(u => u.id === modalEditar.id ? {
        ...u,
        nome: editForm.nome.trim(),
        role: editForm.role,
        telefone: editForm.telefone.trim(),
        cargo: editForm.cargo.trim(),
        condominioId: editForm.condominioId || u.condominioId,
        atualizadoEm: Date.now(),
      } : u));
      setModalEditar(null);
    } catch (err: any) {
      alert(err?.error || err?.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  return (
    <div id="usuarios-content">
      <HowItWorks
        titulo="Gestão de Usuários"
        descricao="Gerencie todo os usuários do sistema com hierarquia completa. Master vê todos, administrador vê seus usuários, supervisor vê apenas os funcionários habilitados."
        passos={[
          'Visualize todos os usuários cadastrados no grid',
          'Filtre por perfil (Administrador, Supervisor, Funcionário)',
          'Clique em um card para ver detalhes e ações',
          'Master pode bloquear/desbloquear por inadimplência',
          'Administrador e Master podem ativar/desativar funções para cada usuário',
          'Use os botões no topo para exportar a listagem',
        ]}
      />

      <PageHeader
        titulo="Usuários"
        subtitulo={`${users.length} usuários cadastrados`}
        onCompartilhar={() => compartilharConteudo('Usuários', `Total de ${users.length} usuários`)}
        onImprimir={() => imprimirElemento('usuarios-content')}
        onGerarPdf={() => gerarPdfDeElemento('usuarios-content', 'usuarios')}
        acoes={
          <button className={styles.addBtn} onClick={() => setModalAberto(true)}>
            <UserPlus size={18} />
            <span>Novo Usuário</span>
          </button>
        }
      />

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className={styles.filterTabs}>
          {['todos', 'administrador', 'supervisor', 'funcionario'].map(role => (
            <button
              key={role}
              className={`${styles.filterTab} ${filtroRole === role ? styles.filterActive : ''}`}
              onClick={() => setFiltroRole(role)}
            >
              {role === 'todos' ? 'Todos' : roleLabel[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Users Grid - estilo grid com quebra de linha */}
      <div className={styles.usersGrid}>
        {filteredUsers.map(user => (
          <Card key={user.id} hover padding="md" onClick={() => setModalDetalhes(user)}>
            <div className={styles.userCard}>
              <div className={styles.userTop}>
                <div className={styles.userAvatar} style={{
                  background: user.bloqueado ? '#d32f2f' : user.ativo ? 'var(--cor-primaria)' : '#9e9e9e'
                }}>
                  {user.nome.charAt(0)}
                </div>
                <div className={styles.userStatus}>
                  {user.bloqueado ? (
                    <StatusBadge texto="Bloqueado" variante="perigo" />
                  ) : user.ativo ? (
                    <StatusBadge texto="Ativo" variante="sucesso" />
                  ) : (
                    <StatusBadge texto="Inativo" variante="neutro" />
                  )}
                </div>
              </div>
              <h4 className={styles.userName}>{user.nome}</h4>
              <span className={styles.userRole}>{roleLabel[user.role]}</span>
              {user.cargo && <span className={styles.userCargo}>{user.cargo}</span>}
              <div className={styles.userContactRow}>
                <Mail size={13} />
                <span>{user.email}</span>
              </div>
              {user.telefone && (
                <div className={styles.userContactRow}>
                  <Phone size={13} />
                  <span>{user.telefone}</span>
                </div>
              )}
              <div className={styles.userActions}>
                {podeGerenciarUsuario && hierarquiaSuperior(user.role) && (
                  <button className={styles.actionBtn} title="Editar" onClick={e => { e.stopPropagation(); abrirEdicao(user); }}>
                    <Edit2 size={14} />
                  </button>
                )}
                {podeBloquear() && (
                  <button
                    className={`${styles.actionBtn} ${styles.blockBtn}`}
                    title={user.bloqueado ? 'Desbloquear' : 'Bloquear'}
                    onClick={e => { e.stopPropagation(); handleBloquear(user); }}
                  >
                    {user.bloqueado ? <Shield size={14} /> : <ShieldOff size={14} />}
                  </button>
                )}
                {podeExcluir() && hierarquiaSuperior(user.role) && (
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    title="Excluir"
                    onClick={e => { e.stopPropagation(); handleExcluir(user); }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--cor-texto)', margin: '0 0 20px' }}>
            Distribuição por Perfil
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={chartRoles} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="valor" nameKey="nome" label>
                {chartRoles.map((_, i) => (
                  <Cell key={i} fill={CORES[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Modal Cadastro */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Usuário" largura="md">
        <form onSubmit={handleCadastrar} className={styles.form}>
          <div className={styles.formAviso}>
            <Info size={18} />
            <p>
              Você define o <strong>e-mail</strong> e a <strong>senha</strong> de acesso do seu funcionário
              e entrega os dois para ele. Com eles, ele entra no aplicativo e executa as ordens de serviço,
              checklists e atividades atribuídas. Anote a senha antes de salvar: por segurança ela não pode
              ser consultada depois, apenas redefinida. O funcionário pode trocá-la em <strong>Meu Perfil</strong>.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label>Nome completo</label>
            <input value={novoUser.nome} onChange={e => setNovoUser({ ...novoUser, nome: e.target.value })} required />
          </div>
          <div className={styles.formGroup}>
            <label>E-mail</label>
            <input type="email" value={novoUser.email} onChange={e => setNovoUser({ ...novoUser, email: e.target.value })} required />
          </div>
          <div className={styles.formGroup}>
            <label>Senha</label>
            <input type="password" value={novoUser.senha} onChange={e => setNovoUser({ ...novoUser, senha: e.target.value })} required pattern="\d{6}" maxLength={6} title="A senha deve ter exatamente 6 números" />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Perfil</label>
              <select value={novoUser.role} onChange={e => setNovoUser({ ...novoUser, role: e.target.value as UserRole })}>
                <option value="funcionario">Funcionário</option>
                <option value="supervisor">Supervisor</option>
                {(usuario?.role === 'master' || usuario?.role === 'administrador') && <option value="administrador">Administrador (Gestor)</option>}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Cargo</label>
              <input value={novoUser.cargo} onChange={e => setNovoUser({ ...novoUser, cargo: e.target.value })} />
            </div>
          </div>
          {novoUser.role !== 'administrador' && (
            <div className={styles.formGroup}>
              <label>Condomínio</label>
              <select value={novoUser.condominioId} onChange={e => setNovoUser({ ...novoUser, condominioId: e.target.value })} required>
                <option value="">Selecione o condomínio</option>
                {conds.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className={styles.submitBtn}>Cadastrar Usuário</button>
        </form>
      </Modal>

      {/* Modal Edição */}
      <Modal aberto={!!modalEditar} onFechar={() => setModalEditar(null)} titulo="Editar Usuário" largura="md">
        {modalEditar && (
          <form onSubmit={handleEditar} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Nome completo</label>
              <input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} required minLength={2} />
            </div>
            <div className={styles.formGroup}>
              <label>E-mail (não editável)</label>
              <input value={modalEditar.email} disabled />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Perfil</label>
                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
                  <option value="funcionario">Funcionário</option>
                  <option value="supervisor">Supervisor</option>
                  {(usuario?.role === 'master' || usuario?.role === 'administrador' || editForm.role === 'administrador') && <option value="administrador">Administrador (Gestor)</option>}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Cargo</label>
                <input value={editForm.cargo} onChange={e => setEditForm({ ...editForm, cargo: e.target.value })} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Telefone</label>
              <input value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
            </div>
            {editForm.role !== 'administrador' && (
              <div className={styles.formGroup}>
                <label>Condomínio</label>
                <select value={editForm.condominioId} onChange={e => setEditForm({ ...editForm, condominioId: e.target.value })} required>
                  <option value="">Selecione o condomínio</option>
                  {conds.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className={styles.submitBtn} disabled={salvandoEdicao}>
              {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        )}
      </Modal>

      {/* Modal Detalhes */}
      <Modal aberto={!!modalDetalhes} onFechar={() => setModalDetalhes(null)} titulo="Detalhe do Usuário" largura="md">
        {modalDetalhes && (
          <div className={styles.detalhes}>
            <div className={styles.detalhesHeader}>
              <div className={styles.userAvatar} style={{ width: 64, height: 64, fontSize: 24, background: 'var(--cor-primaria)' }}>
                {modalDetalhes.nome.charAt(0)}
              </div>
              <div>
                <h3>{modalDetalhes.nome}</h3>
                <p>{roleLabel[modalDetalhes.role]} • {modalDetalhes.cargo || 'Sem cargo definido'}</p>
              </div>
            </div>
            <div className={styles.detalhesGrid}>
              <div><strong>E-mail:</strong> {modalDetalhes.email}</div>
              <div><strong>Telefone:</strong> {modalDetalhes.telefone || '-'}</div>
              <div><strong>Status:</strong> {modalDetalhes.bloqueado ? '🔴 Bloqueado' : modalDetalhes.ativo ? '🟢 Ativo' : '⚪ Inativo'}</div>
              <div><strong>Criado em:</strong> {new Date(modalDetalhes.criadoEm).toLocaleDateString('pt-BR')}</div>
            </div>
            {modalDetalhes.bloqueado && (
              <div className={styles.bloqueioMsg}>
                <ShieldOff size={18} />
                <span>{modalDetalhes.motivoBloqueio || 'Conta bloqueada por inadimplência'}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsuariosPage;
