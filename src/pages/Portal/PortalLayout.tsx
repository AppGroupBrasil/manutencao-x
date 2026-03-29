import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, FileEdit, User, LogOut, Menu, Building2
} from 'lucide-react';
import styles from './Portal.module.css';

interface PortalLayoutProps {
  morador: { nome: string; condominioNome?: string } | null;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Início', icon: <LayoutDashboard size={18} />, path: '/portal' },
  { id: 'solicitacoes', label: 'Minhas Solicitações', icon: <FileEdit size={18} />, path: '/portal/solicitacoes' },
  { id: 'comunicados', label: 'Comunicados', icon: <Megaphone size={18} />, path: '/portal/comunicados' },
  { id: 'perfil', label: 'Meu Perfil', icon: <User size={18} />, path: '/portal/perfil' },
];

const PortalLayout: React.FC<PortalLayoutProps> = ({ morador, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.portalLayout}>
      <button className={styles.portalMobileToggle} onClick={() => setMobileOpen(!mobileOpen)}>
        <Menu size={20} />
      </button>

      <aside className={`${styles.portalSidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.portalSidebarHeader}>
          <h2><Building2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Portal do Morador</h2>
          <p>{morador?.condominioNome || 'Carregando...'}</p>
        </div>

        <nav className={styles.portalNav}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`${styles.portalNavItem} ${
                item.path === '/portal'
                  ? location.pathname === '/portal' ? styles.active : ''
                  : location.pathname.startsWith(item.path) ? styles.active : ''
              }`}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.portalSidebarFooter}>
          <p style={{ fontSize: 13, color: 'var(--cor-texto)', fontWeight: 600, margin: '0 0 8px' }}>
            {morador?.nome || ''}
          </p>
          <button className={styles.portalLogout} onClick={onLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className={styles.portalContent}>
        <Outlet />
      </main>
    </div>
  );
};

export default PortalLayout;
