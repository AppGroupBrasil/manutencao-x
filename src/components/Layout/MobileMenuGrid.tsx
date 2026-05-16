import React, { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import styles from './MobileMenuGrid.module.css';
import { GROUP_LABELS, renderMenuIcon, type MenuConfigItem, type MenuGroup } from './menuCatalog';

interface MobileMenuGridProps {
  items: MenuConfigItem[];
  favoritosIds: Set<string>;
  currentPath: string;
  onNavigate: (route: string) => void;
  onToggleFavorite?: (id: string) => void;
  showDashboardBar?: boolean;
  tone?: 'dark' | 'light';
}

const groupOrder: MenuGroup[] = ['operacao', 'campo', 'gestao', 'planejamento', 'apoio'];

const MobileMenuGrid: React.FC<MobileMenuGridProps> = ({
  items,
  favoritosIds,
  currentPath,
  onNavigate,
  onToggleFavorite,
  showDashboardBar = true,
  tone = 'dark',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items;

    return items.filter(item => {
      const label = item.label.toLowerCase();
      const mobileLabel = item.mobileLabel.toLowerCase();
      return label.includes(normalizedSearch) || mobileLabel.includes(normalizedSearch);
    });
  }, [items, normalizedSearch]);

  const dashboardItem = useMemo(
    () => filteredItems.find(item => item.id === 'dashboard') ?? null,
    [filteredItems],
  );

  const gridItems = useMemo(
    () => filteredItems.filter(item => item.id !== 'dashboard'),
    [filteredItems],
  );

  const favoriteItems = useMemo(
    () => gridItems.filter(item => favoritosIds.has(item.id)),
    [gridItems, favoritosIds],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<MenuGroup, MenuConfigItem[]>();

    for (const group of groupOrder) {
      groups.set(group, []);
    }

    for (const item of gridItems) {
      groups.get(item.group)?.push(item);
    }

    return groups;
  }, [gridItems]);

  const renderCard = (item: MenuConfigItem) => {
    const isFavorite = favoritosIds.has(item.id);
    const isActive = currentPath === item.rota;

    return (
      <div
        key={item.id}
        className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
        onClick={() => onNavigate(item.rota)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNavigate(item.rota);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {onToggleFavorite && (
          <button
            type="button"
            className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ''}`}
            onClick={event => {
              event.stopPropagation();
              onToggleFavorite(item.id);
            }}
            title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <span className={styles.cardIcon}>{renderMenuIcon(item.icon, 22)}</span>
        <span className={styles.cardLabel}>{item.mobileLabel}</span>
      </div>
    );
  };

  return (
    <div className={`${styles.wrapper} ${tone === 'light' ? styles.wrapperLight : ''}`}>
      <label className={styles.searchBox}>
        <Search size={16} />
        <input
          type="search"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          placeholder="Buscar módulo"
        />
      </label>

      {showDashboardBar && dashboardItem && (
        <button
          type="button"
          className={`${styles.dashboardBar} ${currentPath === dashboardItem.rota ? styles.dashboardBarActive : ''}`}
          onClick={() => onNavigate(dashboardItem.rota)}
        >
          <span className={styles.dashboardBarIcon}>{renderMenuIcon(dashboardItem.icon, 20)}</span>
          <span className={styles.dashboardBarContent}>
            <span className={styles.dashboardBarTitle}>Dashboard</span>
            <span className={styles.dashboardBarSubtitle}>Ir para a visão geral da plataforma</span>
          </span>
        </button>
      )}

      {favoriteItems.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Favoritos</h3>
            <span className={styles.sectionCount}>{favoriteItems.length}</span>
          </div>
          <div className={styles.grid}>{favoriteItems.map(renderCard)}</div>
        </section>
      )}

      {groupOrder.map(group => {
        const groupItems = groupedItems.get(group) ?? [];
        if (groupItems.length === 0) return null;

        return (
          <section key={group} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{GROUP_LABELS[group]}</h3>
              <span className={styles.sectionCount}>{groupItems.length}</span>
            </div>
            <div className={styles.grid}>{groupItems.map(renderCard)}</div>
          </section>
        );
      })}

      {gridItems.length === 0 && !dashboardItem && (
        <p className={styles.emptyState}>Nenhum módulo encontrado para essa busca.</p>
      )}
    </div>
  );
};

export default MobileMenuGrid;
