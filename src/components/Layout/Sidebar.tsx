import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import {
  LogOut, ChevronLeft, ChevronRight, Menu, Eye, GripVertical, RotateCcw, Bell, User, Star, EyeOff
} from 'lucide-react';
import styles from './Sidebar.module.css';
import logoImg from '../../assets/logo.png';
import { notificacoes as notificacoesApi } from '../../services/api';
import { safeStorage } from '../../utils/storage';
import MobileMenuGrid from './MobileMenuGrid';
import { menuCatalog, renderMenuIcon, type MenuConfigItem } from './menuCatalog';

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
  ...menuCatalog.filter(item => item.hiddenByDefault).map(item => item.id),
]);

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => globalThis.innerWidth <= 768);
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

  useEffect(() => {
    const handleResize = () => {
      const mobile = globalThis.innerWidth <= 768;
      setIsMobileViewport(mobile);
      if (mobile) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    };

    globalThis.addEventListener('resize', handleResize);
    return () => globalThis.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setMobileOpen(false);
    }
  }, [isMobileViewport, location.pathname]);

  const filteredItems = useMemo(() => {
    const base = menuCatalog.filter(item => roleNivel >= item.minRole && podeVer(item.id));
    if (ordemIds.length === 0) return base;
    const mapa = new Map(base.map(item => [item.id, item]));
    const ordenados: MenuConfigItem[] = [];
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

  const salvarOrdem = useCallback((items: MenuConfigItem[]) => {
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

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
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
        <div className={styles.topBar} style={{ background: 'linear-gradient(180deg, #1e1e3a 0%, #141428 100%)' }}>
          <div className={styles.topBarHeader}>
            <div className={styles.topBarBrand}>
              <button className={styles.topBarMenu} onClick={() => setMobileOpen(v => !v)}>
                <Menu size={18} />
              </button>
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

      {isMobileBarUser && (
        <div className={`${styles.topBarDrawer} ${mobileOpen ? styles.topBarDrawerOpen : ''}`} style={{ background: 'linear-gradient(180deg, #141428 0%, #0f0f22 100%)' }}>
          <MobileMenuGrid
            items={visibleItems}
            favoritosIds={favoritosIds}
            currentPath={location.pathname}
            onNavigate={handleNav}
            onToggleFavorite={toggleFavorito}
          />
          <div className={styles.mobileFooter}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={20} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}

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

        <div className={styles.desktopContent}>
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

            {favoritoItems.length > 0 && !editandoOrdem && (
              <>
                {!collapsed && <div className={styles.favSection}>★ Favoritos</div>}
                {favoritoItems.map(item => (
                  <div
                    key={`fav-${item.id}`}
                    className={`${styles.navItem} ${styles.navItemFav} ${location.pathname === item.rota ? styles.active : ''}`}
                    onClick={() => handleNav(item.rota)}
                    onKeyDown={event => handleItemKeyDown(event, () => handleNav(item.rota))}
                    title={collapsed ? `★ ${item.label}` : undefined}
                    role="button"
                    tabIndex={0}
                  >
                    <span className={styles.navIcon}>{renderMenuIcon(item.icon, 20)}</span>
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
                  </div>
                ))}
                {!collapsed && <div className={styles.favDivider} />}
              </>
            )}

            {visibleItems.map((item, idx) => {
              const isOculto = ocultosIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`${styles.navItem} ${location.pathname === item.rota ? styles.active : ''} ${dragOverIdx === idx ? styles.navItemDragOver : ''} ${isOculto && editandoVisibilidade ? styles.navItemOculto : ''}`}
                  onClick={() => !editandoOrdem && !editandoVisibilidade && handleNav(item.rota)}
                  onKeyDown={event => handleItemKeyDown(event, () => {
                    if (!editandoOrdem && !editandoVisibilidade) handleNav(item.rota);
                  })}
                  title={collapsed ? item.label : undefined}
                  role="button"
                  tabIndex={0}
                  draggable={editandoOrdem}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  {editandoOrdem && !collapsed && <GripVertical size={14} className={styles.dragHandle} />}
                  <span className={styles.navIcon}>{renderMenuIcon(item.icon, 20)}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
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
                </div>
              );
            })}
          </nav>

          <div className={styles.footer}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={20} />
              {!collapsed && <span>Sair</span>}
            </button>
          </div>
        </div>

        <div className={styles.mobileGridWrapper}>
          <MobileMenuGrid
            items={visibleItems}
            favoritosIds={favoritosIds}
            currentPath={location.pathname}
            onNavigate={handleNav}
            onToggleFavorite={toggleFavorito}
          />
          <div className={styles.mobileFooter}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={20} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {mostrarDica && !collapsed && !isMobileBarUser && !isMobileViewport && (
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
