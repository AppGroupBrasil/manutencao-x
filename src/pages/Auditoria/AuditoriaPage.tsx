import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import Pagination from '../../components/Common/Pagination';
import { audit as auditApi } from '../../services/api';
import { usePagination } from '../../hooks/usePagination';
import {
  Shield, Activity, Building2, Users, Calendar,
  Search, Filter, TrendingUp, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './Auditoria.module.css';

interface AuditLog {
  id: number;
  usuario_nome: string;
  usuario_email: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes: any;
  ip: string;
  criado_em: string;
}

interface MetricaCondominio {
  condominio_id: string;
  condominio_nome: string;
  total_acoes: number;
}

const AuditoriaPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metricas, setMetricas] = useState<{ porCondominio: MetricaCondominio[]; loginsDiarios: any[] }>({ porCondominio: [], loginsDiarios: [] });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('todos');

  const carregar = useCallback(async () => {
    try {
      const [logsData, metricasData] = await Promise.all([
        auditApi.list(1, 500),
        auditApi.metrics(),
      ]);
      setLogs(logsData.logs || logsData || []);
      setMetricas(metricasData || { porCondominio: [], loginsDiarios: [] });
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const acoes = [...new Set(logs.map(l => l.acao))].sort();

  const logsFiltrados = logs.filter(l => {
    if (filtroAcao !== 'todos' && l.acao !== filtroAcao) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      return (l.usuario_nome || '').toLowerCase().includes(q)
        || (l.usuario_email || '').toLowerCase().includes(q)
        || (l.acao || '').toLowerCase().includes(q)
        || (l.entidade || '').toLowerCase().includes(q);
    }
    return true;
  });

  const pag = usePagination(logsFiltrados, { pageSize: 25 });

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const acaoLabel: Record<string, { texto: string; cor: string }> = {
    login: { texto: 'Login', cor: '#1a73e8' },
    'alteracao-status': { texto: 'Status Alterado', cor: '#f57c00' },
    'alteracao-perfil': { texto: 'Perfil Alterado', cor: '#00897b' },
    'alteracao-senha': { texto: 'Senha Alterada', cor: '#7b1fa2' },
    'alteracao-avatar': { texto: 'Avatar Alterado', cor: '#303f9f' },
  };

  if (loading) return <LoadingSpinner texto="Carregando auditoria..." />;

  return (
    <div>
      <PageHeader
        titulo="Auditoria & Métricas"
        subtitulo={`${logs.length} registros de auditoria`}
      />

      {/* Métricas */}
      <div className={styles.statsGrid}>
        <Card padding="md" hover>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#1a73e815', color: '#1a73e8' }}>
              <Shield size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValor}>{logs.length}</span>
              <span className={styles.statLabel}>Total Registros</span>
            </div>
          </div>
        </Card>
        <Card padding="md" hover>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#00897b15', color: '#00897b' }}>
              <Activity size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValor}>{logs.filter(l => l.acao === 'login').length}</span>
              <span className={styles.statLabel}>Logins</span>
            </div>
          </div>
        </Card>
        <Card padding="md" hover>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#7b1fa215', color: '#7b1fa2' }}>
              <Building2 size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValor}>{metricas.porCondominio?.length || 0}</span>
              <span className={styles.statLabel}>Condomínios Ativos</span>
            </div>
          </div>
        </Card>
        <Card padding="md" hover>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#f57c0015', color: '#f57c00' }}>
              <Users size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValor}>{new Set(logs.map(l => l.usuario_email)).size}</span>
              <span className={styles.statLabel}>Usuários Únicos</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className={styles.chartsRow}>
        {(metricas.porCondominio || []).length > 0 && (
          <Card padding="md">
            <h3 className={styles.chartTitle}><TrendingUp size={16} /> Uso por Condomínio (30 dias)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metricas.porCondominio.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis dataKey="condominio_nome" stroke="var(--cor-texto-secundario)" fontSize={11} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
                <Bar dataKey="total_acoes" fill="var(--cor-primaria)" radius={[4, 4, 0, 0]} name="Ações" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {(metricas.loginsDiarios || []).length > 0 && (
          <Card padding="md">
            <h3 className={styles.chartTitle}><BarChart3 size={16} /> Logins Diários (30 dias)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metricas.loginsDiarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis dataKey="dia" stroke="var(--cor-texto-secundario)" fontSize={11} />
                <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
                <Bar dataKey="total" fill="#00897b" radius={[4, 4, 0, 0]} name="Logins" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Filtros */}
      <Card padding="md">
        <div className={styles.filtros}>
          <div className={styles.filtroSearch}>
            <Search size={16} />
            <input
              className={styles.filtroInput}
              placeholder="Buscar por usuário, ação, entidade..."
              value={busca}
              onChange={e => { setBusca(e.target.value); pag.resetPage(); }}
            />
          </div>
          <div className={styles.filtroSelect}>
            <Filter size={14} />
            <select value={filtroAcao} onChange={e => { setFiltroAcao(e.target.value); pag.resetPage(); }}>
              <option value="todos">Todas as ações</option>
              {acoes.map(a => <option key={a} value={a}>{acaoLabel[a]?.texto || a}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Tabela de Logs */}
      <Card padding="md" style={{ marginTop: 16 }}>
        <h3 className={styles.chartTitle}><Shield size={16} /> Logs de Auditoria</h3>
        {logsFiltrados.length === 0 ? (
          <EmptyState
            icon={<Shield size={48} strokeWidth={1.5} />}
            titulo="Nenhum registro encontrado"
            descricao="O logs de auditoria aparecerão aqui conforme os usuários interagem com o sistema."
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Entidade</th>
                    <th>IP</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {pag.items.map(log => {
                    const info = acaoLabel[log.acao] || { texto: log.acao, cor: '#9e9e9e' };
                    return (
                      <tr key={log.id}>
                        <td className={styles.cellDate}>{formatDate(log.criado_em)}</td>
                        <td>
                          <div className={styles.cellUser}>
                            <strong>{log.usuario_nome}</strong>
                            <span>{log.usuario_email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.acaoBadge} style={{ background: info.cor + '15', color: info.cor }}>
                            {info.texto}
                          </span>
                        </td>
                        <td>{log.entidade || '—'}{log.entidade_id ? ` #${log.entidade_id}` : ''}</td>
                        <td className={styles.cellIp}>{log.ip || '—'}</td>
                        <td className={styles.cellDetalhes}>
                          {log.detalhes ? JSON.stringify(log.detalhes).slice(0, 60) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pag.page}
              totalPages={pag.totalPages}
              totalItems={pag.totalItems}
              pageSize={pag.pageSize}
              onPageChange={pag.goToPage}
              hasNext={pag.hasNext}
              hasPrev={pag.hasPrev}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default AuditoriaPage;
