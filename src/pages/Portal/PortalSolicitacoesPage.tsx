import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Loader2, FileEdit, Calendar, MapPin, Inbox
} from 'lucide-react';
import { portal } from '../../services/api';
import type { SolicitacaoMorador, TipoSolicitacao } from '../../types';
import styles from './Portal.module.css';

const TIPOS: { value: TipoSolicitacao; label: string }[] = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'informacao', label: 'Informação' },
  { value: 'reserva', label: 'Reserva' },
];

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Análise',
  em_andamento: 'Em Andamento',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
};

const PortalSolicitacoesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lista, setLista] = useState<SolicitacaoMorador[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberta, setModalAberta] = useState(searchParams.get('nova') === '1');
  const [detalhe, setDetalhe] = useState<SolicitacaoMorador | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    tipo: 'manutencao' as TipoSolicitacao,
    titulo: '',
    descricao: '',
    local: '',
  });

  const carregar = () => {
    setLoading(true);
    portal.solicitacoes()
      .then(setLista)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSalvando(true);
    try {
      await portal.criarSolicitacao(form);
      setModalAberta(false);
      setForm({ tipo: 'manutencao', titulo: '', descricao: '', local: '' });
      setSearchParams({});
      carregar();
    } catch {
      alert('Erro ao criar solicitação');
    } finally {
      setSalvando(false);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Minhas Solicitações</h1>
        <button className={styles.btnPrimary} onClick={() => setModalAberta(true)}>
          <Plus size={16} /> Nova Solicitação
        </button>
      </div>

      {loading ? (
        <div className={styles.empty}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : lista.length === 0 ? (
        <div className={styles.empty}>
          <Inbox size={48} />
          <h3>Nenhuma solicitação</h3>
          <p>Crie sua primeira solicitação clicando no botão acima.</p>
        </div>
      ) : (
        <div className={styles.solicitacaoList}>
          {lista.map(s => (
            <div key={s.id} className={styles.solicitacaoCard} onClick={() => setDetalhe(s)}>
              <div className={styles.solicitacaoHeader}>
                <h3>{s.titulo}</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className={`${styles.badge} ${styles[s.tipo]}`}>
                    {TIPOS.find(t => t.value === s.tipo)?.label || s.tipo}
                  </span>
                  <span className={`${styles.badge} ${styles[s.status]}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </div>
              </div>
              <div className={styles.solicitacaoMeta}>
                <span><FileEdit size={12} /> {s.protocolo}</span>
                <span><Calendar size={12} /> {formatDate(s.criadoEm)}</span>
                {s.local && <span><MapPin size={12} /> {s.local}</span>}
              </div>
              {s.descricao && <p className={styles.solicitacaoDesc}>{s.descricao}</p>}
              {s.resposta && (
                <div className={styles.respostaBox}>
                  <h4>Resposta — {s.respondidoPorNome || 'Equipe'}</h4>
                  <p>{s.resposta}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Solicitação */}
      {modalAberta && (
        <div className={styles.modalOverlay} onClick={() => setModalAberta(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>Nova Solicitação</h2>
            <form className={styles.loginForm} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm({ ...form, tipo: e.target.value as TipoSolicitacao })}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid var(--cor-borda)',
                    borderRadius: 8, fontSize: 14, background: 'var(--cor-fundo)', color: 'var(--cor-texto)', boxSizing: 'border-box'
                  }}
                >
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Título *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Resumo da solicitação"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descreva em detalhes..."
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid var(--cor-borda)',
                    borderRadius: 8, fontSize: 14, background: 'var(--cor-fundo)', color: 'var(--cor-texto)',
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Local</label>
                <input
                  value={form.local}
                  onChange={e => setForm({ ...form, local: e.target.value })}
                  placeholder="Ex: Área de lazer, Hall bloco A..."
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalAberta(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                  {salvando ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhe */}
      {detalhe && (
        <div className={styles.modalOverlay} onClick={() => setDetalhe(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{detalhe.titulo}</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span className={`${styles.badge} ${styles[detalhe.tipo]}`}>
                {TIPOS.find(t => t.value === detalhe.tipo)?.label || detalhe.tipo}
              </span>
              <span className={`${styles.badge} ${styles[detalhe.status]}`}>
                {STATUS_LABEL[detalhe.status] || detalhe.status}
              </span>
            </div>
            <div className={styles.solicitacaoMeta} style={{ marginBottom: 16 }}>
              <span><FileEdit size={12} /> {detalhe.protocolo}</span>
              <span><Calendar size={12} /> {formatDate(detalhe.criadoEm)}</span>
              {detalhe.local && <span><MapPin size={12} /> {detalhe.local}</span>}
            </div>
            {detalhe.descricao && (
              <p style={{ fontSize: 14, color: 'var(--cor-texto)', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {detalhe.descricao}
              </p>
            )}
            {detalhe.resposta && (
              <div className={styles.respostaBox}>
                <h4>Resposta — {detalhe.respondidoPorNome || 'Equipe'}</h4>
                <p>{detalhe.resposta}</p>
                {detalhe.respondidoEm && (
                  <p style={{ fontSize: 11, color: 'var(--cor-texto-secundario)', marginTop: 4 }}>
                    {formatDate(detalhe.respondidoEm)}
                  </p>
                )}
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PortalSolicitacoesPage;
