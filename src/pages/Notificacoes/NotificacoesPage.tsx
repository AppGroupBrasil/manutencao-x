import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { notificacoes as notificacoesApi } from '../../services/api';
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import styles from './Notificacoes.module.css';

interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link?: string;
  criado_em: string;
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  info: <Info size={18} />,
  aviso: <AlertTriangle size={18} />,
  sucesso: <CheckCircle size={18} />,
};
const TIPO_COR: Record<string, string> = {
  info: '#1a73e8',
  aviso: '#f57c00',
  sucesso: '#00897b',
};

const NotificacoesPage: React.FC = () => {
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    notificacoesApi.list().then((data: any) => setLista(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarLida = async (id: number) => {
    await notificacoesApi.markRead(String(id));
    setLista(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const marcarTodasLidas = async () => {
    await notificacoesApi.markAllRead();
    setLista(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const remover = async (id: number) => {
    await notificacoesApi.remove(String(id));
    setLista(prev => prev.filter(n => n.id !== id));
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const agora = new Date();
    const diffMs = agora.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const naoLidas = lista.filter(n => !n.lida).length;

  return (
    <div>
      <PageHeader
        titulo="Notificações"
        subtitulo={naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo em dia'}
      />

      {naoLidas > 0 && (
        <div className={styles.actions}>
          <button className={styles.btnMarcarTodas} onClick={marcarTodasLidas}>
            <CheckCheck size={16} /> Marcar todas como lidas
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--cor-texto-secundario)' }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <Card padding="lg">
          <div className={styles.empty}>
            <Bell size={48} strokeWidth={1.5} />
            <h3>Nenhuma notificação</h3>
            <p>Você será notificado sobre eventos importantes do sistema.</p>
          </div>
        </Card>
      ) : (
        <div className={styles.lista}>
          {lista.map(n => (
            <div key={n.id} className={`${styles.item} ${!n.lida ? styles.itemNaoLida : ''}`}>
              <div className={styles.itemIcon} style={{ color: TIPO_COR[n.tipo] || TIPO_COR.info, background: `${TIPO_COR[n.tipo] || TIPO_COR.info}15` }}>
                {TIPO_ICON[n.tipo] || TIPO_ICON.info}
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <strong className={styles.itemTitulo}>{n.titulo}</strong>
                  <span className={styles.itemTime}>{formatDate(n.criado_em)}</span>
                </div>
                <p className={styles.itemMsg}>{n.mensagem}</p>
              </div>
              <div className={styles.itemActions}>
                {!n.lida && (
                  <button className={styles.itemBtn} onClick={() => marcarLida(n.id)} title="Marcar como lida">
                    <Check size={16} />
                  </button>
                )}
                <button className={styles.itemBtn} onClick={() => remover(n.id)} title="Remover">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificacoesPage;
