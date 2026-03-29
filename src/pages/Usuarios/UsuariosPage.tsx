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
  Mail, Phone, MoreVertical, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { auth, usuarios as usuariosApi } from '../../services/api';
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
  const { podeBloquear, podeEditar, podeExcluir, hierarquiaSuperior } = usePermissions();
  const { tentarAcao } = useDemo();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<string>('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState<User | null>(null);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', senha: '', role: 'funcionario' as UserRole, cargo: '' });

  useEffect(() => {
    usuariosApi.list().then((data: any[]) => {
      setUsers(data.map((u: any) => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role || 'funcionario',
        ativo: u.ativo !== false,
        bloqueado: u.bloqueado || false,
        motivoBloqueio: u.motivoBloqueio,
        criadoPor: u.criadoPor,
        administradorId: u.administradorId,
        supervisorId: u.supervisorId,
        cargo: u.cargo,
        telefone: u.telefone,
        criadoEm: u.criadoEm ? new Date(u.criadoEm).getTime() : Date.now(),
        atualizadoEm: u.atualizadoEm ? new Date(u.atualizadoEm).getTime() : Date.now(),
      })));
    }).catch(() => {}).finally(() => setLoading(false));
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
      const created = await auth.register(novoUser);
      setUsers(prev => [{ ...created, criadoEm: Date.now(), atualizadoEm: Date.now(), ativo: true, bloqueado: false }, ...prev]);
      setModalAberto(false);
      setNovoUser({ nome: '', email: '', senha: '', role: 'funcionario', cargo: '' });
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
    } catch {}
  };

  const handleExcluir = async (user: User) => {
    if (!tentarAcao()) return;
    if (confirm(`Deseja realmente excluir o usuário ${user.nome}?`)) {
      try {
        await usuariosApi.remove(user.id);
        setUsers(prev => prev.filter(u => u.id !== user.id));
      } catch {}
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
                {podeEditar() && hierarquiaSuperior(user.role) && (
                  <button className={styles.actionBtn} title="Editar" onClick={e => { e.stopPropagation(); }}>
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
            <input type="password" value={novoUser.senha} onChange={e => setNovoUser({ ...novoUser, senha: e.target.value })} required minLength={6} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Perfil</label>
              <select value={novoUser.role} onChange={e => setNovoUser({ ...novoUser, role: e.target.value as UserRole })}>
                <option value="funcionario">Funcionário</option>
                <option value="supervisor">Supervisor</option>
                {(usuario?.role === 'master' || usuario?.role === 'administrador') && <option value="administrador">Administrador (Solicite ao Suporte)</option>}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Cargo</label>
              <input value={novoUser.cargo} onChange={e => setNovoUser({ ...novoUser, cargo: e.target.value })} />
            </div>
          </div>
          <button type="submit" className={styles.submitBtn}>Cadastrar Usuário</button>
        </form>
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
