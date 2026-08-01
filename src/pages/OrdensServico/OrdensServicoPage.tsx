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
import { ordensServico as osApi, condominios as condominiosApi, usuarios as usuariosApi, upload as uploadApi } from '../../services/api';
import ColaboracaoOS from '../../components/OS/ColaboracaoOS';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import ShareButton from '../../components/Common/ShareButton';
import styles from './OrdensServico.module.css';

interface OSComProtocolo extends OrdemServico {
  protocolo: string;
  responsaveis?: Array<{ id: string; usuario_id?: string | null; nome: string; papel?: string }>;
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

const mapOS = (r: any): OSComProtocolo => {
  const abertura = r.dataAbertura ?? r.data_abertura;
  const previsao = r.dataPrevisao ?? r.data_previsao;
  const conclusao = r.dataConclusao ?? r.data_conclusao;
  return {
    id: r.id,
    protocolo: r.protocolo,
    condominioId: r.condominioId ?? r.condominio_id,
    titulo: r.titulo,
    descricao: r.descricao || '',
    tipo: r.tipo,
    prioridade: r.prioridade,
    status: r.status,
    local: r.local || '',
    responsavelId: r.responsavelId ?? r.responsavel_id,
    supervisorId: r.supervisorId ?? r.supervisor_id,
    fotos: Array.isArray(r.fotos) ? r.fotos.map((f: any) => (typeof f === 'string' ? f : f.url)) : [],
    observacoes: r.observacoes || '',
    dataAbertura: abertura ? new Date(abertura).getTime() : Date.now(),
    dataPrevisao: previsao ? new Date(previsao).getTime() : undefined,
    dataConclusao: conclusao ? new Date(conclusao).getTime() : undefined,
    criadoPor: r.criadoPor ?? r.criado_por,
    avaliacaoNota: r.avaliacaoNota ?? r.avaliacao_nota,
    avaliacaoComentario: r.avaliacaoComentario ?? r.avaliacao_comentario,
    responsaveis: Array.isArray(r.responsaveis) ? r.responsaveis : [],
  };
};

const OrdensServicoPage: React.FC = () => {
  const { podeCriar, podeEditar, roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const [ordens, setOrdens] = useState<OSComProtocolo[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalNova, setModalNova] = useState(false);
  const [detalhe, setDetalhe] = useState<any>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [editandoOS, setEditandoOS] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [edicao, setEdicao] = useState({ titulo: '', descricao: '', local: '', prioridade: 'media', dataPrevisao: '' });

  const abrirDetalhe = async (id: string) => {
    setCarregandoDetalhe(true);
    setDetalhe({ id, carregando: true });
    try {
      const row: any = await osApi.get(id);
      setDetalhe(row);
      setEdicao({
        titulo: row.titulo || '',
        descricao: row.descricao || '',
        local: row.local || '',
        prioridade: row.prioridade || 'media',
        dataPrevisao: row.data_previsao ? String(row.data_previsao).slice(0, 10) : '',
      });
      setEditandoOS(false);
    } catch {
      setDetalhe(null);
      alert('Não foi possível abrir a O.S.');
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const sincronizarLista = (row: any) => {
    setOrdens(prev => prev.map(o => o.id === row.id ? { ...o, ...mapOS({ ...o, ...row }) } : o));
  };

  const recarregarDetalhe = async () => {
    if (!detalhe?.id) return;
    const row: any = await osApi.get(detalhe.id);
    setDetalhe(row);
    sincronizarLista(row);
  };

  const salvarEdicao = async () => {
    if (!tentarAcao()) return;
    if (edicao.titulo.trim().length < 3) { alert('Título muito curto.'); return; }
    setSalvandoEdicao(true);
    try {
      const row: any = await osApi.update(detalhe.id, {
        titulo: edicao.titulo.trim(),
        descricao: edicao.descricao.trim(),
        local: edicao.local.trim(),
        prioridade: edicao.prioridade,
        ...(edicao.dataPrevisao ? { dataPrevisao: edicao.dataPrevisao } : {}),
      } as any);
      setDetalhe(row);
      sincronizarLista(row);
      setEditandoOS(false);
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar edição');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  useEffect(() => {
    Promise.all([osApi.list().catch(() => []), condominiosApi.list().catch(() => [])])
      .then(([rows, conds]) => {
        const lista = Array.isArray(rows) ? rows : (rows as any)?.data ?? [];
        setOrdens(lista.map(mapOS));
        setCondominiosList(conds);
        if (conds.length > 0) setNovaCond(conds[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Form nova OS
  const [novaTitulo, setNovaTitulo] = useState('');
  const [novaDesc, setNovaDesc] = useState('');
  const [novaTipo, setNovaTipo] = useState<'limpeza' | 'manutencao' | 'emergencia' | 'preventiva'>('limpeza');
  const [novaPrioridade, setNovaPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [novaCond, setNovaCond] = useState('');
  const [novaLocal, setNovaLocal] = useState('');
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [candidatosNova, setCandidatosNova] = useState<any[]>([]);
  const [novaResponsaveis, setNovaResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    if (!modalNova || !novaCond) { return; }
    setNovaResponsaveis([]);
    osApi.candidatosPorCondominio(novaCond)
      .then(setCandidatosNova)
      .catch(() => setCandidatosNova([]));
  }, [modalNova, novaCond]);

  const chaveCandidato = (c: any) => (c.id ? `id:${c.id}` : `nome:${String(c.nome).trim().toLowerCase()}`);

  const responsaveisSelecionados = (chaves: string[], lista: any[]) =>
    chaves.map(chave => {
      const c = lista.find(x => chaveCandidato(x) === chave);
      return c?.id ? { usuarioId: c.id } : { nome: c?.nome ?? chave.replace(/^nome:/, '') };
    });

  useEffect(() => {
    if (modalNova && roleNivel >= 3 && funcionarios.length === 0) {
      usuariosApi.list()
        .then((us: any[]) => setFuncionarios(us.filter(u => u.role === 'funcionario')))
        .catch(() => {});
    }
  }, [modalNova]);

  const alternarNotificarFunc = async (id: string, atual: boolean) => {
    if (!tentarAcao()) return;
    setFuncionarios(prev => prev.map(f => f.id === id ? { ...f, notificar_os_email: !atual } : f));
    try {
      await usuariosApi.setNotificarEmail(id, !atual);
    } catch {
      setFuncionarios(prev => prev.map(f => f.id === id ? { ...f, notificar_os_email: atual } : f));
      alert('Erro ao salvar preferência.');
    }
  };

  const condSelecionada = condominiosList.find((c: any) => c.id === novaCond);
  const autoNotificar = !!(condSelecionada?.osAutoNotificar ?? condSelecionada?.os_auto_notificar);

  const alternarAutoNotificar = async () => {
    if (!condSelecionada || salvandoAuto) return;
    if (!tentarAcao()) return;
    setSalvandoAuto(true);
    try {
      await condominiosApi.setOsAutoNotificar(condSelecionada.id, !autoNotificar);
      setCondominiosList(prev => prev.map((c: any) =>
        c.id === condSelecionada.id
          ? { ...c, osAutoNotificar: !autoNotificar, os_auto_notificar: !autoNotificar }
          : c
      ));
    } catch { alert('Erro ao salvar configuração.'); }
    finally { setSalvandoAuto(false); }
  };

  useEffect(() => {
    if (modalNova && condominiosList.length === 0) {
      condominiosApi.list().then((conds: any[]) => {
        setCondominiosList(conds);
        if (conds.length > 0) setNovaCond(conds[0].id);
      }).catch(() => {});
    }
  }, [modalNova]);

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
    try {
      await osApi.updateStatus(id, novoStatus);
      setOrdens(prev => prev.map(os => os.id === id ? {
        ...os,
        status: novoStatus,
        ...(novoStatus === 'concluida' ? { dataConclusao: Date.now() } : {}),
      } : os));
    } catch { alert('Erro ao atualizar'); }
  };

  const criarOS = async () => {
    if (!tentarAcao()) return;
    if (!novaTitulo.trim()) return;
    if (!novaCond) { alert('Selecione um condomínio.'); return; }

    try {
      const created: any = await osApi.create({
        condominioId: novaCond,
        titulo: novaTitulo.trim(),
        descricao: novaDesc.trim(),
        tipo: novaTipo,
        prioridade: novaPrioridade,
        local: novaLocal.trim(),
        responsaveis: responsaveisSelecionados(novaResponsaveis, candidatosNova),
      } as any);
      setOrdens(prev => [mapOS(created), ...prev]);
      setNovaTitulo(''); setNovaDesc(''); setNovaTipo('limpeza');
      setNovaPrioridade('media'); setNovaCond(condominiosList[0]?.id || ''); setNovaLocal('');
      setNovaResponsaveis([]);
      setModalNova(false);
    } catch { alert('Erro ao criar O.S.'); }
  };

  return (
    <div id="os-content">
      <HowItWorks
        titulo="Ordens de Serviço"
        descricao="Gerencie todas as ordens de serviço de manutenção predial dos condomínios. Acompanhe status, prioridade, responsáveis e avaliações."
        passos={[
          'Crie uma nova O.S. clicando no botão "Nova O.S."',
          'Preencha tipo (limpeza, manutenção, emergência ou preventiva)',
          'Defina a prioridade e o local no condomínio',
          'Atribua um responsável e supervisor',
          'Acompanhe o andamento em tempo real',
          'Ao concluir, o solicitante pode avaliar o serviço',
        ]}
      />

      {loading ? <LoadingSpinner /> : <>
      <PageHeader
        titulo="Ordens de Serviço"
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
                {(os.responsaveis?.length ?? 0) > 0 && (
                  <div className={styles.respLinha}>
                    <span className={styles.respRotulo}>Responsáveis:</span>
                    {os.responsaveis!.map(r => (
                      <span key={r.id} className={styles.respChip}>{r.nome}</span>
                    ))}
                  </div>
                )}
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
                  <button type="button" className={styles.detalheBtn} onClick={() => abrirDetalhe(os.id)}>
                    Abrir O.S.
                  </button>
                  <WhatsAppShare mensagem={`*Ordem de Serviço*\n*Protocolo:* ${os.protocolo}\n*Título:* ${os.titulo}\n*Tipo:* ${os.tipo}\n*Prioridade:* ${os.prioridade}\n*Status:* ${os.status}\n*Local:* ${os.local || 'N/A'}\n*Abertura:* ${formatarDataHora(os.dataAbertura)}`} />
                  <ShareButton tipo="os" id={os.id} titulo={os.titulo} />
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
          <div className={styles.formGroup}>
            <label>Responsáveis pela O.S.</label>
            <p style={{ fontSize: 13, color: '#666', margin: '4px 0 8px' }}>
              Marque uma ou mais pessoas — gestores, síndico e funcionários do condomínio:
            </p>
            {candidatosNova.length === 0 ? (
              <p style={{ fontSize: 13, color: '#999' }}>Nenhuma pessoa disponível neste condomínio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {candidatosNova.map(c => {
                  const chave = chaveCandidato(c);
                  return (
                    <label key={chave} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={novaResponsaveis.includes(chave)}
                        onChange={() => setNovaResponsaveis(prev =>
                          prev.includes(chave) ? prev.filter(k => k !== chave) : [...prev, chave]
                        )}
                      />
                      {c.nome}
                      <span style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>{c.cargo || c.role}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {roleNivel >= 3 && (
            <label className={styles.autoNotifRow}>
              <input
                type="checkbox"
                checked={autoNotificar}
                disabled={salvandoAuto || !condSelecionada}
                onChange={alternarAutoNotificar}
              />
              <span>
                <strong>Envio automático para funcionários</strong>
                {autoNotificar
                  ? ' — ao criar a O.S., todos os funcionários deste condomínio recebem notificação no aplicativo.'
                  : ' — desligado: compartilhe a O.S. via link, WhatsApp ou app pelo botão Compartilhar.'}
              </span>
            </label>
          )}
          {roleNivel >= 3 && (
            <div className={styles.formGroup}>
              <label>Notificação por e-mail ao criar a O.S.</label>
              <p style={{ fontSize: 13, color: '#666', margin: '4px 0 8px' }}>
                Síndicos e associados com e-mail cadastrado são avisados automaticamente. Marque quais funcionários também recebem — fica salvo até você desmarcar:
              </p>
              {funcionarios.length === 0 ? (
                <p style={{ fontSize: 13, color: '#999' }}>Nenhum funcionário cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {funcionarios.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={f.notificar_os_email !== false}
                        onChange={() => alternarNotificarFunc(f.id, f.notificar_os_email !== false)}
                      />
                      {f.nome}{f.email ? '' : ' (sem e-mail)'}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" className={styles.submitBtn} onClick={criarOS}>
            <Plus size={18} /> Criar Ordem de Serviço
          </button>
        </div>
      </Modal>

      {/* Modal Detalhe da OS */}
      <Modal
        aberto={!!detalhe}
        onFechar={() => { setDetalhe(null); setEditandoOS(false); }}
        titulo={detalhe?.titulo ? `${detalhe.protocolo || ''} — ${detalhe.titulo}` : 'Ordem de Serviço'}
        largura="lg"
      >
        {carregandoDetalhe || !detalhe?.titulo ? (
          <LoadingSpinner />
        ) : (
          <div className={styles.detalhe}>
            <div className={styles.detalheTopo}>
              <span className={styles.respRotulo}>Responsáveis:</span>
              {(detalhe.responsaveis || []).length === 0
                ? <span className={styles.respVazio}>ninguém definido</span>
                : detalhe.responsaveis.map((r: any) => <span key={r.id} className={styles.respChip}>{r.nome}</span>)}
            </div>

            {editandoOS ? (
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Título</label>
                  <input value={edicao.titulo} onChange={e => setEdicao({ ...edicao, titulo: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Descrição</label>
                  <textarea rows={3} value={edicao.descricao} onChange={e => setEdicao({ ...edicao, descricao: e.target.value })} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Local</label>
                    <input value={edicao.local} onChange={e => setEdicao({ ...edicao, local: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Prioridade</label>
                    <select value={edicao.prioridade} onChange={e => setEdicao({ ...edicao, prioridade: e.target.value })}>
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Previsão</label>
                  <input type="date" value={edicao.dataPrevisao} onChange={e => setEdicao({ ...edicao, dataPrevisao: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={styles.submitBtn} onClick={salvarEdicao} disabled={salvandoEdicao}>
                    {salvandoEdicao ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button type="button" className={styles.detalheBtn} onClick={() => setEditandoOS(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className={styles.detalheInfo}>
                <p className={styles.osDesc}>{detalhe.descricao || 'Sem descrição inicial.'}</p>
                <div className={styles.osMeta}>
                  <span><MapPin size={13} /> {detalhe.local || '—'}</span>
                  <span><Calendar size={13} /> {formatarDataHora(detalhe.data_abertura)}</span>
                  {detalhe.criado_por_nome && <span>Aberta por {detalhe.criado_por_nome}</span>}
                </div>
                <button type="button" className={styles.detalheBtn} onClick={() => setEditandoOS(true)}>Editar O.S.</button>
              </div>
            )}

            <ColaboracaoOS
              responsaveis={detalhe.responsaveis || []}
              fotos={(detalhe.fotos || []).filter((f: any) => f && typeof f === 'object')}
              historico={detalhe.historico || []}
              carregarCandidatos={() => osApi.candidatos(detalhe.id)}
              onSalvarResponsaveis={async lista => { await osApi.setResponsaveis(detalhe.id, lista); await recarregarDetalhe(); }}
              onAdicionarDescricao={async texto => { await osApi.addDescricao(detalhe.id, texto); await recarregarDetalhe(); }}
              onEnviarFotos={async arquivos => {
                const urls: Array<{ url: string }> = [];
                for (const a of arquivos) urls.push({ url: await uploadApi.image(a, 'fotos') });
                await osApi.addFotos(detalhe.id, urls);
                await recarregarDetalhe();
              }}
              onRemoverFoto={async fotoId => { await osApi.removerFoto(detalhe.id, fotoId); await recarregarDetalhe(); }}
            />
          </div>
        )}
      </Modal>
      </>}
    </div>
  );
};

export default OrdensServicoPage;
