import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import StatusBadge from '../../components/Common/StatusBadge';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Wrench, ClipboardCheck, Users, Building2,
  AlertTriangle, Clock, Search, Plus, Edit2, Trash2, Lock, Unlock, Key,
  Package, Settings, FileWarning, Eye, ScanLine, Download,
  CalendarCheck, BookOpen, Columns3, Shield, UserX, UserCheck, Ban, Home,
  TrendingUp, ChevronDown, ChevronRight, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { dashboard as dashboardApi, usuarios as usuariosApi, auth as authApi } from '../../services/api';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import MobileMenuGrid from '../../components/Layout/MobileMenuGrid';
import { menuCatalog, type MenuConfigItem } from '../../components/Layout/menuCatalog';
import { safeStorage } from '../../utils/storage';
import type { User, UserRole } from '../../types';
import styles from './Dashboard.module.css';

/* ── Helpers ── */

const CORES_GRAFICO = ['#1a73e8', '#00897b', '#f57c00', '#d32f2f', '#7b1fa2', '#303f9f'];

const STATUS_CORES: Record<string, string> = {
  ativo: '#00897b',
  teste: '#f57c00',
  inadimplente: '#d32f2f',
  bloqueado: '#9e9e9e',
};

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  teste: 'Em Teste',
  inadimplente: 'Inadimplente',
  bloqueado: 'Bloqueado',
};

/* ── Componente ── */

const NAV_ITEMS_FUNC = [
  { label: 'Quadro de Atividades', icon: <Columns3 size={22} />, rota: '/quadro-atividades' },
  { label: 'Leitor QR Code',      icon: <ScanLine size={22} />,   rota: '/leitor-qrcode' },
  { label: 'Ordens de Serviço',   icon: <Wrench size={22} />,     rota: '/ordens-servico' },
  { label: 'Checklists',          icon: <ClipboardCheck size={22} />, rota: '/checklists' },
  { label: 'Vistorias',           icon: <Eye size={22} />,         rota: '/vistorias' },
  { label: 'Reportes',            icon: <FileWarning size={22} />, rota: '/reportes' },
  { label: 'Tarefas Agendadas',   icon: <CalendarCheck size={22} />, rota: '/tarefas' },
  { label: 'Roteiro de Execução', icon: <BookOpen size={22} />,    rota: '/roteiros' },
  { label: 'Controle de Estoque', icon: <Package size={22} />,     rota: '/materiais' },
  { label: 'Configurações',       icon: <Settings size={22} />,    rota: '/configuracoes' },
];

/* ══════════ MASTER DASHBOARD ══════════ */
const ROLE_LABELS: Record<string, string> = { administrador: 'Administrador', supervisor: 'Supervisor', funcionario: 'Funcionário' };
const ROLE_CORES: Record<string, string> = { administrador: '#7b1fa2', supervisor: '#1a73e8', funcionario: '#00897b' };

type ManagedRole = Exclude<UserRole, 'master'>;

type DashboardUser = Omit<User, 'criadoEm'> & {
  criadoEm: string | number;
  condominioNome?: string;
  adminNome?: string;
};

interface DashboardCondominio {
  id: string;
  nome: string;
  criadoPor?: string;
  statusPlano?: string;
  totalMoradores?: number;
  totalUsuarios?: number;
  adminNome?: string;
  adminEmail?: string;
  cidade?: string;
  estado?: string;
  plano?: string;
  criadoEm?: string;
  dataFimTeste?: string;
}

interface DashboardMorador {
  id: string;
  nome: string;
  email?: string;
  condominioId?: string;
  condominioNome?: string;
  bloco?: string;
  apartamento?: string;
}

interface DashboardCountsByRole {
  role: UserRole;
  total: number;
}

interface MasterData {
  users: DashboardUser[];
  condominios: DashboardCondominio[];
  moradores: DashboardMorador[];
  countsByRole: DashboardCountsByRole[];
}

interface MasterGroup {
  admin: DashboardUser | null;
  supervisors: DashboardUser[];
  funcionarios: DashboardUser[];
  condominios: DashboardCondominio[];
  moradores: DashboardMorador[];
}

interface StandardActivity {
  tipo?: 'sucesso' | 'aviso' | 'perigo' | 'info';
  texto: string;
  tempo: string;
}

type StatusBadgeVariant = 'sucesso' | 'perigo' | 'neutro' | 'aviso' | 'info';

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function getUserStatusBadge(user: Pick<DashboardUser, 'bloqueado' | 'ativo'>) {
  if (user.bloqueado) {
    return { texto: 'Bloqueado', variante: 'perigo' as const };
  }

  if (user.ativo) {
    return { texto: 'Ativo', variante: 'sucesso' as const };
  }

  return { texto: 'Inativo', variante: 'neutro' as const };
}

function getPlanoStatusVariant(statusPlano?: string): StatusBadgeVariant {
  if (statusPlano === 'ativo') return 'sucesso';
  if (statusPlano === 'inadimplente') return 'perigo';
  if (statusPlano === 'bloqueado') return 'neutro';
  return 'aviso';
}

function getRoleDescription(role?: UserRole) {
  if (role === 'administrador') return 'Administrador';
  if (role === 'supervisor') return 'Supervisor';
  return 'Funcionário';
}

function getActivityBadge(tipo?: StandardActivity['tipo']) {
  if (tipo === 'sucesso') return { texto: '✓', variante: 'sucesso' as const };
  if (tipo === 'aviso') return { texto: '!', variante: 'aviso' as const };
  if (tipo === 'perigo') return { texto: '✕', variante: 'perigo' as const };
  return { texto: '●', variante: 'info' as const };
}

interface UserRowProps {
  user: DashboardUser;
  indent?: number;
  actionLoading: string;
  formatDate: (value: string) => string;
  onEdit: (user: DashboardUser) => void;
  onToggleBlock: (id: string, blocked: boolean) => void;
  onResetPassword: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

const UserRow: React.FC<UserRowProps> = ({
  user,
  indent = 0,
  actionLoading,
  formatDate,
  onEdit,
  onToggleBlock,
  onResetPassword,
  onDelete,
}) => {
  const status = getUserStatusBadge(user);

  return (
    <tr key={user.id} style={{ opacity: actionLoading === user.id ? 0.5 : 1 }}>
      <td style={{ paddingLeft: 12 + indent * 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_CORES[user.role] || '#999', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{user.nome}</div>
            <div style={{ fontSize: 11.5, color: 'var(--cor-texto-secundario)' }}>{user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span style={{ fontSize: 12, fontWeight: 600, color: ROLE_CORES[user.role] || '#666', background: `${ROLE_CORES[user.role] || '#666'}15`, padding: '2px 10px', borderRadius: 20 }}>
          {ROLE_LABELS[user.role] || user.role}
        </span>
      </td>
      <td>{user.condominioNome || '—'}</td>
      <td>{formatDate(String(user.criadoEm))}</td>
      <td>
        <StatusBadge texto={status.texto} variante={status.variante} />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button title="Editar" onClick={() => onEdit({ ...user })} style={btnIconStyle}><Edit2 size={14} /></button>
          <button title={user.bloqueado ? 'Desbloquear' : 'Bloquear'} onClick={() => onToggleBlock(user.id, !user.bloqueado)} style={{ ...btnIconStyle, color: user.bloqueado ? '#00897b' : '#d32f2f' }}>
            {user.bloqueado ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
          <button title="Resetar Senha (123456)" onClick={() => onResetPassword(user.id, user.nome)} style={{ ...btnIconStyle, color: '#f57c00' }}><Key size={14} /></button>
          <button title="Excluir" onClick={() => onDelete(user.id, user.nome)} style={{ ...btnIconStyle, color: '#d32f2f' }}><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  );
};

interface StandardSummary {
  reportesAbertos: number;
  execucoesHoje: number;
  totalTarefas: number;
  funcionariosHoje: number;
  totalCondominios: number;
  vencimentosProximos: number;
  semanalArr: Array<{ dia: string; abertas: number; concluidas: number }>;
  tipoArr: Array<{ nome: string; valor: number }>;
  desempenho: Array<{ mes: string; nota: number }>;
  atividades: StandardActivity[];
}

const EMPTY_STANDARD_SUMMARY: StandardSummary = {
  reportesAbertos: 0,
  execucoesHoje: 0,
  totalTarefas: 0,
  funcionariosHoje: 0,
  totalCondominios: 0,
  vencimentosProximos: 0,
  semanalArr: [],
  tipoArr: [],
  desempenho: [],
  atividades: [],
};

function normalizeStandardSummary(data: unknown): StandardSummary {
  if (!data || typeof data !== 'object') {
    return EMPTY_STANDARD_SUMMARY;
  }

  const candidate = data as Partial<StandardSummary>;

  return {
    reportesAbertos: Number(candidate.reportesAbertos) || 0,
    execucoesHoje: Number(candidate.execucoesHoje) || 0,
    totalTarefas: Number(candidate.totalTarefas) || 0,
    funcionariosHoje: Number(candidate.funcionariosHoje) || 0,
    totalCondominios: Number(candidate.totalCondominios) || 0,
    vencimentosProximos: Number(candidate.vencimentosProximos) || 0,
    semanalArr: Array.isArray(candidate.semanalArr) ? candidate.semanalArr : [],
    tipoArr: Array.isArray(candidate.tipoArr) ? candidate.tipoArr : [],
    desempenho: Array.isArray(candidate.desempenho) ? candidate.desempenho : [],
    atividades: Array.isArray(candidate.atividades) ? candidate.atividades : [],
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function escapeCsvValue(value: unknown) {
  let text: string;

  if (value == null) {
    text = '';
  } else if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    text = JSON.stringify(value);
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(d?: string | number) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—';
}

const ORDEM_KEY = 'manutencao-sidebar-ordem';
const FAVORITOS_KEY = 'manutencao-sidebar-favoritos';
const OCULTOS_KEY = 'manutencao-sidebar-ocultos-v2';

function readStoredSet(key: string, fallback: Set<string>) {
  const value = safeStorage.getItem(key);
  if (!value) return new Set<string>(fallback);

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? new Set<string>(parsed.filter((item): item is string => typeof item === 'string'))
      : new Set<string>(fallback);
  } catch {
    return new Set<string>(fallback);
  }
}

function readStoredOrder(key: string) {
  const value = safeStorage.getItem(key);
  if (!value) return [] as string[];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const HIDDEN_BY_DEFAULT = new Set(menuCatalog.filter(item => item.hiddenByDefault).map(item => item.id));

const MobileDashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const { roleNivel, podeVer } = usePermissions();
  const [favoritosIds, setFavoritosIds] = useState<Set<string>>(() => readStoredSet(FAVORITOS_KEY, new Set()));
  const [ocultosIds] = useState<Set<string>>(() => readStoredSet(OCULTOS_KEY, HIDDEN_BY_DEFAULT));
  const [ordemIds] = useState<string[]>(() => readStoredOrder(ORDEM_KEY));

  const toggleFavorito = useCallback((id: string) => {
    setFavoritosIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      safeStorage.setItem(FAVORITOS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const mobileItems = useMemo(() => {
    const base = menuCatalog.filter(item => (
      item.id !== 'dashboard'
      && roleNivel >= item.minRole
      && podeVer(item.id)
      && !ocultosIds.has(item.id)
    ));

    if (ordemIds.length === 0) return base;

    const map = new Map(base.map(item => [item.id, item]));
    const ordered: MenuConfigItem[] = [];

    for (const id of ordemIds) {
      const item = map.get(id);
      if (item) {
        ordered.push(item);
        map.delete(id);
      }
    }

    map.forEach(item => ordered.push(item));
    return ordered;
  }, [ocultosIds, ordemIds, podeVer, roleNivel]);

  return (
    <div className={styles.mobileDashboardHome}>
      <MobileMenuGrid
        items={mobileItems}
        favoritosIds={favoritosIds}
        currentPath="/dashboard"
        onNavigate={navigate}
        onToggleFavorite={toggleFavorito}
        showDashboardBar={false}
        tone="light"
      />
    </div>
  );
};

const MasterDashboard: React.FC<{ usuario: User }> = ({ usuario }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>({});
  const [masterData, setMasterData] = useState<MasterData>({ users: [], condominios: [], moradores: [], countsByRole: [] });
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('todos');
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [showCadastro, setShowCadastro] = useState(false);
  const [editUser, setEditUser] = useState<DashboardUser | null>(null);
  const [cadForm, setCadForm] = useState<{ nome: string; email: string; telefone: string; role: ManagedRole; senha: string }>({ nome: '', email: '', telefone: '', role: 'administrador', senha: '123456' });
  const [actionLoading, setActionLoading] = useState('');
  const [tab, setTab] = useState<'usuarios' | 'relatorio'>('usuarios');
  const [erro, setErro] = useState<string | null>(null);
  // Report filters
  const [repDataInicio, setRepDataInicio] = useState('');
  const [repDataFim, setRepDataFim] = useState('');
  const [repStatus, setRepStatus] = useState('todos');
  const [reportData, setReportData] = useState<{ condominios: DashboardCondominio[]; usuarios: DashboardUser[] } | null>(null);
  const [repLoading, setRepLoading] = useState(false);

  const reportFieldIds = {
    dataInicio: 'dashboard-relatorio-data-inicio',
    dataFim: 'dashboard-relatorio-data-fim',
    status: 'dashboard-relatorio-status',
  };

  const cadastroFieldIds = {
    nome: 'dashboard-cadastro-nome',
    email: 'dashboard-cadastro-email',
    telefone: 'dashboard-cadastro-telefone',
    perfil: 'dashboard-cadastro-perfil',
    senha: 'dashboard-cadastro-senha',
  };

  const edicaoFieldIds = {
    nome: 'dashboard-edicao-nome',
    email: 'dashboard-edicao-email',
    telefone: 'dashboard-edicao-telefone',
    perfil: 'dashboard-edicao-perfil',
    cargo: 'dashboard-edicao-cargo',
    ativo: 'dashboard-edicao-ativo',
  };

  useEscapeKey(() => {
    if (editUser) {
      setEditUser(null);
      return;
    }
    if (showCadastro) {
      setShowCadastro(false);
    }
  }, showCadastro || !!editUser);

  const loadData = useCallback(async () => {
    setErro(null);
    try {
      const [summary, users] = await Promise.all([
        dashboardApi.masterSummary(),
        dashboardApi.masterUsers(),
      ]);
      setDados(summary);
      setMasterData(users as MasterData);
    } catch (error) {
      setErro(getErrorMessage(error, 'Não foi possível carregar o painel master.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Group users by admin
  const grouped = useMemo(() => {
    const admins = masterData.users.filter(u => u.role === 'administrador');
    const supervisors = masterData.users.filter(u => u.role === 'supervisor');
    const funcs = masterData.users.filter(u => u.role === 'funcionario');

    return admins.map((admin): MasterGroup => {
      const adminSups = supervisors.filter(s => s.administradorId === admin.id);
      const adminSupIds = new Set(adminSups.map(s => s.id));
      const adminFuncs = funcs.filter(f => f.administradorId === admin.id);
      const supFuncs = funcs.filter(f => adminSupIds.has(f.supervisorId || ''));
      const adminConds = masterData.condominios.filter(c => c.criadoPor === admin.id);
      const adminCondIds = new Set(adminConds.map(c => c.id));
      const adminMoradores = masterData.moradores.filter(m => adminCondIds.has(m.condominioId || ''));
      const funcionariosUnicos = Array.from(new Map([...adminFuncs, ...supFuncs].map(funcionario => [funcionario.id, funcionario])).values());

      return {
        admin,
        supervisors: adminSups,
        funcionarios: funcionariosUnicos,
        condominios: adminConds,
        moradores: adminMoradores,
      };
    });
  }, [masterData]);

  // Filter by search
  const filtered = useMemo(() => {
    const term = busca.toLowerCase().trim();
    let result = grouped;
    if (filtroRole === 'semvinculo') {
      const unlinked = masterData.users.filter(u => !u.administradorId && u.role !== 'administrador');
      return [{ admin: null, supervisors: [], funcionarios: unlinked, condominios: [], moradores: [] }];
    }
    if (term) {
      result = result.filter(g => {
          if (!g.admin) return false;
        const adminMatch = g.admin.nome.toLowerCase().includes(term) || g.admin.email.toLowerCase().includes(term);
        const supMatch = g.supervisors.some(s => s.nome.toLowerCase().includes(term) || s.email.toLowerCase().includes(term));
        const funcMatch = g.funcionarios.some(f => f.nome.toLowerCase().includes(term) || f.email.toLowerCase().includes(term));
        const condMatch = g.condominios.some(c => c.nome.toLowerCase().includes(term));
        const morMatch = g.moradores.some(m => m.nome.toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term));
        return adminMatch || supMatch || funcMatch || condMatch || morMatch;
      });
    }
    return result;
  }, [grouped, busca, filtroRole, masterData]);

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const toggleAdmin = (id: string) => {
    setExpandedAdmins(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBloquear = async (id: string, bloqueado: boolean) => {
    if (!confirm(bloqueado
      ? 'Bloquear este usuário? Se for administrador, todos os perfis hierárquicos e QR Codes serão bloqueados também.'
      : 'Desbloquear este usuário e seus hierárquicos?'
    )) return;
    setActionLoading(id);
    try {
      await usuariosApi.bloquear(id, bloqueado, bloqueado ? 'Bloqueado pelo master' : undefined);
      await loadData();
    } catch (error) {
      alert(getErrorMessage(error, 'Não foi possível alterar o bloqueio do usuário.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleResetSenha = async (id: string, nome: string) => {
    if (!confirm(`Resetar a senha de ${nome} para 123456?`)) return;
    setActionLoading(id);
    try {
      await usuariosApi.resetSenha(id, '123456');
      alert('Senha resetada para 123456');
    } catch (error) {
      alert(getErrorMessage(error, 'Erro ao resetar senha.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir ${nome}? Esta ação irá inativar o usuário.`)) return;
    setActionLoading(id);
    try {
      await usuariosApi.remove(id);
      await loadData();
    } catch (error) {
      alert(getErrorMessage(error, 'Não foi possível excluir o usuário.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleCadastrar = async () => {
    if (!cadForm.nome || !cadForm.email) { alert('Preencha nome e e-mail'); return; }
    setActionLoading('cadastro');
    try {
      await authApi.register({ email: cadForm.email, senha: cadForm.senha, nome: cadForm.nome, role: cadForm.role });
      setShowCadastro(false);
      setCadForm({ nome: '', email: '', telefone: '', role: 'administrador', senha: '123456' });
      await loadData();
    } catch (error) {
      alert(getErrorMessage(error, 'Erro ao cadastrar.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleEditar = async () => {
    if (!editUser) return;
    setActionLoading('editar');
    try {
      await usuariosApi.update(editUser.id, {
        nome: editUser.nome,
        role: editUser.role,
        ativo: editUser.ativo,
        telefone: editUser.telefone,
        cargo: editUser.cargo,
      });
      setEditUser(null);
      await loadData();
    } catch (error) {
      alert(getErrorMessage(error, 'Erro ao editar.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleGerarRelatorio = async () => {
    setRepLoading(true);
    try {
      const data = await dashboardApi.masterReport({
        dataInicio: repDataInicio || undefined,
        dataFim: repDataFim || undefined,
        statusPlano: repStatus,
      });
      setReportData(data);
    } catch (error) {
      alert(getErrorMessage(error, 'Erro ao gerar relatório.'));
    } finally {
      setRepLoading(false);
    }
  };

  const exportReportCSV = () => {
    if (!reportData) return;
    let csv = 'Tipo,Nome,Email,Role/Status,Data Cadastro,Admin,Condomínio\n';
    for (const u of (reportData.usuarios || [])) {
      csv += ['Usuário', escapeCsvValue(u.nome), escapeCsvValue(u.email), escapeCsvValue(u.role), escapeCsvValue(formatDate(String(u.criadoEm))), escapeCsvValue(u.adminNome || ''), escapeCsvValue(u.condominioNome || '')].join(',') + '\n';
    }
    for (const c of (reportData.condominios || [])) {
      csv += ['Condomínio', escapeCsvValue(c.nome), escapeCsvValue(c.adminEmail || ''), escapeCsvValue(c.statusPlano || ''), escapeCsvValue(formatDate(c.criadoEm || '')), escapeCsvValue(c.adminNome || ''), escapeCsvValue(`${c.totalUsuarios || 0} usu / ${c.totalMoradores || 0} mor`)].join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-master-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const statCards = [
    { label: 'Total Condomínios',    valor: dados.totalCondominios || 0,       icon: <Building2 size={22} />,      cor: '#303f9f' },
    { label: 'Ativos',              valor: dados.condominiosAtivos || 0,      icon: <UserCheck size={22} />,      cor: '#00897b' },
    { label: 'Em Teste',            valor: dados.condominiosTeste || 0,       icon: <Clock size={22} />,          cor: '#f57c00' },
    { label: 'Inadimplentes',       valor: dados.condominiosInadimplentes || 0, icon: <AlertTriangle size={22} />, cor: '#d32f2f' },
    { label: 'Bloqueados',          valor: dados.condominiosBloqueados || 0,  icon: <Ban size={22} />,            cor: '#9e9e9e' },
    { label: 'Administradores',     valor: dados.totalAdmins || 0,            icon: <Shield size={22} />,         cor: '#7b1fa2' },
    { label: 'Total Usuários',      valor: dados.totalUsuarios || 0,          icon: <Users size={22} />,          cor: '#1a73e8' },
    { label: 'Usuários Bloqueados', valor: dados.usuariosBloqueados || 0,     icon: <UserX size={22} />,          cor: '#d32f2f' },
    { label: 'Sem Vínculo',         valor: dados.usuariosSemVinculo || 0,     icon: <UserX size={22} />,          cor: '#f57c00' },
  ];

  const countsByRole = (masterData.countsByRole || []).reduce<Partial<Record<UserRole, number>>>((acc, r) => ({ ...acc, [r.role]: r.total }), {});

  return (
    <div id="dashboard-content">
      <HowItWorks
        titulo="Painel Master — Gestão da Plataforma"
        descricao="Gerencie todo os usuários, condomínios e moradores. Ao bloquear um administrador, todos os perfis e QR Codes associados são bloqueados automaticamente."
        passos={[
          'Visualize e gerencie todos os usuários agrupados por administrador',
          'Use a busca inteligente por nome ou e-mail para encontrar qualquer usuário',
          'Bloqueie, edite, exclua ou resete a senha de qualquer usuário',
          'Gere relatórios filtrados por data, status do plano (teste, ativo, inadimplente)',
        ]}
      />

      <PageHeader
        titulo={`Olá, ${usuario?.nome || 'Master'} 👋`}
        subtitulo={`${usuario?.role === 'master' ? 'Master' : 'Administrador'} — Painel de gestão da plataforma`}
        onCompartilhar={() => compartilharConteudo('Dashboard Master', 'Resumo da plataforma Manutenção X')}
        onImprimir={() => imprimirElemento('dashboard-content')}
        onGerarPdf={() => gerarPdfDeElemento('dashboard-content', 'dashboard-master')}
      />

      {erro && (
        <Card padding="md" style={{ marginBottom: 16, border: '1px solid rgba(211,47,47,0.2)', background: 'rgba(211,47,47,0.05)' }}>
          <div style={{ color: '#b71c1c', fontWeight: 600 }}>{erro}</div>
        </Card>
      )}

      {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div> : <>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {statCards.map(stat => (
          <Card key={stat.label} hover padding="md">
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: `${stat.cor}15`, color: stat.cor }}>{stat.icon}</div>
              <div className={styles.statInfo}>
                <span className={styles.statValor}>{stat.valor}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Nav */}
      <div className={styles.navGrid}>
        <button className={styles.navItem} onClick={() => navigate('/condominios')}>
          <span className={styles.navIcon}><Building2 size={22} /></span>
          <span className={styles.navLabel}>Condomínios</span>
        </button>
        <button className={styles.navItem} onClick={() => navigate('/usuarios')}>
          <span className={styles.navIcon}><Users size={22} /></span>
          <span className={styles.navLabel}>Usuários</span>
        </button>
        <button className={styles.navItem} onClick={() => navigate('/configuracoes')}>
          <span className={styles.navIcon}><Settings size={22} /></span>
          <span className={styles.navLabel}>Configurações</span>
        </button>
        <button className={styles.navItem} onClick={() => navigate('/relatorios')}>
          <span className={styles.navIcon}><TrendingUp size={22} /></span>
          <span className={styles.navLabel}>Relatórios</span>
        </button>
      </div>

      {/* Tabs: Usuários | Relatório */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--cor-borda)' }}>
        <button onClick={() => setTab('usuarios')} style={{
          padding: '12px 24px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
          color: tab === 'usuarios' ? 'var(--cor-primaria)' : 'var(--cor-texto-secundario)',
          borderBottom: tab === 'usuarios' ? '3px solid var(--cor-primaria)' : '3px solid transparent',
          marginBottom: -2,
        }}>
          <Users size={16} style={{ marginRight: 6, verticalAlign: -3 }} /> Gestão de Usuários
        </button>
        <button onClick={() => setTab('relatorio')} style={{
          padding: '12px 24px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
          color: tab === 'relatorio' ? 'var(--cor-primaria)' : 'var(--cor-texto-secundario)',
          borderBottom: tab === 'relatorio' ? '3px solid var(--cor-primaria)' : '3px solid transparent',
          marginBottom: -2,
        }}>
          <Filter size={16} style={{ marginRight: 6, verticalAlign: -3 }} /> Relatórios
        </button>
      </div>

      {/* ═══ TAB: Gestão de Usuários ═══ */}
      {tab === 'usuarios' && (
      <>
        {/* Role summary badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {(['administrador', 'supervisor', 'funcionario'] as const).map(r => (
            <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
              background: `${ROLE_CORES[r]}12`, border: `1px solid ${ROLE_CORES[r]}30`, fontSize: 13, fontWeight: 600, color: ROLE_CORES[r] }}>
              {ROLE_LABELS[r]}:&nbsp;<strong>{countsByRole[r] || 0}</strong>
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
            background: '#30399f12', border: '1px solid #30399f30', fontSize: 13, fontWeight: 600, color: '#303f9f' }}>
            Condomínios:&nbsp;<strong>{masterData.condominios.length}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
            background: '#f5700012', border: '1px solid #f5700030', fontSize: 13, fontWeight: 600, color: '#f57c00' }}>
            Moradores:&nbsp;<strong>{masterData.moradores.length}</strong>
          </span>
        </div>

        {/* Search + Actions bar */}
        <Card padding="md" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cor-texto-secundario)' }} />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail, condomínio..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--cor-borda)', borderRadius: 10, fontSize: 14, background: 'var(--cor-fundo)', color: 'var(--cor-texto)', outline: 'none' }}
              />
            </div>
            <select value={filtroRole} onChange={e => setFiltroRole(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid var(--cor-borda)', borderRadius: 10, fontSize: 13, background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>
              <option value="todos">Todos</option>
              <option value="semvinculo">Sem Vínculo</option>
            </select>
            <button onClick={() => { setShowCadastro(true); setCadForm({ nome: '', email: '', telefone: '', role: 'administrador', senha: '123456' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--cor-primaria)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={16} /> Cadastrar
            </button>
          </div>
        </Card>

        {/* Users grouped by admin */}
        {filtered.map(group => {
          const admin = group.admin;
          const isExpanded = admin ? expandedAdmins.has(admin.id) : true;
          const totalHier = group.supervisors.length + group.funcionarios.length;

          return (
            <Card key={admin?.id || 'unlinked'} padding="none" style={{ marginBottom: 16, overflow: 'hidden' }}>
              {/* Admin Header */}
              <div style={{
                display: 'flex', alignItems: 'stretch', gap: 12, padding: '14px 16px',
                background: admin?.bloqueado ? 'rgba(211,47,47,0.04)' : 'rgba(123,31,162,0.04)',
                borderBottom: isExpanded ? '1px solid var(--cor-borda)' : 'none',
              }}>
                <button
                  type="button"
                  onClick={() => admin && toggleAdmin(admin.id)}
                  disabled={!admin}
                  aria-expanded={admin ? isExpanded : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: admin ? 'pointer' : 'default',
                    background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'inherit',
                  }}
                >
                  {admin && (isExpanded ? <ChevronDown size={18} color="#7b1fa2" /> : <ChevronRight size={18} color="#7b1fa2" />)}
                  <Shield size={20} color={admin?.bloqueado ? '#d32f2f' : '#7b1fa2'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cor-texto)' }}>
                      {admin ? admin.nome : 'Usuários Sem Vínculo'}
                      {admin?.bloqueado && <span style={{ marginLeft: 8, fontSize: 11, color: '#d32f2f', fontWeight: 600 }}>BLOQUEADO</span>}
                    </div>
                    {admin && <div style={{ fontSize: 12, color: 'var(--cor-texto-secundario)' }}>
                      {admin.email} — Cadastro: {formatDate(String(admin.criadoEm))}
                      {' — '}{group.condominios.length} {pluralize(group.condominios.length, 'condomínio', 'condomínios')}
                      {' — '}{totalHier} {pluralize(totalHier, 'usuário', 'usuários')}
                      {' — '}{group.moradores.length} {pluralize(group.moradores.length, 'morador', 'moradores')}
                    </div>}
                  </div>
                </button>
                {admin && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button title="Editar" onClick={() => setEditUser({ ...admin })} style={btnIconStyle}><Edit2 size={14} /></button>
                    <button title={admin.bloqueado ? 'Desbloquear Todos' : 'Bloquear Todos'} onClick={() => handleBloquear(admin.id, !admin.bloqueado)}
                      style={{ ...btnIconStyle, color: admin.bloqueado ? '#00897b' : '#d32f2f' }}>
                      {admin.bloqueado ? <Unlock size={14} /> : <Lock size={14} />}
                    </button>
                    <button title="Resetar Senha" onClick={() => handleResetSenha(admin.id, admin.nome)} style={{ ...btnIconStyle, color: '#f57c00' }}><Key size={14} /></button>
                    <button title="Excluir" onClick={() => handleExcluir(admin.id, admin.nome)} style={{ ...btnIconStyle, color: '#d32f2f' }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ overflow: 'auto' }}>
                  {/* Condominios of this admin */}
                  {group.condominios.length > 0 && (
                    <div style={{ padding: '10px 16px', background: 'rgba(48,63,159,0.03)', borderBottom: '1px solid var(--cor-borda)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#303f9f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <Building2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Condomínios
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.condominios.map(c => (
                          <span key={c.id} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 16, background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
                            {c.nome}
                            <span style={{ marginLeft: 6, color: c.statusPlano ? STATUS_CORES[c.statusPlano] || '#999' : '#999', fontWeight: 600 }}>
                              ({c.statusPlano ? STATUS_LABELS[c.statusPlano] || c.statusPlano : 'Sem status'})
                            </span>
                            <span style={{ marginLeft: 4, color: '#666' }}>— {c.totalMoradores || 0} {pluralize(c.totalMoradores || 0, 'morador', 'moradores')}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moradores */}
                  {group.moradores.length > 0 && (
                    <div style={{ padding: '10px 16px', background: 'rgba(245,124,0,0.03)', borderBottom: '1px solid var(--cor-borda)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f57c00', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <Home size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Moradores ({group.moradores.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {group.moradores.slice(0, 20).map(m => (
                          <span key={m.id} style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 14, background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
                            {m.nome} <span style={{ color: 'var(--cor-texto-secundario)' }}>({m.condominioNome} {m.bloco ? `B${m.bloco}` : ''}{m.apartamento ? ` Ap${m.apartamento}` : ''})</span>
                          </span>
                        ))}
                        {group.moradores.length > 20 && <span style={{ fontSize: 11.5, padding: '3px 10px', color: 'var(--cor-texto-secundario)' }}>+{group.moradores.length - 20} moradores</span>}
                      </div>
                    </div>
                  )}

                  {/* Supervisors and Funcionários table */}
                  {(group.supervisors.length > 0 || group.funcionarios.length > 0) && (
                    <table className={styles.masterTable}>
                      <thead>
                        <tr>
                          <th>Usuário</th>
                          <th>Perfil</th>
                          <th>Condomínio</th>
                          <th>Cadastro</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.supervisors.map(user => (
                          <UserRow
                            key={user.id}
                            user={user}
                            actionLoading={actionLoading}
                            formatDate={formatDate}
                            onEdit={setEditUser}
                            onToggleBlock={handleBloquear}
                            onResetPassword={handleResetSenha}
                            onDelete={handleExcluir}
                          />
                        ))}
                        {group.funcionarios.map(user => (
                          <UserRow
                            key={user.id}
                            user={user}
                            indent={group.supervisors.length > 0 ? 1 : 0}
                            actionLoading={actionLoading}
                            formatDate={formatDate}
                            onEdit={setEditUser}
                            onToggleBlock={handleBloquear}
                            onResetPassword={handleResetSenha}
                            onDelete={handleExcluir}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}

                  {group.supervisors.length === 0 && group.funcionarios.length === 0 && group.condominios.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--cor-texto-secundario)', fontSize: 13 }}>
                      Nenhum usuário hierárquico, condomínio ou morador vinculado
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card padding="md">
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--cor-texto-secundario)' }}>
              Nenhum resultado encontrado para "{busca}"
            </div>
          </Card>
        )}
      </>
      )}

      {/* ═══ TAB: Relatórios ═══ */}
      {tab === 'relatorio' && (
      <>
        <Card padding="md" style={{ marginBottom: 20 }}>
          <h3 className={styles.chartTitle} style={{ marginBottom: 16 }}>Gerar Relatório</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label htmlFor={reportFieldIds.dataInicio} style={labelStyle}>Data Início</label>
              <input id={reportFieldIds.dataInicio} type="date" value={repDataInicio} onChange={e => setRepDataInicio(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor={reportFieldIds.dataFim} style={labelStyle}>Data Fim</label>
              <input id={reportFieldIds.dataFim} type="date" value={repDataFim} onChange={e => setRepDataFim(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor={reportFieldIds.status} style={labelStyle}>Status do Plano</label>
              <select id={reportFieldIds.status} value={repStatus} onChange={e => setRepStatus(e.target.value)} style={inputStyle}>
                <option value="todos">Todos</option>
                <option value="ativo">Adimplente (Ativo)</option>
                <option value="teste">Em Teste</option>
                <option value="inadimplente">Inadimplente</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
            <button onClick={handleGerarRelatorio} disabled={repLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: 'var(--cor-primaria)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: repLoading ? 0.6 : 1 }}>
              <Filter size={16} /> {repLoading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
            {reportData && (
              <button onClick={exportReportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#00897b', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <Download size={16} /> Exportar CSV
              </button>
            )}
          </div>
        </Card>

        {reportData && (
        <>
          {/* Report: Condominios */}
          <Card padding="md" style={{ marginBottom: 16 }}>
            <h3 className={styles.chartTitle}>Condomínios ({(reportData.condominios || []).length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.masterTable}>
                <thead>
                  <tr>
                    <th>Condomínio</th>
                    <th>Cidade/UF</th>
                    <th>Admin</th>
                    <th>Status</th>
                    <th>Plano</th>
                    <th>Cadastro</th>
                    <th>Teste até</th>
                    <th>Usuários</th>
                    <th>Moradores</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData.condominios || []).length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--cor-texto-secundario)' }}>Nenhum condomínio encontrado</td></tr>
                  )}
                  {(reportData.condominios || []).map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nome}</td>
                      <td>{c.cidade ? `${c.cidade}/${c.estado}` : '—'}</td>
                      <td>{c.adminNome || '—'}</td>
                      <td>
                        <StatusBadge
                          texto={c.statusPlano ? STATUS_LABELS[c.statusPlano] || c.statusPlano : '—'}
                          variante={getPlanoStatusVariant(c.statusPlano)}
                        />
                      </td>
                      <td>{c.plano || '—'}</td>
                      <td>{c.criadoEm ? new Date(String(c.criadoEm)).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{c.dataFimTeste ? new Date(String(c.dataFimTeste)).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{c.totalUsuarios || 0}</td>
                      <td>{c.totalMoradores || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Report: Users */}
          <Card padding="md">
            <h3 className={styles.chartTitle}>Usuários ({(reportData.usuarios || []).length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.masterTable}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Condomínio</th>
                    <th>Admin</th>
                    <th>Status</th>
                    <th>Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData.usuarios || []).length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--cor-texto-secundario)' }}>Nenhum usuário encontrado</td></tr>
                  )}
                  {(reportData.usuarios || []).map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.nome}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ROLE_CORES[u.role] || '#666', background: `${ROLE_CORES[u.role] || '#666'}15`, padding: '2px 10px', borderRadius: 20 }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>{u.condominioNome || '—'}</td>
                      <td>{u.adminNome || '—'}</td>
                      <td>
                        <StatusBadge {...getUserStatusBadge(u)} />
                      </td>
                      <td>{formatDate(String(u.criadoEm))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
        )}
      </>
      )}

      {/* ═══ MODAL: Cadastrar Usuário ═══ */}
      <Modal aberto={showCadastro} onFechar={() => setShowCadastro(false)} titulo="Cadastrar Usuário" largura="md">
        {showCadastro && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label htmlFor={cadastroFieldIds.nome} style={labelStyle}>Nome *</label><input id={cadastroFieldIds.nome} value={cadForm.nome} onChange={e => setCadForm(p => ({ ...p, nome: e.target.value }))} style={inputStyle} /></div>
              <div><label htmlFor={cadastroFieldIds.email} style={labelStyle}>E-mail *</label><input id={cadastroFieldIds.email} value={cadForm.email} onChange={e => setCadForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} type="email" /></div>
              <div><label htmlFor={cadastroFieldIds.telefone} style={labelStyle}>Telefone</label><input id={cadastroFieldIds.telefone} value={cadForm.telefone} onChange={e => setCadForm(p => ({ ...p, telefone: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label htmlFor={cadastroFieldIds.perfil} style={labelStyle}>Perfil</label>
                <select id={cadastroFieldIds.perfil} value={cadForm.role} onChange={e => setCadForm(p => ({ ...p, role: e.target.value as ManagedRole }))} style={inputStyle}>
                  <option value="administrador">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="funcionario">Funcionário</option>
                </select>
              </div>
              <div><label htmlFor={cadastroFieldIds.senha} style={labelStyle}>Senha</label><input id={cadastroFieldIds.senha} value={cadForm.senha} onChange={e => setCadForm(p => ({ ...p, senha: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCadastro(false)} style={{ padding: '10px 20px', border: '1px solid var(--cor-borda)', borderRadius: 10, background: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--cor-texto)' }}>Cancelar</button>
              <button onClick={handleCadastrar} disabled={actionLoading === 'cadastro'}
                style={{ padding: '10px 24px', background: 'var(--cor-primaria)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                {actionLoading === 'cadastro' ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ═══ MODAL: Editar Usuário ═══ */}
      <Modal aberto={!!editUser} onFechar={() => setEditUser(null)} titulo="Editar Usuário" largura="md">
        {editUser && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label htmlFor={edicaoFieldIds.nome} style={labelStyle}>Nome</label><input id={edicaoFieldIds.nome} value={editUser.nome} onChange={e => setEditUser(p => p ? { ...p, nome: e.target.value } : p)} style={inputStyle} /></div>
              <div><label htmlFor={edicaoFieldIds.email} style={labelStyle}>E-mail</label><input id={edicaoFieldIds.email} value={editUser.email} disabled style={{ ...inputStyle, opacity: 0.6 }} /></div>
              <div><label htmlFor={edicaoFieldIds.telefone} style={labelStyle}>Telefone</label><input id={edicaoFieldIds.telefone} value={editUser.telefone || ''} onChange={e => setEditUser(p => p ? { ...p, telefone: e.target.value } : p)} style={inputStyle} /></div>
              <div>
                <label htmlFor={edicaoFieldIds.perfil} style={labelStyle}>Perfil</label>
                <select id={edicaoFieldIds.perfil} value={editUser.role} onChange={e => setEditUser(p => p ? { ...p, role: e.target.value as UserRole } : p)} style={inputStyle}>
                  <option value="administrador">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="funcionario">Funcionário</option>
                </select>
              </div>
              <div><label htmlFor={edicaoFieldIds.cargo} style={labelStyle}>Cargo</label><input id={edicaoFieldIds.cargo} value={editUser.cargo || ''} onChange={e => setEditUser(p => p ? { ...p, cargo: e.target.value } : p)} style={inputStyle} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id={edicaoFieldIds.ativo} type="checkbox" checked={editUser.ativo} onChange={e => setEditUser(p => p ? { ...p, ativo: e.target.checked } : p)} />
                <label htmlFor={edicaoFieldIds.ativo} style={{ fontSize: 14 }}>Ativo</label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '10px 20px', border: '1px solid var(--cor-borda)', borderRadius: 10, background: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--cor-texto)' }}>Cancelar</button>
              <button onClick={handleEditar} disabled={actionLoading === 'editar'}
                style={{ padding: '10px 24px', background: 'var(--cor-primaria)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                {actionLoading === 'editar' ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </Modal>

      </>}
    </div>
  );
};

/* ── Estilos inline auxiliares ── */
const btnIconStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--cor-borda)', borderRadius: 8, width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  color: 'var(--cor-texto-secundario)', transition: 'all 0.15s',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--cor-texto-secundario)', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--cor-borda)', borderRadius: 10, fontSize: 14, background: 'var(--cor-fundo)', color: 'var(--cor-texto)' };

/* ══════════ DASHBOARD PADRÃO (admin/supervisor/func) ══════════ */
const StandardDashboard: React.FC = () => {
  const { usuario } = useAuth();
  const { roleNivel } = usePermissions();
  const navigate = useNavigate();
  const isFuncSupervisor = roleNivel <= 2;

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<StandardSummary>(EMPTY_STANDARD_SUMMARY);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.summary()
      .then(data => {
        setDados(normalizeStandardSummary(data));
        setErro(null);
      })
      .catch(error => setErro(getErrorMessage(error, 'Não foi possível carregar o resumo do dashboard.')))
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Reportes Abertos',    valor: dados.reportesAbertos,    icon: <Wrench size={22} />,         cor: '#1a73e8' },
    { label: 'Execuções Hoje',      valor: dados.execucoesHoje,      icon: <Clock size={22} />,          cor: '#f57c00' },
    { label: 'Tarefas Agendadas',   valor: dados.totalTarefas,       icon: <ClipboardCheck size={22} />, cor: '#00897b' },
    { label: 'Funcionários Hoje',   valor: dados.funcionariosHoje,   icon: <Users size={22} />,          cor: '#7b1fa2' },
    { label: 'Condomínios',         valor: dados.totalCondominios,   icon: <Building2 size={22} />,      cor: '#303f9f' },
    { label: 'Vencimentos Próximos', valor: dados.vencimentosProximos, icon: <AlertTriangle size={22} />, cor: '#d32f2f' },
  ];
  const tipoData = dados.tipoArr.length ? dados.tipoArr : [{ nome: 'Sem dados', valor: 1 }];
  const roleDescription = getRoleDescription(usuario?.role);

  return (
    <div id="dashboard-content">
      <HowItWorks
        titulo="Dashboard - Visão Geral"
        descricao="O Dashboard apresenta um resumo completo do sistema. Aqui você tem acesso rápido a toda as informações importantes."
        passos={[
          'Visualize os indicadores principais no topo da página (reportes, execuções, tarefas, etc.)',
          'Funcionários e supervisores acessam as funções diretamente pelos ícones no dashboard',
          'Administradores acompanham gráficos de atividades semanais, distribuição por categoria e desempenho mensal',
          'Use os botões de compartilhar, imprimir ou gerar PDF para exportar dados',
        ]}
      />

      <PageHeader
        titulo={`Olá, ${usuario?.nome || 'Usuário'} 👋`}
        subtitulo={`${roleDescription} — Aqui está o resumo do seu sistema`}
        onCompartilhar={() => compartilharConteudo('Dashboard', 'Resumo do sistema Manutenção X')}
        onImprimir={() => imprimirElemento('dashboard-content')}
        onGerarPdf={() => gerarPdfDeElemento('dashboard-content', 'dashboard')}
      />

      {/* Banner de dados de exemplo */}
      <Card padding="md" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, #1a73e820 0%, #7b1fa215 100%)',
        border: '1px solid #1a73e830',
        borderLeft: '4px solid #1a73e8',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            background: '#1a73e815',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users size={22} style={{ color: '#1a73e8' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 4 }}>
              Perfis de exemplo ativos
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              O sistema já vem configurado com <strong>dados de demonstração</strong> — usuários, ordens de serviço, equipamentos e mais — para que você explore todas as funcionalidades.
              Ao contratar o plano, esses dados serão <strong>removidos automaticamente</strong>.
            </div>
          </div>
        </div>
      </Card>

      {erro && (
        <Card padding="md" style={{ marginBottom: 16, border: '1px solid rgba(211,47,47,0.2)', background: 'rgba(211,47,47,0.05)' }}>
          <div style={{ color: '#b71c1c', fontWeight: 600 }}>{erro}</div>
        </Card>
      )}

      {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div> : <>

      {/* Stats Grid */}
      <div className={`${styles.statsGrid} ${isFuncSupervisor ? styles.statsGridCompact : ''}`}>
        {statCards.map(stat => (
          <Card key={stat.label} hover padding="md">
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: `${stat.cor}15`, color: stat.cor }}>
                {stat.icon}
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValor}>{stat.valor}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Navegação rápida para funcionário/supervisor */}
      {isFuncSupervisor && (
        <>
          <div className={styles.divider} />
          <div className={styles.navGrid}>
            {NAV_ITEMS_FUNC.map(item => (
              <button
                key={item.rota}
                className={styles.navItem}
                onClick={() => navigate(item.rota)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Charts — visíveis apenas para administrador */}
      {usuario?.role === 'administrador' && (
      <div className={styles.chartsRow}>
        <Card padding="md">
          <h3 className={styles.chartTitle}>Atividades - Última Semana</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados.semanalArr}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="dia" stroke="var(--cor-texto-secundario)" fontSize={12} />
              <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'var(--cor-superficie)',
                  border: '1px solid var(--cor-borda)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="abertas" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Registradas" />
              <Bar dataKey="concluidas" fill="#00897b" radius={[4, 4, 0, 0]} name="Concluídas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md">
          <h3 className={styles.chartTitle}>Distribuição por Categoria</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={tipoData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="valor"
                nameKey="nome"
                label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
              >
                {tipoData.map((item, i: number) => (
                  <Cell key={`${item.nome}-${i}`} fill={dados.tipoArr.length ? CORES_GRAFICO[i % CORES_GRAFICO.length] : '#ccc'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      )}

      {usuario?.role === 'administrador' && (
      <div className={styles.chartsRow}>
        <Card padding="md">
          <h3 className={styles.chartTitle}>Desempenho Mensal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dados.desempenho}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="mes" stroke="var(--cor-texto-secundario)" fontSize={12} />
              <YAxis domain={[0, 5]} stroke="var(--cor-texto-secundario)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'var(--cor-superficie)',
                  border: '1px solid var(--cor-borda)',
                  borderRadius: 8,
                }}
              />
              <Line type="monotone" dataKey="nota" stroke="#1a73e8" strokeWidth={3} dot={{ r: 5 }} name="Nota (0-5)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md">
          <h3 className={styles.chartTitle}>Atividade Recente</h3>
          <div className={styles.activityList}>
            {dados.atividades.length === 0 && (
              <div className={styles.activityItem}>
                <StatusBadge texto="●" variante="info" />
                <div className={styles.activityInfo}>
                  <span className={styles.activityText}>Nenhuma atividade registrada ainda</span>
                  <span className={styles.activityTime}>—</span>
                </div>
              </div>
            )}
            {dados.atividades.map((item, i: number) => (
              <div key={`${item.texto}-${item.tempo}-${i}`} className={styles.activityItem}>
                <StatusBadge {...getActivityBadge(item.tipo)} />
                <div className={styles.activityInfo}>
                  <span className={styles.activityText}>{item.texto}</span>
                  <span className={styles.activityTime}>{item.tempo}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}

      </>}
    </div>
  );
};

/* ══════════ MAIN WRAPPER ══════════ */
const DashboardPage: React.FC = () => {
  const { usuario } = useAuth();
  const [isMobile, setIsMobile] = useState(() => globalThis.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(globalThis.innerWidth <= 768);
    globalThis.addEventListener('resize', onResize);
    return () => globalThis.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    return <MobileDashboardHome />;
  }

  if (usuario?.role === 'master') {
    return <MasterDashboard usuario={usuario} />;
  }
  return <StandardDashboard />;
};

export default DashboardPage;
