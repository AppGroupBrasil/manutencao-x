import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, FileEdit, MessageSquarePlus, ClipboardList, Loader2 } from 'lucide-react';
import { portal } from '../../services/api';
import type { ResumoPortal } from '../../types';
import styles from './Portal.module.css';

interface Props {
  morador: { nome: string } | null;
}

const PortalDashboardPage: React.FC<Props> = ({ morador }) => {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<ResumoPortal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portal.resumo()
      .then(setResumo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.empty}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.welcome}>
        <h1>Olá, {morador?.nome?.split(' ')[0] || 'Morador'}!</h1>
        <p>Bem-vindo ao Portal do Morador — {resumo?.condominioNome || ''}</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.blue}`}>
            <Megaphone size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{resumo?.comunicadosTotal || 0}</h3>
            <p>Comunicados</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.yellow}`}>
            <ClipboardList size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{resumo?.solicitacoesTotal || 0}</h3>
            <p>Solicitações</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.purple}`}>
            <FileEdit size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{resumo?.solicitacoesAbertas || 0}</h3>
            <p>Em Aberto</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.green}`}>
            <FileEdit size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>{resumo?.solicitacoesResolvidas || 0}</h3>
            <p>Resolvidas</p>
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h2>Ações Rápidas</h2>
        <div className={styles.actionsGrid}>
          <button className={styles.actionBtn} onClick={() => navigate('/portal/solicitacoes?nova=1')}>
            <MessageSquarePlus size={20} />
            Nova Solicitação
          </button>
          <button className={styles.actionBtn} onClick={() => navigate('/portal/solicitacoes')}>
            <ClipboardList size={20} />
            Minhas Solicitações
          </button>
          <button className={styles.actionBtn} onClick={() => navigate('/portal/comunicados')}>
            <Megaphone size={20} />
            Ver Comunicados
          </button>
        </div>
      </div>
    </>
  );
};

export default PortalDashboardPage;
