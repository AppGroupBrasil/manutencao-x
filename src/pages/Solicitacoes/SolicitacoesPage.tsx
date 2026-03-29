import React, { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, AlertCircle, Inbox,
  Eye, ArrowRightLeft, MessageSquare, Loader2, Search
} from 'lucide-react';
import { solicitacoes as solApi } from '../../services/api';
import type { SolicitacaoMorador, ResumoSolicitacoes, StatusSolicitacao } from '../../types';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import styles from './SolicitacoesPage.module.css';

const STATUS_OPT: { value: StatusSolicitacao | ''; label: string }[] = [
  { value: '', label: 'Todos os Status' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'resolvida', label: 'Resolvida' },
  { value: 'cancelada', label: 'Cancelada' },
];

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_analise: 'Em Análise', em_andamento: 'Em Andamento',
  resolvida: 'Resolvida', cancelada: 'Cancelada',
};

const TIPO_LABEL: Record<string, string> = {
  manutencao: 'Manutenção', reclamacao: 'Reclamação', sugestao: 'Sugestão',
  informacao: 'Informação', reserva: 'Reserva',
};

const SolicitacoesPage: React.FC = () => {
  const [lista, setLista] = useState<SolicitacaoMorador[]>([]);
  const [resumo, setResumo] = useState<ResumoSolicitacoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [selecionada, setSelecionada] = useState<SolicitacaoMorador | null>(null);
  const [respForm, setRespForm] = useState({ status: '', resposta: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true);
    Promise.all([solApi.list(), solApi.resumo()])
      .then(([l, r]) => { setLista(l); setResumo(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    let r = lista;
    if (filtroStatus) r = r.filter(s => s.status === filtroStatus);
    if (busca) {
      const t = busca.toLowerCase();
      r = r.filter(s =>
        s.titulo.toLowerCase().includes(t) ||
        s.protocolo.toLowerCase().includes(t) ||
        (s.moradorNome || '').toLowerCase().includes(t) ||
        (s.condominioNome || '').toLowerCase().includes(t)
      );
    }
    return r;
  }, [lista, busca, filtroStatus]);

  const pag = usePagination(filtrados, { pageSize: 15 });

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const abrirDetalhe = (s: SolicitacaoMorador) => {
    setSelecionada(s);
    setRespForm({ status: s.status, resposta: s.resposta || '' });
  };

  const handleResponder = async () => {
    if (!selecionada || !respForm.status) return;
    setSalvando(true);
    try {
      await solApi.responder(selecionada.id, { status: respForm.status, resposta: respForm.resposta });
      setSelecionada(null);
      carregar();
    } catch {
      alert('Erro ao responder');
    } finally {
      setSalvando(false);
    }
  };

  const handleConverterOS = async (s: SolicitacaoMorador) => {
    if (!confirm(`Converter "${s.titulo}" em Ordem de Serviço?`)) return;
    try {
      await solApi.converterOS(s.id);
      carregar();
      setSelecionada(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao converter');
    }
  };

  if (loading) {
    return (
      <Card>
        <div className={styles.empty}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Carregando solicitações...</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader titulo="Solicitações dos Moradores" subtitulo="Gerencie as solicitações recebidas pelo portal" />

      {/* Resumo */}
      <div className={styles.resumoGrid}>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.blue}`}><ClipboardList size={20} /></div>
          <div className={styles.resumoInfo}><h3>{resumo?.total || 0}</h3><p>Total</p></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.yellow}`}><AlertCircle size={20} /></div>
          <div className={styles.resumoInfo}><h3>{resumo?.abertas || 0}</h3><p>Abertas</p></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.purple}`}><Clock size={20} /></div>
          <div className={styles.resumoInfo}><h3>{resumo?.emAndamento || 0}</h3><p>Em Andamento</p></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.green}`}><CheckCircle2 size={20} /></div>
          <div className={styles.resumoInfo}><h3>{resumo?.resolvidas || 0}</h3><p>Resolvidas</p></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          placeholder="Buscar por título, protocolo, morador, condomínio..."
          value={busca}
          onChange={e => { setBusca(e.target.value); pag.resetPage(); }}
        />
        <select value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); pag.resetPage(); }}>
          {STATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <Card>
          <div className={styles.empty}>
            <Inbox size={48} />
            <h3>Nenhuma solicitação encontrada</h3>
            <p>As solicitações dos moradores aparecerão aqui.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Morador</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pag.items.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.protocolo}</td>
                    <td>
                      <div className={styles.moradorInfo}>
                        <strong>{s.moradorNome || '-'}</strong>
                        <small>{s.bloco && `Bl. ${s.bloco}`}{s.apartamento && ` Ap. ${s.apartamento}`} — {s.condominioNome || ''}</small>
                      </div>
                    </td>
                    <td>{s.titulo}</td>
                    <td><span className={styles.badgeTipo}>{TIPO_LABEL[s.tipo] || s.tipo}</span></td>
                    <td><span className={`${styles.badge} ${styles[s.status]}`}>{STATUS_LABEL[s.status] || s.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.criadoEm)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Ver / Responder" onClick={() => abrirDetalhe(s)}>
                          <Eye size={14} />
                        </button>
                        {!s.ordemServicoId && s.status !== 'cancelada' && s.status !== 'resolvida' && (
                          <button className={`${styles.actionBtn} ${styles.converter}`} title="Converter em OS" onClick={() => handleConverterOS(s)}>
                            <ArrowRightLeft size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pag.totalPages > 1 && (
            <div style={{ marginTop: 16 }}>
              <Pagination
                page={pag.page}
                totalPages={pag.totalPages}
                totalItems={pag.totalItems}
                pageSize={pag.pageSize}
                onPageChange={pag.goToPage}
                hasNext={pag.hasNext}
                hasPrev={pag.hasPrev}
              />
            </div>
          )}
        </>
      )}

      {/* Modal Detalhe / Responder */}
      {selecionada && (
        <div className={styles.modalOverlay} onClick={() => setSelecionada(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{selecionada.titulo}</h2>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <label>Protocolo</label>
                <span>{selecionada.protocolo}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Data</label>
                <span>{formatDate(selecionada.criadoEm)}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Morador</label>
                <span>{selecionada.moradorNome}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Condomínio</label>
                <span>{selecionada.condominioNome}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Endereço</label>
                <span>{selecionada.bloco && `Bl. ${selecionada.bloco}`}{selecionada.apartamento && ` Ap. ${selecionada.apartamento}`}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Tipo</label>
                <span>{TIPO_LABEL[selecionada.tipo] || selecionada.tipo}</span>
              </div>
              {selecionada.local && (
                <div className={styles.detailItem}>
                  <label>Local</label>
                  <span>{selecionada.local}</span>
                </div>
              )}
              {selecionada.moradorEmail && (
                <div className={styles.detailItem}>
                  <label>E-mail</label>
                  <span>{selecionada.moradorEmail}</span>
                </div>
              )}
            </div>

            {selecionada.descricao && (
              <div className={styles.descricaoBox}>{selecionada.descricao}</div>
            )}

            {selecionada.ordemServicoId && (
              <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.1)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#8b5cf6', fontWeight: 600 }}>
                Convertida em Ordem de Serviço
              </div>
            )}

            <div className={styles.responderForm}>
              <label style={{ fontWeight: 600, fontSize: 14, color: 'var(--cor-texto)' }}>
                <MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Responder / Atualizar Status
              </label>
              <select value={respForm.status} onChange={e => setRespForm({ ...respForm, status: e.target.value })}>
                {STATUS_OPT.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <textarea
                value={respForm.resposta}
                onChange={e => setRespForm({ ...respForm, resposta: e.target.value })}
                placeholder="Resposta para o morador (opcional)..."
              />
            </div>

            <div className={styles.modalActions}>
              {!selecionada.ordemServicoId && selecionada.status !== 'cancelada' && selecionada.status !== 'resolvida' && (
                <button className={styles.btnPrimary} style={{ background: '#8b5cf6' }} onClick={() => handleConverterOS(selecionada)}>
                  <ArrowRightLeft size={14} /> Converter em OS
                </button>
              )}
              <button className={styles.btnSecondary} onClick={() => setSelecionada(null)}>Fechar</button>
              <button className={styles.btnPrimary} onClick={handleResponder} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Resposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SolicitacoesPage;
