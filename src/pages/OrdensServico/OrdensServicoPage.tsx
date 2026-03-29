import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '../../contexts/PermissionsContext';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import Pagination from '../../components/Common/Pagination';
import StatusBadge, { statusOSBadge, prioridadeBadge } from '../../components/Common/StatusBadge';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { formatarDataHora } from '../../utils/dateUtils';
import { usePagination } from '../../hooks/usePagination';
import type { OrdemServico, StatusOS } from '../../types';
import { Plus, Search, MapPin, Calendar, Wrench, AlertTriangle, X, Hash } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { ordensServico as osApi, condominios as condominiosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './OrdensServico.module.css';

interface OSComProtocolo extends OrdemServico {
  protocolo: string;
}

const STATUS_OPTIONS: { value: StatusOS; label: string }[] = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const tipoIcon: Record<string, React.ReactNode> = {
  limpeza: <span style={{ color: '#00897b' }}>🧹</span>,
  manutencao: <Wrench size={16} color="#1a73e8" />,
  emergencia: <AlertTriangle size={16} color="#d32f2f" />,
  preventiva: <Calendar size={16} color="#f57c00" />,
};

const OrdensServicoPage: React.FC = () => {
  const { podeCriar, podeEditar } = usePermissions();
  const { tentarAcao } = useDemo();
  const [ordens, setOrdens] = useState<OSComProtocolo[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalNova, setModalNova] = useState(false);

  useEffect(() => {
    Promise.all([osApi.list(), condominiosApi.list()])
      .then(([rows, conds]) => {
        setOrdens(rows.map((r: any) => ({
          id: r.id,
          protocolo: r.protocolo,
          condominioId: r.condominioId,
          titulo: r.titulo,
          descricao: r.descricao || '',
          tipo: r.tipo,
          prioridade: r.prioridade,
          status: r.status,
          local: r.local || '',
          responsavelId: r.responsavelId,
          supervisorId: r.supervisorId,
          fotos: r.fotos || [],
          observacoes: r.observacoes || '',
          dataAbertura: r.dataAbertura ? new Date(r.dataAbertura).getTime() : Date.now(),
          dataPrevisao: r.dataPrevisao ? new Date(r.dataPrevisao).getTime() : undefined,
          dataConclusao: r.dataConclusao ? new Date(r.dataConclusao).getTime() : undefined,
          criadoPor: r.criadoPor,
          avaliacaoNota: r.avaliacaoNota,
          avaliacaoComentario: r.avaliacaoComentario,
        })));
        setCondominiosList(conds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Form nova OS
  const [novaTitulo, setNovaTitulo] = useState('');
  const [novaDesc, setNovaDesc] = useState('');
  const [novaTipo, setNovaTipo] = useState<'limpeza' | 'manutencao' | 'emergencia' | 'preventiva'>('limpeza');
  const [novaPrioridade, setNovaPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [novaCond, setNovaCond] = useState('c1');
  const [novaLocal, setNovaLocal] = useState('');

  const filtered = useMemo(() => {
    return ordens.filter(os => {
      if (filtroStatus !== 'todos' && os.status !== filtroStatus) return false;
      if (busca.trim()) {
        const termos = busca.toLowerCase().split(/\s+/);
        const texto = `${os.titulo} ${os.descricao} ${os.protocolo} ${os.id} ${os.local} ${os.tipo} ${os.prioridade} ${os.observacoes}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      }
      return true;
    });
  }, [ordens, filtroStatus, busca]);

  const pag = usePagination(filtered, { pageSize: 15 });

  const chartData = useMemo(() => [
    { status: 'Abertas', total: ordens.filter(o => o.status === 'aberta').length },
    { status: 'Em Andamento', total: ordens.filter(o => o.status === 'em_andamento').length },
    { status: 'Aguardando', total: ordens.filter(o => o.status === 'aguardando').length },
    { status: 'Concluídas', total: ordens.filter(o => o.status === 'concluida').length },
    { status: 'Canceladas', total: ordens.filter(o => o.status === 'cancelada').length },
  ], [ordens]);

  const atualizarStatus = async (id: string, novoStatus: StatusOS) => {
    if (!tentarAcao()) return;
    try { await osApi.updateStatus(id, novoStatus); } catch { alert('Erro ao atualizar'); }
    setOrdens(prev => prev.map(os => os.id === id ? {
      ...os,
      status: novoStatus,
      ...(novoStatus === 'concluida' ? { dataConclusao: Date.now() } : {}),
    } : os));
  };

  const criarOS = async () => {
    if (!tentarAcao()) return;
    if (!novaTitulo.trim()) return;

    try {
      const created: any = await osApi.create({
        condominioId: novaCond,
        titulo: novaTitulo.trim(),
        descricao: novaDesc.trim(),
        tipo: novaTipo,
        prioridade: novaPrioridade,
        local: novaLocal.trim(),
      } as any);
      const nova: OSComProtocolo = {
        id: created.id,
        protocolo: created.protocolo,
        condominioId: created.condominioId,
        titulo: created.titulo,
        descricao: created.descricao || '',
        tipo: created.tipo,
        prioridade: created.prioridade,
        status: created.status,
        local: created.local || '',
        fotos: [],
        observacoes: '',
        dataAbertura: created.dataAbertura ? new Date(created.dataAbertura).getTime() : Date.now(),
        criadoPor: created.criadoPor,
      };
      setOrdens(prev => [nova, ...prev]);
    } catch { alert('Erro ao criar O.S.'); }
    setNovaTitulo(''); setNovaDesc(''); setNovaTipo('limpeza');
    setNovaPrioridade('media'); setNovaCond(condominiosList[0]?.id || ''); setNovaLocal('');
    setModalNova(false);
  };

  return (
    <div id="os-content">
      <HowItWorks
        titulo="Orden de Serviço"
        descricao="Gerencie toda as ordens de serviço de manutenção predial dos condomínios. Acompanhe status, prioridade, responsáveis e avaliações."
        passos={[
          'Crie uma nova O.S. clicando no botão sNova O.S.s',
          'Preencha tipo (limpeza, manutenção, emergência ou preventiva)',
          'Defina a prioridade e o local no condomínio',
          'Atribua um responsável e supervisor',
          'Acompanhe o andamento em tempo real',
          'Ao concluir, o solicitante pode avaliar o serviço',
        ]}
      />

      {loading ? <LoadingSpinner /> : <>
      <PageHeader
        titulo="Orden de Serviço"
        subtitulo={`${ordens.length} ordens registradas`}
        onCompartilhar={() => compartilharConteudo('Ordens de Serviço', `Total: ${ordens.length} ordens`)}
        onImprimir={() => imprimirElemento('os-content')}
        onGerarPdf={() => gerarPdfDeElemento('os-content', 'ordens-servico')}
        acoes={
          podeCriar() ? (
            <button className={styles.addBtn} onClick={() => setModalNova(true)}>
              <Plus size={18} />
              <span>Nova O.S.</span>
            </button>
          ) : undefined
        }
      />

      {/* Busca Inteligente */}
      <div className={styles.buscaArea}>
        <Search size={18} className={styles.buscaIcon} />
        <input
          type="text"
          className={styles.buscaInput}
          placeholder="Buscar por título, protocolo, local, tipo, prioridade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button className={styles.buscaLimpar} onClick={() => setBusca('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filtros de Status Coloridos */}
      <div className={styles.filterTabs}>
        {[
          { key: 'todos', label: 'Todas' },
          { key: 'aberta', label: 'Abertas' },
          { key: 'em_andamento', label: 'Em Andamento' },
          { key: 'aguardando', label: 'Aguardando' },
          { key: 'concluida', label: 'Concluídas' },
          { key: 'cancelada', label: 'Canceladas' },
        ].map(f => {
          const statusClass = f.key === 'todos' ? styles.tabTodas : f.key === 'aberta' ? styles.tabAberta : f.key === 'em_andamento' ? styles.tabAndamento : f.key === 'aguardando' ? styles.tabAguardando : f.key === 'concluida' ? styles.tabConcluida : styles.tabCancelada;
          const activeClass = f.key === 'todos' ? styles.tabTodasActive : f.key === 'aberta' ? styles.tabAbertaActive : f.key === 'em_andamento' ? styles.tabAndamentoActive : f.key === 'aguardando' ? styles.tabAguardandoActive : f.key === 'concluida' ? styles.tabConcluidaActive : styles.tabCanceladaActive;
          return (
            <button
              key={f.key}
              className={`${styles.filterTab} ${statusClass} ${filtroStatus === f.key ? activeClass : ''}`}
              onClick={() => setFiltroStatus(f.key)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* OS List */}
      <div className={styles.osList}>
        {filtered.length === 0 && (
          <EmptyState
            icon={<Wrench size={48} strokeWidth={1.5} />}
            titulo="Nenhuma ordem de serviço"
            descricao={busca ? 'Nenhum resultado para a busca atual.' : 'Crie sua primeira ordem de serviço.'}
          />
        )}
        {pag.items.map(os => {
          const statusInfo = statusOSBadge(os.status);
          const prioInfo = prioridadeBadge(os.prioridade);
          return (
            <Card key={os.id} hover padding="md">
              <div className={styles.osCard}>
                <div className={styles.osTop}>
                  <div className={styles.osId}>
                    {tipoIcon[os.tipo]}
                    <span>{os.id}</span>
                    <span className={styles.protocoloTag}><Hash size={12} /> {os.protocolo}</span>
                  </div>
                  <div className={styles.osBadges}>
                    <StatusBadge texto={prioInfo.texto} variante={prioInfo.variante} />
                    <StatusBadge texto={statusInfo.texto} variante={statusInfo.variante} />
                  </div>
                </div>
                <h4 className={styles.osTitle}>{os.titulo}</h4>
                <p className={styles.osDesc}>{os.descricao}</p>
                <div className={styles.osMeta}>
                  <span><MapPin size={13} /> {os.local}</span>
                  <span><Calendar size={13} /> {formatarDataHora(os.dataAbertura)}</span>
                </div>
                <div className={styles.osFooter}>
                  {os.avaliacaoNota && (
                    <div className={styles.osRating}>
                      {'★'.repeat(os.avaliacaoNota)}{'☆'.repeat(5 - os.avaliacaoNota)}
                    </div>
                  )}
                  {podeEditar() && (
                    <div className={styles.statusSelect}>
                      <label>Status:</label>
                      <select
                        value={os.status}
                        onChange={e => atualizarStatus(os.id, e.target.value as StatusOS)}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <WhatsAppShare mensagem={`*Ordem de Serviço*\n*Protocolo:* ${os.protocolo}\n*Título:* ${os.titulo}\n*Tipo:* ${os.tipo}\n*Prioridade:* ${os.prioridade}\n*Status:* ${os.status}\n*Local:* ${os.local || 'N/A'}\n*Abertura:* ${formatarDataHora(os.dataAbertura)}`} />
                </div>
              </div>
            </Card>
          );
        })}
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

      {/* Chart */}
      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 className={styles.chartTitle}>Resumo por Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="status" stroke="var(--cor-texto-secundario)" fontSize={12} />
              <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Modal Nova OS */}
      <Modal aberto={modalNova} onFechar={() => setModalNova(false)} titulo="Nova Ordem de Serviço" largura="lg">
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Título</label>
            <input required placeholder="Ex: Manutenção do elevador" value={novaTitulo} onChange={e => setNovaTitulo(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <textarea rows={3} placeholder="Descreva o problema detalhadamente..." value={novaDesc} onChange={e => setNovaDesc(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Tipo</label>
              <select value={novaTipo} onChange={e => setNovaTipo(e.target.value as any)}>
                <option value="limpeza">Limpeza</option>
                <option value="manutencao">Manutenção</option>
                <option value="emergencia">Emergência</option>
                <option value="preventiva">Preventiva</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Prioridade</label>
              <select value={novaPrioridade} onChange={e => setNovaPrioridade(e.target.value as any)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Condomínio</label>
              <select value={novaCond} onChange={e => setNovaCond(e.target.value)}>
                {condominiosList.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Local</label>
              <input placeholder="Ex: Bloco A - 3º andar" value={novaLocal} onChange={e => setNovaLocal(e.target.value)} />
            </div>
          </div>
          <button type="button" className={styles.submitBtn} onClick={criarOS}>
            <Plus size={18} /> Criar Ordem de Serviço
          </button>
        </div>
      </Modal>
      </>}
    </div>
  );
};

export default OrdensServicoPage;
