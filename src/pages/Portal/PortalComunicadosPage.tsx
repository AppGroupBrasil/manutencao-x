import React, { useEffect, useState } from 'react';
import { Loader2, Megaphone, Inbox } from 'lucide-react';
import { portal } from '../../services/api';
import styles from './Portal.module.css';

const TIPO_LABEL: Record<string, string> = {
  comunicado: 'Comunicado',
  aviso: 'Aviso',
};

const PortalComunicadosPage: React.FC = () => {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portal.comunicados()
      .then(setLista)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return d; }
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
        <h1>Comunicados</h1>
      </div>

      {lista.length === 0 ? (
        <div className={styles.empty}>
          <Inbox size={48} />
          <h3>Nenhum comunicado</h3>
          <p>Os comunicados do seu condomínio aparecerão aqui.</p>
        </div>
      ) : (
        <div className={styles.comunicadosList}>
          {lista.map(c => (
            <div key={c.id} className={styles.comunicadoCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Megaphone size={16} style={{ color: 'var(--cor-primaria)' }} />
                <span className={`${styles.badge} ${c.tipo === 'aviso' ? styles.informacao : styles.manutencao}`}>
                  {TIPO_LABEL[c.tipo] || c.tipo}
                </span>
              </div>
              <h3>{c.titulo}</h3>
              {c.mensagem && <p className={styles.msg}>{c.mensagem}</p>}
              <span className={styles.date}>{formatDate(c.criadoEm)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default PortalComunicadosPage;
