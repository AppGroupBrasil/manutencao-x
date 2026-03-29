import React, { useState, useMemo, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import { usePagination } from '../../hooks/usePagination';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  planosManutencao as planosApi,
  equipamentos as equipamentosApi,
  condominios as condominiosApi,
} from '../../services/api';
import {
  Plus, Search, CalendarCheck, CalendarClock, ClipboardCheck, Building2,
  Edit, Trash2, CheckCircle2, Clock, AlertTriangle, X, Play
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './PlanosManutencao.module.css';

const FREQUENCIAS = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const STATUS_MAP: Record<string, { label: string; classe: string }> = {
  ativo: { label: 'Ativo', classe: styles.statusAtivo },
  inativo: { label: 'Inativo', classe: styles.statusInativo },
  pausado: { label: 'Pausado', classe: styles.statusPausado },
  concluido: { label: 'Concluído', classe: styles.statusConcluido },
};

const CORES = ['#1a73e8', '#43a047', '#f57c00', '#7b1fa2', '#00897b', '#d32f2f'];

const FORM_INICIAL = {
  titulo: '', descricao: '', frequencia: 'mensal', equipamentoId: '',
  condominioId: '', responsavelId: '', dataInicio: '', dataFim: '',
  itensVerificacao: [''], observacoes: '', status: 'ativo',
};

const PlanosManutencaoPage: React.FC = () => {
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const ehGestor = roleNivel >= 2;

  const [planos, setPlanos] = useState<any[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [equipamentosList, setEquipamentosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendario, setCalendario] = useState<any[]>([]);

  const [busca, setBusca] = useState('');
  const [filtroFreq, setFiltroFreq] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCondo, setFiltroCondo] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);

  // Execuções
  const [showExec, setShowExec] = useState(false);
  const [execPlano, setExecPlano] = useState<any | null>(null);
  const [execucoes, setExecucoes] = useState<any[]>([]);
  const [showNovaExec, setShowNovaExec] = useState(false);
  const [execForm, setExecForm] = useState({ dataExecucao: '', observacoes: '', status: 'concluida' });

  // Calendário
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    Promise.all([
      planosApi.list(),
      condominiosApi.list().catch(() => []),
      equipamentosApi.list().catch(() => []),
      planosApi.calendario().catch(() => []),
    ]).then(([pls, conds, eqs, cal]) => {
      setPlanos(pls as any[]);
      setCondominiosList(conds as any[]);
      setEquipamentosList(eqs as any[]);
      setCalendario(cal as any[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    let lista = planos;
    if (filtroFreq !== 'todos') lista = lista.filter(p => p.frequencia === filtroFreq);
    if (filtroStatus !== 'todos') lista = lista.filter(p => p.status === filtroStatus);
    if (filtroCondo !== 'todos') lista = lista.filter(p => p.condominioId === filtroCondo);
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(p => {
        const texto = `${p.titulo} ${p.descricao} ${p.equipamentoNome} ${p.condominioNome}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }
    return lista;
  }, [planos, filtroFreq, filtroStatus, filtroCondo, busca]);

  const chartFreq = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach(p => {
      const label = FREQUENCIAS.find(f => f.value === p.frequencia)?.label || p.frequencia;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor }));
  }, [filtrados]);

  const equipCondFiltrado = useMemo(() => {
    if (!form.condominioId) return equipamentosList;
    return equipamentosList.filter(e => e.condominioId === form.condominioId);
  }, [equipamentosList, form.condominioId]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_INICIAL, condominioId: condominiosList[0]?.id || '', dataInicio: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const abrirEditar = (p: any) => {
    setEditando(p);
    const itens = p.itensVerificacao || [];
    setForm({
      titulo: p.titulo || '', descricao: p.descricao || '', frequencia: p.frequencia || 'mensal',
      equipamentoId: p.equipamentoId || '', condominioId: p.condominioId || '',
      responsavelId: p.responsavelId || '',
      dataInicio: p.dataInicio?.split('T')[0] || '', dataFim: p.dataFim?.split('T')[0] || '',
      itensVerificacao: itens.length ? itens : [''],
      observacoes: p.observacoes || '', status: p.status || 'ativo',
    });
    setShowModal(true);
  };

  const salvar = async () => {
    if (!tentarAcao()) return;
    if (!form.titulo.trim() || !form.condominioId || !form.frequencia) return;
    try {
      const itens = form.itensVerificacao.filter(i => i.trim());
      const payload = { ...form, itensVerificacao: itens.length ? itens : null };
      if (editando) {
        const atualizado = await planosApi.update(editando.id, payload);
        setPlanos(prev => prev.map(p => p.id === editando.id ? atualizado : p));
      } else {
        const criado = await planosApi.create(payload);
        setPlanos(prev => [...prev, criado]);
      }
      setShowModal(false);
    } catch (err) { console.error(err); }
  };

  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    if (!confirm('Excluir este plano?')) return;
    try {
      await planosApi.remove(id);
      setPlanos(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
  };

  const abrirExecucoes = async (p: any) => {
    setExecPlano(p);
    try {
      const rows = await planosApi.listExecucoes(p.id);
      setExecucoes(rows);
    } catch { setExecucoes([]); }
    setShowExec(true);
  };

  const salvarExecucao = async () => {
    if (!tentarAcao() || !execPlano) return;
    if (!execForm.dataExecucao) return;
    try {
      const novo = await planosApi.addExecucao(execPlano.id, execForm);
      setExecucoes(prev => [novo, ...prev]);
      setPlanos(prev => prev.map(p => p.id === execPlano.id ? { ...p, totalExecucoes: (p.totalExecucoes || 0) + 1, ultimaExecucao: execForm.dataExecucao } : p));
      setShowNovaExec(false);
      setExecForm({ dataExecucao: '', observacoes: '', status: 'concluida' });
    } catch (err) { console.error(err); }
  };

  // Itens verificação helpers
  const adicionarItem = () => setForm(prev => ({ ...prev, itensVerificacao: [...prev.itensVerificacao, ''] }));
  const removerItem = (idx: number) => setForm(prev => ({ ...prev, itensVerificacao: prev.itensVerificacao.filter((_, i) => i !== idx) }));
  const editarItem = (idx: number, val: string) => setForm(prev => ({ ...prev, itensVerificacao: prev.itensVerificacao.map((v, i) => i === idx ? val : v) }));

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando planos de manutenção..." />;

  return (
    <div id="planos-content">
      <HowItWorks
        titulo="Planos de Manutenção Preventiva"
        descricao="Crie e gerencie planos recorrentes para manter equipamentos em dia."
        passos={[
          'Crie planos com frequência definida (diária a anual)',
          'Vincule a equipamentos e defina itens de verificação',
          'Registre cada execução com status e observações',
          'Acompanhe o calendário de próximas manutenções',
        ]}
      />

      <PageHeader
        titulo="Planos Preventivos"
        subtitulo={`${filtrados.length} plano${filtrados.length !== 1 ? 's' : ''}`}
        onCompartilhar={() => compartilharConteudo('Planos Preventivos', `Total: ${filtrados.length}`)}
        onImprimir={() => imprimirElemento('planos-content')}
        onGerarPdf={() => gerarPdfDeElemento('planos-content', 'planos-preventivos')}
        acoes={<>
          <button className={styles.btnSm} onClick={() => setShowCal(true)} style={{ marginRight: 4 }}>
            <CalendarClock size={15} /> Calendário
          </button>
          {ehGestor && (
            <button className={styles.btnPrimary} onClick={abrirNovo}>
              <Plus size={16} /> Novo Plano
            </button>
          )}
        </>}
      />

      <div className={styles.filterBar}>
        <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)}>
          <option value="todos">Todos os Condomínios</option>
          {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroFreq} onChange={e => setFiltroFreq(e.target.value)}>
          <option value="todos">Todas Frequências</option>
          {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="pausado">Pausado</option>
          <option value="concluido">Concluído</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input placeholder="Buscar plano..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className={styles.grid}>
        {pag.items.map((p: any) => {
          const freq = FREQUENCIAS.find(f => f.value === p.frequencia)?.label || p.frequencia;
          const itens: string[] = p.itensVerificacao || [];
          return (
            <div className={styles.card} key={p.id}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>{p.titulo}</h3>
                  <span className={styles.cardSub}>{p.equipamentoNome || 'Sem equipamento'} • {p.condominioNome}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span className={`${styles.statusBadge} ${STATUS_MAP[p.status]?.classe || ''}`}>
                    {STATUS_MAP[p.status]?.label || p.status}
                  </span>
                  <span className={styles.freqBadge}><CalendarCheck size={12} /> {freq}</span>
                </div>
              </div>

              <div className={styles.cardBody}>
                {p.descricao && <div className={styles.cardRow}>{p.descricao}</div>}
                <div className={styles.cardRow}>
                  <Clock size={13} />
                  Última: {p.ultimaExecucao ? new Date(p.ultimaExecucao).toLocaleDateString('pt-BR') : 'Nunca'}
                </div>
                <div className={styles.cardRow}>
                  <ClipboardCheck size={13} />
                  {p.totalExecucoes || 0} execuções registradas
                </div>

                {itens.length > 0 && (
                  <div className={styles.checkList}>
                    {itens.slice(0, 4).map((item, i) => (
                      <div className={styles.checkItem} key={i}><CheckCircle2 size={12} /> {item}</div>
                    ))}
                    {itens.length > 4 && <span style={{ fontSize: 11, color: 'var(--cor-texto-secundario)' }}>+{itens.length - 4} mais...</span>}
                  </div>
                )}

                {p.proximaExecucao && (
                  <div className={styles.cardRow} style={{
                    fontWeight: 600,
                    color: new Date(p.proximaExecucao) < new Date() ? '#d32f2f' : 'var(--cor-primaria)',
                  }}>
                    <AlertTriangle size={13} />
                    Próxima: {new Date(p.proximaExecucao).toLocaleDateString('pt-BR')}
                    {new Date(p.proximaExecucao) < new Date() && ' (ATRASADA)'}
                  </div>
                )}
              </div>

              <div className={styles.cardActions}>
                <button className={styles.btnSm} onClick={() => abrirExecucoes(p)}><Play size={14} /> Execuções</button>
                {ehGestor && <button className={styles.btnSm} onClick={() => abrirEditar(p)}><Edit size={14} /> Editar</button>}
                {ehGestor && <button className={styles.btnDanger} onClick={() => excluir(p.id)}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {filtrados.length > 0 && (
        <div className={styles.charts}>
          <Card>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartFreq} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ nome, valor }) => `${nome}: ${valor}`}>
                  {chartFreq.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <Modal aberto={showModal} titulo={editando ? 'Editar Plano' : 'Novo Plano Preventivo'} onFechar={() => setShowModal(false)}>
          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>Título *
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Revisão mensal de elevadores" />
            </label>
            <label>Frequência *
              <select value={form.frequencia} onChange={e => setForm({ ...form, frequencia: e.target.value })}>
                {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluído</option>
              </select>
            </label>
            <label>Condomínio *
              <select value={form.condominioId} onChange={e => setForm({ ...form, condominioId: e.target.value, equipamentoId: '' })}>
                <option value="">Selecione...</option>
                {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Equipamento
              <select value={form.equipamentoId} onChange={e => setForm({ ...form, equipamentoId: e.target.value })}>
                <option value="">Nenhum (geral)</option>
                {equipCondFiltrado.map(eq => <option key={eq.id} value={eq.id}>{eq.nome} ({eq.codigo})</option>)}
              </select>
            </label>
            <label>Data de Início
              <input type="date" value={form.dataInicio} onChange={e => setForm({ ...form, dataInicio: e.target.value })} />
            </label>
            <label>Data de Fim (opcional)
              <input type="date" value={form.dataFim} onChange={e => setForm({ ...form, dataFim: e.target.value })} />
            </label>
            <label className={styles.fullWidth}>Descrição
              <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva as atividades do plano..." />
            </label>

            <div className={styles.fullWidth}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Itens de Verificação</strong>
                <button type="button" className={styles.btnSm} onClick={adicionarItem}><Plus size={12} /> Item</button>
              </div>
              <div className={styles.itensEditor}>
                {form.itensVerificacao.map((item, i) => (
                  <div className={styles.itemRow} key={i}>
                    <input value={item} onChange={e => editarItem(i, e.target.value)} placeholder={`Item ${i + 1}`} />
                    {form.itensVerificacao.length > 1 && (
                      <button type="button" className={styles.removeBtn} onClick={() => removerItem(i)}><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label className={styles.fullWidth}>Observações
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className={styles.btnSm} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvar}>{editando ? 'Salvar' : 'Criar Plano'}</button>
          </div>
        </Modal>
      )}

      {/* Modal Execuções */}
      {showExec && execPlano && (
        <Modal aberto={showExec} titulo={`Execuções — ${execPlano.titulo}`} onFechar={() => { setShowExec(false); setShowNovaExec(false); }}>
          {ehGestor && !showNovaExec && (
            <button className={styles.btnPrimary} onClick={() => { setShowNovaExec(true); setExecForm({ dataExecucao: new Date().toISOString().split('T')[0], observacoes: '', status: 'concluida' }); }} style={{ marginBottom: 12 }}>
              <Plus size={14} /> Registrar Execução
            </button>
          )}

          {showNovaExec && (
            <div style={{ padding: 12, border: '1.5px solid var(--cor-borda)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                  Data *
                  <input type="date" value={execForm.dataExecucao} onChange={e => setExecForm({ ...execForm, dataExecucao: e.target.value })}
                    style={{ padding: 8, border: '1.5px solid var(--cor-borda)', borderRadius: 8, background: 'var(--cor-fundo)', fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                  Status
                  <select value={execForm.status} onChange={e => setExecForm({ ...execForm, status: e.target.value })}
                    style={{ padding: 8, border: '1.5px solid var(--cor-borda)', borderRadius: 8, background: 'var(--cor-fundo)', fontSize: 13 }}>
                    <option value="concluida">Concluída</option>
                    <option value="parcial">Parcial</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                Observações
                <textarea
                  value={execForm.observacoes}
                  onChange={e => setExecForm({ ...execForm, observacoes: e.target.value })}
                  style={{ padding: 8, border: '1.5px solid var(--cor-borda)', borderRadius: 8, background: 'var(--cor-fundo)', minHeight: 60, fontSize: 13 }}
                  placeholder="O que foi feito nesta execução..."
                />
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className={styles.btnSm} onClick={() => setShowNovaExec(false)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={salvarExecucao}>Salvar</button>
              </div>
            </div>
          )}

          <div className={styles.execList}>
            {execucoes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: 20 }}>Nenhuma execução registrada</p>}
            {execucoes.map(ex => (
              <div className={styles.execItem} key={ex.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 13 }}>{new Date(ex.dataExecucao).toLocaleDateString('pt-BR')}</strong>
                  <span className={`${styles.statusBadge} ${ex.status === 'concluida' ? styles.statusAtivo : ex.status === 'parcial' ? styles.statusPausado : styles.statusInativo}`}>
                    {ex.status === 'concluida' ? 'Concluída' : ex.status === 'parcial' ? 'Parcial' : 'Cancelada'}
                  </span>
                </div>
                {ex.observacoes && <p>{ex.observacoes}</p>}
                {ex.executorNome && <p style={{ fontStyle: 'italic', fontSize: 11.5 }}>Por: {ex.executorNome}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Modal Calendário */}
      {showCal && (
        <Modal aberto={showCal} titulo="Calendário de Próximas Manutenções" onFechar={() => setShowCal(false)}>
          <div className={styles.calList}>
            {calendario.length === 0 && <p style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: 20 }}>Nenhuma manutenção planejada</p>}
            {calendario.map((item, i) => {
              const atrasado = new Date(item.proximaExecucao) < new Date();
              return (
                <div className={`${styles.calItem} ${atrasado ? styles.calAtrasado : ''}`} key={i}>
                  <span className={styles.calDate}>{new Date(item.proximaExecucao).toLocaleDateString('pt-BR')}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--cor-texto-secundario)' }}>
                      {item.equipamentoNome || 'Geral'} • {item.condominioNome}
                    </div>
                  </div>
                  <span className={styles.freqBadge}>
                    {FREQUENCIAS.find(f => f.value === item.frequencia)?.label}
                  </span>
                  {atrasado && <AlertTriangle size={16} color="#d32f2f" />}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PlanosManutencaoPage;
