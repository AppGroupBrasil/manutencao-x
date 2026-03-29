import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import {
  LayoutDashboard, Users, ClipboardCheck, Wrench, Calendar,
  Package, Search, MapPin, Settings, LogOut, ChevronLeft,
    ChevronRight, Building2, BarChart3, Shield, Menu, FileWarning, Eye, QrCode, ScanLine, Flame, CalendarCheck, BookOpen, CalendarClock, Contact, Megaphone, Columns3, GripVertical, RotateCcw, Bell, User, Star,
  Cog, Store, CalendarRange, DollarSign, Activity, FileText, MessageSquareText, ShieldCheck, CalendarDays, MessageCircle, Crown, Clock, Receipt, EyeOff
} from 'lucide-react';
import styles from './Sidebar.module.css';
import logoImg from '../../assets/logo.png';
import { notificacoes as notificacoesApi } from '../../services/api';
import { safeStorage } from '../../utils/storage';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  rota: string;
  minRole: number;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, rota: '/dashboard', minRole: 1 },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', icon: <CalendarClock size={20} />, rota: '/vencimentos', minRole: 2 },
  { id: 'auditoria', label: 'Auditoria & Métricas', icon: <Shield size={20} />, rota: '/auditoria', minRole: 3 },
  { id: 'condominios', label: 'Cadastro Local da Manutenção', icon: <Building2 size={20} />, rota: '/condominios', minRole: 2 },
  { id: 'moradores', label: 'Cadastro de Moradores', icon: <Contact size={20} />, rota: '/moradores', minRole: 2 },
  { id: 'permissoes', label: 'Cadastro de Permissões', icon: <Shield size={20} />, rota: '/permissoes', minRole: 3 },
  { id: 'usuarios', label: 'Cadastro de Usuários', icon: <Users size={20} />, rota: '/usuarios', minRole: 3 },
  { id: 'calendario', label: 'Calendário Manutenção', icon: <CalendarDays size={20} />, rota: '/calendario', minRole: 2 },
  { id: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={20} />, rota: '/checklists', minRole: 1 },
  { id: 'comunicados', label: 'Comunicados / Avisos', icon: <Megaphone size={20} />, rota: '/comunicados', minRole: 2 },
  { id: 'configuracoes', label: 'Configurações', icon: <Settings size={20} />, rota: '/configuracoes', minRole: 1 },
  { id: 'materiais', label: 'Controle de Estoque', icon: <Package size={20} />, rota: '/materiais', minRole: 1 },
  { id: 'ponto', label: 'Controle de Ponto', icon: <Clock size={20} />, rota: '/ponto', minRole: 1 },
  { id: 'sla', label: 'Controle de SLA', icon: <ShieldCheck size={20} />, rota: '/sla', minRole: 2 },
  { id: 'qrcode', label: 'QR Code', icon: <QrCode size={20} />, rota: '/qrcode', minRole: 2 },
  { id: 'documentos', label: 'Documentação Técnica', icon: <FileText size={20} />, rota: '/documentos', minRole: 2 },
  { id: 'equipamentos', label: 'Equipamentos', icon: <Cog size={20} />, rota: '/equipamentos', minRole: 2 },
  { id: 'escalas', label: 'Escalas', icon: <Calendar size={20} />, rota: '/escalas', minRole: 2 },
  { id: 'fornecedores', label: 'Fornecedores', icon: <Store size={20} />, rota: '/fornecedores', minRole: 2 },
  { id: 'geolocalizacao', label: 'Geolocalização', icon: <MapPin size={20} />, rota: '/geolocalizacao', minRole: 2 },
  { id: 'custos', label: 'Gestão de Custos', icon: <DollarSign size={20} />, rota: '/custos', minRole: 2 },
  { id: 'inspecoes', label: 'Inspeções', icon: <Search size={20} />, rota: '/inspecoes', minRole: 2 },
  { id: 'kpis', label: 'KPIs de Manutenção', icon: <Activity size={20} />, rota: '/kpis', minRole: 2 },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', icon: <ScanLine size={20} />, rota: '/leitor-qrcode', minRole: 1 },
  { id: 'orcamentos', label: 'Orçamentos', icon: <Receipt size={20} />, rota: '/orcamentos', minRole: 2 },
  { id: 'ordens', label: 'Ordens de Serviço', icon: <Wrench size={20} />, rota: '/ordens-servico', minRole: 1 },
  { id: 'sindico', label: 'Painel do Síndico', icon: <Crown size={20} />, rota: '/sindico', minRole: 3 },
  { id: 'planos-manutencao', label: 'Planos Preventivos', icon: <CalendarRange size={20} />, rota: '/planos-manutencao', minRole: 2 },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', icon: <Columns3 size={20} />, rota: '/quadro-atividades', minRole: 1 },
  { id: 'mapa-calor', label: 'Reclamações', icon: <Flame size={20} />, rota: '/mapa-calor', minRole: 3 },
  { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={20} />, rota: '/relatorios', minRole: 2 },
  { id: 'reportes', label: 'Reportes', icon: <FileWarning size={20} />, rota: '/reportes', minRole: 1 },
  { id: 'roteiros', label: 'Roteiro de Execução', icon: <BookOpen size={20} />, rota: '/roteiros', minRole: 1 },
  { id: 'solicitacoes', label: 'Solicitações', icon: <MessageSquareText size={20} />, rota: '/respostas-qrcode', minRole: 2 },
  { id: 'tarefas', label: 'Tarefas Agendadas', icon: <CalendarCheck size={20} />, rota: '/tarefas', minRole: 1 },
  { id: 'vistorias', label: 'Vistorias', icon: <Eye size={20} />, rota: '/vistorias', minRole: 1 },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={20} />, rota: '/whatsapp', minRole: 3 },
];

const ORDEM_KEY = 'manutencao-sidebar-ordem';
const FAVORITOS_KEY = 'manutencao-sidebar-favoritos';
const OCULTOS_KEY = 'manutencao-sidebar-ocultos-v2';
const DICA_MENU_KEY = 'manutencao-dica-menu-vista';

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

// Itens ocultos por padrão — o usuário pode reativá-los em "Ocultar"
const OCULTOS_PADRAO = new Set([
  'auditoria',
  'permissoes',
  'comunicados',
  'configuracoes',
  'ponto',
  'sla',
  'documentos',
  'fornecedores',
  'custos',
  'kpis',
  'roteiros',
  'whatsapp',
  'moradores',
]);

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const { tema } = useTheme();
  const { roleNivel, podeVer } = usePermissions();
  const { isDemo, setDemo } = useDemo();

  // --- Favoritos ---
  const [favoritosIds, setFavoritosIds] = useState<Set<string>>(() => readStoredSet(FAVORITOS_KEY, new Set()));

  const toggleFavorito = useCallback((id: string) => {
    setFavoritosIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      safeStorage.setItem(FAVORITOS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // --- Itens ocultos ---
  const [ocultosIds, setOcultosIds] = useState<Set<string>>(() => readStoredSet(OCULTOS_KEY, OCULTOS_PADRAO));
  const [editandoVisibilidade, setEditandoVisibilidade] = useState(false);

  const toggleOculto = useCallback((id: string) => {
    setOcultosIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      // Persiste a escolha do usuário (sobrescreve o padrão)
      safeStorage.setItem(OCULTOS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const restaurarTodos = useCallback(() => {
    setOcultosIds(new Set());
    // Salva explicitamente Set vazio para indicar que o usuário escolheu mostrar tudo
    safeStorage.setItem(OCULTOS_KEY, JSON.stringify([]));
  }, []);

  // --- Ordem personalizada ---
  const [ordemIds, setOrdemIds] = useState<string[]>(() => readStoredOrder(ORDEM_KEY));
  const [editandoOrdem, setEditandoOrdem] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mostrarDica, setMostrarDica] = useState(() => !safeStorage.getItem(DICA_MENU_KEY));
  const [naoMostrarMais, setNaoMostrarMais] = useState(false);

  const fecharDica = useCallback(() => {
    setMostrarDica(false);
    if (naoMostrarMais) safeStorage.setItem(DICA_MENU_KEY, '1');
  }, [naoMostrarMais]);

  useEffect(() => {
    if (!isDemo) {
      notificacoesApi.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {});
      const interval = setInterval(() => {
        notificacoesApi.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {});
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [isDemo]);

  const filteredItems = useMemo(() => {
    const base = menuItems.filter(item => roleNivel >= item.minRole && podeVer(item.id));
    if (ordemIds.length === 0) return base;
    const mapa = new Map(base.map(item => [item.id, item]));
    const ordenados: MenuItem[] = [];
    for (const id of ordemIds) {
      const item = mapa.get(id);
      if (item) { ordenados.push(item); mapa.delete(id); }
    }
    mapa.forEach(item => ordenados.push(item));
    return ordenados;
  }, [ordemIds, roleNivel, podeVer]);

  // Items visíveis (exclui ocultos quando NÃO está editando visibilidade)
  const visibleItems = useMemo(() => {
    if (editandoVisibilidade) return filteredItems;
    return filteredItems.filter(item => !ocultosIds.has(item.id));
  }, [filteredItems, ocultosIds, editandoVisibilidade]);

  const favoritoItems = useMemo(() => {
    return visibleItems.filter(item => favoritosIds.has(item.id) && !ocultosIds.has(item.id));
  }, [visibleItems, favoritosIds, ocultosIds]);

  const salvarOrdem = useCallback((items: MenuItem[]) => {
    const ids = items.map(i => i.id);
    setOrdemIds(ids);
    safeStorage.setItem(ORDEM_KEY, JSON.stringify(ids));
  }, []);

  const resetarOrdem = useCallback(() => {
    setOrdemIds([]);
    safeStorage.removeItem(ORDEM_KEY);
    setEditandoOrdem(false);
  }, []);

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) { dragIdx.current = null; setDragOverIdx(null); return; }
    const copia = [...filteredItems];
    const [movido] = copia.splice(from, 1);
    copia.splice(idx, 0, movido);
    salvarOrdem(copia);
    dragIdx.current = null;
    setDragOverIdx(null);
  }, [filteredItems, salvarOrdem]);

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null;
    setDragOverIdx(null);
  }, []);
  const isMobileBarUser = roleNivel <= 2;

  const handleNav = (rota: string) => {
    navigate(rota);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    if (isDemo) setDemo(false);
    await logout();
    navigate('/');
  };

  const roleLabel: Record<string, string> = {
    master: 'Master',
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    funcionario: 'Funcionário',
  };

  return (
    <>
      {/* Top bar for funcionario/supervisor — apenas header */}
      {isMobileBarUser && (
        <div className={styles.topBar} style={{ backgroundColor: 'var(--cor-menu)' }}>
          <div className={styles.topBarHeader}>
            <div className={styles.topBarBrand}>
              {tema.logoUrl ? (
                <img src={tema.logoUrl} alt="Logo" className={styles.logo} />
              ) : (
                <img src={logoImg} alt="Manutenção X" className={styles.logo} />
              )}
              <span className={styles.brandName}>Manutenção <span className={styles.brandDestaque}>X</span></span>
            </div>
            <div className={styles.topBarActions}>
              {isDemo && (
                <div className={styles.demoBadgeTopBar}>
                  <Eye size={12} /> DEMO
                </div>
              )}
              {usuario && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{roleLabel[usuario.role]}</span>
                  <div className={styles.topBarAvatar}>
                    {usuario.nome.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <button className={styles.topBarLogout} onClick={handleLogout}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button className={`${styles.mobileToggle} ${isMobileBarUser ? styles.hideAlways : ''}`} onClick={() => setMobileOpen(!mobileOpen)}>
        <Menu size={24} />
      </button>

      <div className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`} onClick={() => setMobileOpen(false)} />

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''} ${isMobileBarUser ? styles.hideAlways : ''}`}
        style={{ backgroundColor: 'var(--cor-menu)' }}
      >
        <div className={styles.header}>
          {!collapsed && (
            <div className={styles.brand}>
              {tema.logoUrl ? (
                <img src={tema.logoUrl} alt="Logo" className={styles.logo} />
              ) : (
                <img src={logoImg} alt="Manutenção X" className={styles.logo} />
              )}
              <div className={styles.brandText}>
                <span className={styles.brandName}>Manutenção <span className={styles.brandDestaque}>X</span></span>
              </div>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && usuario && (
          <div className={styles.userInfo}>
            <div className={styles.avatar} onClick={() => handleNav('/perfil')} style={{ cursor: 'pointer' }} title="Meu Perfil">
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{usuario.nome}</span>
              <span className={styles.userRole}>{roleLabel[usuario.role]}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className={styles.iconBtn} onClick={() => handleNav('/perfil')} title="Meu Perfil">
                <User size={16} />
              </button>
              <button className={styles.iconBtn} onClick={() => handleNav('/notificacoes')} title="Notificações" style={{ position: 'relative' }}>
                <Bell size={16} />
                {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
            </div>
          </div>
        )}

        {!collapsed && isDemo && (
          <div className={styles.demoBadge}>
            <Eye size={14} /> MODO DEMONSTRAÇÃO
          </div>
        )}

        <nav className={styles.nav}>
          {!collapsed && (
            <div className={styles.reorderBar}>
              <button
                className={`${styles.reorderToggle} ${editandoOrdem ? styles.reorderToggleAtivo : ''}`}
                onClick={() => { setEditandoOrdem(v => !v); setEditandoVisibilidade(false); }}
                title="Reorganizar menu"
                disabled={editandoVisibilidade}
              >
                <GripVertical size={14} />
                {editandoOrdem ? 'Concluir' : 'Reorganizar'}
              </button>
              <button
                className={`${styles.reorderToggle} ${editandoVisibilidade ? styles.reorderToggleAtivo : ''}`}
                onClick={() => { setEditandoVisibilidade(v => !v); setEditandoOrdem(false); }}
                title="Ocultar itens do menu"
                disabled={editandoOrdem}
              >
                <EyeOff size={14} />
                {editandoVisibilidade ? 'Concluir' : 'Ocultar'}
              </button>
              {editandoOrdem && (
                <button className={styles.reorderReset} onClick={resetarOrdem} title="Restaurar ordem padrão">
                  <RotateCcw size={13} />
                </button>
              )}
              {editandoVisibilidade && ocultosIds.size > 0 && (
                <button className={styles.reorderReset} onClick={restaurarTodos} title="Mostrar todos">
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          )}

          {/* ★ Favoritos */}
          {favoritoItems.length > 0 && !editandoOrdem && (
            <>
              {!collapsed && <div className={styles.favSection}>★ Favoritos</div>}
              {favoritoItems.map(item => (
                <button
                  key={`fav-${item.id}`}
                  className={`${styles.navItem} ${styles.navItemFav} ${location.pathname === item.rota ? styles.active : ''}`}
                  onClick={() => handleNav(item.rota)}
                  title={collapsed ? `★ ${item.label}` : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {!collapsed && (
                    <button
                      className={styles.favBtn}
                      onClick={e => { e.stopPropagation(); toggleFavorito(item.id); }}
                      title="Remover dos favoritos"
                    >
                      <Star size={13} fill="#f59e0b" color="#f59e0b" />
                    </button>
                  )}
                  {!collapsed && location.pathname === item.rota && <div className={styles.activeIndicator} />}
                </button>
              ))}
              {!collapsed && <div className={styles.favDivider} />}
            </>
          )}

          {/* Menu completo */}
          {visibleItems.map((item, idx) => {
            const isOculto = ocultosIds.has(item.id);
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${location.pathname === item.rota ? styles.active : ''} ${dragOverIdx === idx ? styles.navItemDragOver : ''} ${isOculto && editandoVisibilidade ? styles.navItemOculto : ''}`}
                onClick={() => !editandoOrdem && !editandoVisibilidade && handleNav(item.rota)}
                title={collapsed ? item.label : undefined}
                draggable={editandoOrdem}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              >
                {editandoOrdem && !collapsed && <GripVertical size={14} className={styles.dragHandle} />}
                <span className={styles.navIcon}>{item.icon}</span>
                {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                {/* Botão ocultar/mostrar no modo visibilidade */}
                {!collapsed && editandoVisibilidade && (
                  <button
                    className={styles.visBtn}
                    onClick={e => { e.stopPropagation(); toggleOculto(item.id); }}
                    title={isOculto ? 'Mostrar no menu' : 'Ocultar do menu'}
                  >
                    {isOculto
                      ? <EyeOff size={14} color="rgba(255,255,255,0.3)" />
                      : <Eye size={14} color="rgba(255,255,255,0.8)" />}
                  </button>
                )}
                {/* Botão favorito no modo normal */}
                {!collapsed && !editandoOrdem && !editandoVisibilidade && (
                  <button
                    className={styles.favBtn}
                    onClick={e => { e.stopPropagation(); toggleFavorito(item.id); }}
                    title={favoritosIds.has(item.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Star size={13} fill={favoritosIds.has(item.id) ? '#f59e0b' : 'none'} color={favoritosIds.has(item.id) ? '#f59e0b' : 'rgba(255,255,255,0.25)'} />
                  </button>
                )}
                {!collapsed && location.pathname === item.rota && <div className={styles.activeIndicator} />}
              </button>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {mostrarDica && !collapsed && !isMobileBarUser && (
        <div className={styles.dicaOverlay} onClick={fecharDica}>
          <div className={styles.dicaPopup} onClick={e => e.stopPropagation()}>
            <EyeOff size={28} color="#f57c00" />
            <p className={styles.dicaTexto}>
              Personalize seu menu! Clique em <strong>"Ocultar"</strong> na barra do menu para esconder funções que você não utiliza.
            </p>
            <label className={styles.dicaCheck}>
              <input type="checkbox" checked={naoMostrarMais} onChange={e => setNaoMostrarMais(e.target.checked)} />
              Não mostrar novamente
            </label>
            <button className={styles.dicaBtn} onClick={fecharDica}>Entendi</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
