import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { validarImagem } from '../../utils/imageUtils';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  CalendarCheck, Plus, Camera, Mic, MicOff, Save, Clock, MapPin, User,
  CheckCircle2, XCircle, AlertTriangle, ClipboardList, FileText,
  Building2, Calendar, ChevronDown, ChevronUp, Trash2, Play, Square,
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { tarefas as tarefasApi, condominios as condominiosApi, usuarios as usuariosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './Tarefas.module.css';

/* ═══════════════════════════════════════
   TIPOS
═══════════════════════════════════════ */
interface TarefaAgendada {
  id: string;
  titulo: string;
  descricao: string;
  funcionarioId: string;
  funcionarioNome: string;
  condominio: string;
  bloco: string;
  local: string;
  recorrencia: 'unica' | 'diaria' | 'semanal' | 'mensal';
  dataEspecifica?: string;
  diasSemana: number[];
  diaMes?: number;
  criadoPor: string;
  criadoEm: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
}

type StatusExecucao = 'realizada' | 'pendente' | 'nao_executada';

interface ExecucaoTarefa {
  id: string;
  tarefaId: string;
  funcionarioId: string;
  funcionarioNome: string;
  status: StatusExecucao;
  fotos: string[];
  observacao: string;
  audioUrl?: string;
  dataExecucao: string;
  horaExecucao: string;
  latitude?: number;
  longitude?: number;
  endereco?: string;
  reporteProblema?: string;
}

/* ═══════════════════════════════════════
   STORAGE (removed)
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   DADOS DINÂMICOS (API)
═══════════════════════════════════════ */
const FUNCIONARIOS_FALLBACK = [
  { id: 'f1', nome: 'João Silva' },
  { id: 'f2', nome: 'Ana Souza' },
  { id: 'f3', nome: 'Marco Lima' },
  { id: 'f4', nome: 'Lucia Ferreira' },
  { id: 'f5', nome: 'Maria Costa' },
];

const BLOCOS_MOCK = ['Bloco A', 'Bloco B', 'Bloco C', 'Bloco D'];
const LOCAIS_MOCK = ['Hall de Entrada', 'Garagem', 'Piscina', 'Salão de Festas', 'Jardim', 'Elevadores', 'Escadarias', 'Playground'];

const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const buscarEndereco = async (lat: number, lon: number): Promise<string> => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=pt-BR`);
    const d = await r.json();
    return d.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
};

/* ═══════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════ */
const TarefasPage: React.FC = () => {
  const { usuario } = useAuth();
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const isSupervisor = roleNivel >= 2;

  const [tab, setTab] = useState<'tarefas' | 'criar' | 'acompanhar'>(isSupervisor ? 'tarefas' : 'tarefas');
  const [tarefas, setTarefas] = useState<TarefaAgendada[]>([]);
  const [execucoes, setExecucoes] = useState<ExecucaoTarefa[]>([]);
  const [funcionarios, setFuncionarios] = useState<{id:string;nome:string}[]>(FUNCIONARIOS_FALLBACK);
  const [condominiosNomes, setCondominiosNomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tarefasApi.list(),
      tarefasApi.allExecucoes().catch(() => []),
      usuariosApi.list().catch(() => FUNCIONARIOS_FALLBACK),
      condominiosApi.list().catch(() => []),
    ]).then(([tars, execs, usrs, conds]) => {
      setTarefas(tars as TarefaAgendada[]);
      setExecucoes(execs as ExecucaoTarefa[]);
      const mappedUsers = (usrs as any[]).map(u => ({ id: u.id, nome: u.nome }));
      if (mappedUsers.length > 0) setFuncionarios(mappedUsers);
      setCondominiosNomes((conds as any[]).map(c => c.nome));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  /* ═══ Form de criação ═══ */
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formFuncionario, setFormFuncionario] = useState('');
  const [formCondominio, setFormCondominio] = useState('');
  const [formBloco, setFormBloco] = useState('');
  const [formLocal, setFormLocal] = useState('');
  const [formRecorrencia, setFormRecorrencia] = useState<'unica' | 'diaria' | 'semanal' | 'mensal'>('unica');
  const [formData, setFormData] = useState('');
  const [formDias, setFormDias] = useState<number[]>([]);
  const [formDiaMes, setFormDiaMes] = useState(1);
  const [formPrioridade, setFormPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');

  const toggleDia = (d: number) => {
    setFormDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const criarTarefa = async () => {
    if (!tentarAcao()) return;
    if (!formTitulo || !formFuncionario || !formCondominio) return;
    const func = funcionarios.find(f => f.id === formFuncionario);
    const payload = {
      titulo: formTitulo,
      descricao: formDescricao,
      funcionarioId: formFuncionario,
      funcionarioNome: func?.nome || '',
      condominio: formCondominio,
      bloco: formBloco,
      local: formLocal,
      recorrencia: formRecorrencia,
      dataEspecifica: formRecorrencia === 'unica' ? formData : undefined,
      diasSemana: formRecorrencia === 'semanal' ? formDias : [],
      diaMes: formRecorrencia === 'mensal' ? formDiaMes : undefined,
      criadoPor: usuario?.nome || '',
      prioridade: formPrioridade,
    };
    try {
      const criada = await tarefasApi.create(payload) as TarefaAgendada;
      setTarefas(prev => [criada, ...prev]);
    } catch (err) { console.error(err); }
    setFormTitulo(''); setFormDescricao(''); setFormFuncionario('');
    setFormCondominio(''); setFormBloco(''); setFormLocal('');
    setFormRecorrencia('unica'); setFormData(''); setFormDias([]);
    setFormDiaMes(1); setFormPrioridade('media');
    setTab('tarefas');
  };

  const excluirTarefa = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await tarefasApi.remove(id);
      setTarefas(prev => prev.filter(t => t.id !== id));
    } catch (err) { console.error(err); }
  };

  /* ═══ Minhas tarefas (funcionário) ═══ */
  const minhasTarefas = useMemo(() => {
    if (isSupervisor) return tarefas;
    return tarefas.filter(t => t.funcionarioNome === usuario?.nome);
  }, [tarefas, usuario, isSupervisor]);

  /* ═══ Acompanhamento ═══ */
  const [filtroFunc, setFiltroFunc] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('mensal');

  const execucoesFiltradas = useMemo(() => {
    let arr = execucoes;
    if (filtroFunc !== 'todos') arr = arr.filter(e => e.funcionarioId === filtroFunc);
    const agora = new Date();
    const dias = filtroPeriodo === 'diario' ? 1 : filtroPeriodo === 'semanal' ? 7 : 30;
    const limite = new Date(agora.getTime() - dias * 86400000);
    arr = arr.filter(e => new Date(e.dataExecucao) >= limite);
    return arr;
  }, [execucoes, filtroFunc, filtroPeriodo]);

  const statsAcompanhamento = useMemo(() => {
    const total = execucoesFiltradas.length;
    const realizadas = execucoesFiltradas.filter(e => e.status === 'realizada').length;
    const pendentes = execucoesFiltradas.filter(e => e.status === 'pendente').length;
    const naoExec = execucoesFiltradas.filter(e => e.status === 'nao_executada').length;
    return {
      total, realizadas, pendentes, naoExec,
      pctRealizada: total > 0 ? Math.round((realizadas / total) * 100) : 0,
      pctPendente: total > 0 ? Math.round((pendentes / total) * 100) : 0,
      pctNaoExec: total > 0 ? Math.round((naoExec / total) * 100) : 0,
    };
  }, [execucoesFiltradas]);

  const porFuncionario = useMemo(() => {
    const mapa: Record<string, { nome: string; total: number; realizadas: number; pendentes: number; nao: number }> = {};
    execucoesFiltradas.forEach(e => {
      if (!mapa[e.funcionarioId]) mapa[e.funcionarioId] = { nome: e.funcionarioNome, total: 0, realizadas: 0, pendentes: 0, nao: 0 };
      mapa[e.funcionarioId].total++;
      if (e.status === 'realizada') mapa[e.funcionarioId].realizadas++;
      else if (e.status === 'pendente') mapa[e.funcionarioId].pendentes++;
      else mapa[e.funcionarioId].nao++;
    });
    return Object.values(mapa).sort((a, b) => {
      const pA = a.total > 0 ? a.realizadas / a.total : 0;
      const pB = b.total > 0 ? b.realizadas / b.total : 0;
      return pB - pA;
    });
  }, [execucoesFiltradas]);

  const prioridadeLabel: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
  const recorrenciaLabel: Record<string, string> = { unica: 'Única', diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };

  const pag = usePagination(minhasTarefas, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando tarefas..." />;

  return (
    <div id="tarefas-content" className={styles.pageWrapper}>
      <HowItWorks
        titulo="Tarefa Agendadas"
        descricao="Crie e acompanhe tarefa agendadas para funcionários com fotos, áudio, geolocalização e relatórios de execução."
        passos={[
          'Supervisores criam tarefas para datas específicas, diárias, semanais ou mensais por funcionário',
          'Funcionários veem suas tarefas e registram a execução com foto, observação ou áudio (até 30s)',
          'Classificam cada tarefa como Realizada, Pendente ou Não Executada',
          'A localização, data e horário são registrados automaticamente',
          'Supervisores acompanham o percentual de realização por funcionário e período',
        ]}
      />

      <PageHeader
        titulo="Tarefa Agendadas"
        subtitulo={`${minhasTarefas.length} tarefa(s) | ${execucoes.length} execuções registradas`}
        onCompartilhar={() => compartilharConteudo('Tarefas Agendadas', 'Tarefas do sistema Manutenção X')}
        onImprimir={() => imprimirElemento('tarefas-content')}
        onGerarPdf={() => gerarPdfDeElemento('tarefas-content', 'tarefas-agendadas')}
      />

      {/* ═══ Tabs ═══ */}
      <div className={styles.tabs}>
        <button className={tab === 'tarefas' ? styles.tabAtivo : styles.tab} onClick={() => setTab('tarefas')}>
          <ClipboardList size={16} /> Tarefas
          <span className={styles.tabBadge}>{minhasTarefas.length}</span>
        </button>
        {isSupervisor && (
          <button className={tab === 'criar' ? styles.tabAtivo : styles.tab} onClick={() => setTab('criar')}>
            <Plus size={16} /> Criar Tarefa
          </button>
        )}
        {isSupervisor && (
          <button className={tab === 'acompanhar' ? styles.tabAtivo : styles.tab} onClick={() => setTab('acompanhar')}>
            <CheckCircle2 size={16} /> Acompanhamento
          </button>
        )}
      </div>

      {/* ═══ CRIAR TAREFA ═══ */}
      {tab === 'criar' && isSupervisor && (
        <Card padding="md">
          <div className={styles.formCard}>
            <div className={styles.formRow}>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Título da Tarefa *</label>
                <input className={styles.formInput} value={formTitulo} onChange={e => setFormTitulo(e.target.value)} placeholder="Ex: Limpeza do hall de entrada" />
              </div>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Funcionário *</label>
                <select className={styles.formSelect} value={formFuncionario} onChange={e => setFormFuncionario(e.target.value)}>
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.formGrupo}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea className={styles.formTextarea} value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Descreva o detalhes da tarefa..." />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Condomínio *</label>
                <select className={styles.formSelect} value={formCondominio} onChange={e => setFormCondominio(e.target.value)}>
                  <option value="">Selecione...</option>
                  {condominiosNomes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Bloco</label>
                <select className={styles.formSelect} value={formBloco} onChange={e => setFormBloco(e.target.value)}>
                  <option value="">Todos</option>
                  {BLOCOS_MOCK.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Local</label>
                <select className={styles.formSelect} value={formLocal} onChange={e => setFormLocal(e.target.value)}>
                  <option value="">Selecione...</option>
                  {LOCAIS_MOCK.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Prioridade</label>
                <select className={styles.formSelect} value={formPrioridade} onChange={e => setFormPrioridade(e.target.value as any)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Recorrência</label>
                <select className={styles.formSelect} value={formRecorrencia} onChange={e => setFormRecorrencia(e.target.value as any)}>
                  <option value="unica">Data Específica</option>
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal (dias da semana)</option>
                  <option value="mensal">Mensal (dia do mês)</option>
                </select>
              </div>

              {formRecorrencia === 'unica' && (
                <div className={styles.formGrupo}>
                  <label className={styles.formLabel}>Data</label>
                  <input type="date" className={styles.formInput} value={formData} onChange={e => setFormData(e.target.value)} />
                </div>
              )}

              {formRecorrencia === 'mensal' && (
                <div className={styles.formGrupo}>
                  <label className={styles.formLabel}>Dia do Mês</label>
                  <input type="number" className={styles.formInput} min={1} max={31} value={formDiaMes} onChange={e => setFormDiaMes(Number(e.target.value))} />
                </div>
              )}
            </div>

            {formRecorrencia === 'semanal' && (
              <div className={styles.formGrupo}>
                <label className={styles.formLabel}>Dias da Semana</label>
                <div className={styles.diasSemana}>
                  {DIAS_SEMANA_LABEL.map((d, i) => (
                    <button key={i} type="button" className={formDias.includes(i) ? styles.diaBtnAtivo : styles.diaBtn} onClick={() => toggleDia(i)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.formActions}>
              <button className={styles.btnPrimario} onClick={criarTarefa} disabled={!formTitulo || !formFuncionario || !formCondominio}>
                <Plus size={16} /> Criar Tarefa
              </button>
              <button className={styles.btnSecundario} onClick={() => setTab('tarefas')}>Cancelar</button>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ LISTA DE TAREFAS ═══ */}
      {tab === 'tarefas' && (
        <>
          {minhasTarefas.length === 0 ? (
            <Card padding="md">
              <div className={styles.empty}>
                <CalendarCheck size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>Nenhuma tarefa agendada{!isSupervisor ? ' para você' : ''}.</p>
                {isSupervisor && <button className={styles.btnPrimario} onClick={() => setTab('criar')}><Plus size={16} /> Criar Tarefa</button>}
              </div>
            </Card>
          ) : (
            <div className={styles.tarefasList}>
              {pag.items.map(tarefa => (
                <TarefaCardItem
                  key={tarefa.id}
                  tarefa={tarefa}
                  execucoes={execucoes}
                  setExecucoes={setExecucoes}
                  isSupervisor={isSupervisor}
                  usuario={usuario}
                  onExcluir={() => excluirTarefa(tarefa.id)}
                  prioridadeLabel={prioridadeLabel}
                  recorrenciaLabel={recorrenciaLabel}
                />
              ))}
            </div>
          )}
          <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />
        </>
      )}

      {/* ═══ ACOMPANHAMENTO ═══ */}
      {tab === 'acompanhar' && isSupervisor && (
        <>
          <Card padding="md">
            <div className={styles.filtroRow}>
              <select className={styles.filtroSelect} value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)}>
                <option value="todos">Todos os Funcionários</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <select className={styles.filtroSelect} value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
                <option value="diario">Hoje</option>
                <option value="semanal">Última Semana</option>
                <option value="mensal">Último Mês</option>
              </select>
            </div>
          </Card>

          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcone} style={{ background: '#e3f2fd' }}><ClipboardList size={22} color="#1565c0" /></div>
              <div className={styles.statInfo}>
                <span className={styles.statValor}>{statsAcompanhamento.total}</span>
                <span className={styles.statLabel}>Total Execuções</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcone} style={{ background: '#e8f5e9' }}><CheckCircle2 size={22} color="#2e7d32" /></div>
              <div className={styles.statInfo}>
                <span className={styles.statValor} style={{ color: '#2e7d32' }}>{statsAcompanhamento.pctRealizada}%</span>
                <span className={styles.statLabel}>Realizadas ({statsAcompanhamento.realizadas})</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcone} style={{ background: '#fff3e0' }}><Clock size={22} color="#e65100" /></div>
              <div className={styles.statInfo}>
                <span className={styles.statValor} style={{ color: '#e65100' }}>{statsAcompanhamento.pctPendente}%</span>
                <span className={styles.statLabel}>Pendentes ({statsAcompanhamento.pendentes})</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcone} style={{ background: '#ffebee' }}><XCircle size={22} color="#c62828" /></div>
              <div className={styles.statInfo}>
                <span className={styles.statValor} style={{ color: '#c62828' }}>{statsAcompanhamento.pctNaoExec}%</span>
                <span className={styles.statLabel}>Não Executadas ({statsAcompanhamento.naoExec})</span>
              </div>
            </div>
          </div>

          {/* Barra de progresso geral */}
          {statsAcompanhamento.total > 0 && (
            <Card padding="md">
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Progresso Geral</h4>
              <div className={styles.progressBar}>
                <div className={styles.progressSegment} style={{ width: `${statsAcompanhamento.pctRealizada}%`, background: '#43a047' }} />
                <div className={styles.progressSegment} style={{ width: `${statsAcompanhamento.pctPendente}%`, background: '#fb8c00' }} />
                <div className={styles.progressSegment} style={{ width: `${statsAcompanhamento.pctNaoExec}%`, background: '#e53935' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--cor-texto-secundario)' }}>
                <span>🟢 Realizadas {statsAcompanhamento.pctRealizada}%</span>
                <span>🟠 Pendentes {statsAcompanhamento.pctPendente}%</span>
                <span>🔴 Não Exec. {statsAcompanhamento.pctNaoExec}%</span>
              </div>
            </Card>
          )}

          {/* Por funcionário */}
          <Card padding="md">
            <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Desempenho por Funcionário</h4>
            {porFuncionario.length === 0 ? (
              <p className={styles.empty}>Nenhuma execução registrada no período.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {porFuncionario.map(f => {
                  const pct = f.total > 0 ? Math.round((f.realizadas / f.total) * 100) : 0;
                  return (
                    <div key={f.nome} className={styles.funcionarioCard}>
                      <div className={styles.funcionarioHeader}>
                        <span className={styles.funcionarioNome}><User size={14} /> {f.nome}</span>
                        <span className={styles.funcionarioPercent} style={{ color: pct >= 70 ? '#2e7d32' : pct >= 40 ? '#e65100' : '#c62828' }}>{pct}%</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressSegment} style={{ width: `${f.total > 0 ? (f.realizadas / f.total) * 100 : 0}%`, background: '#43a047' }} />
                        <div className={styles.progressSegment} style={{ width: `${f.total > 0 ? (f.pendentes / f.total) * 100 : 0}%`, background: '#fb8c00' }} />
                        <div className={styles.progressSegment} style={{ width: `${f.total > 0 ? (f.nao / f.total) * 100 : 0}%`, background: '#e53935' }} />
                      </div>
                      <div className={styles.funcionarioStats}>
                        <span className={styles.funcionarioStatItem}><CheckCircle2 size={12} color="#2e7d32" /> {f.realizadas} realizadas</span>
                        <span className={styles.funcionarioStatItem}><Clock size={12} color="#e65100" /> {f.pendentes} pendentes</span>
                        <span className={styles.funcionarioStatItem}><XCircle size={12} color="#c62828" /> {f.nao} não exec.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Lista de execuções individuais */}
          {execucoesFiltradas.length > 0 && (
            <Card padding="md">
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Execuções Registradas</h4>
              <div className={styles.tarefasList}>
                {execucoesFiltradas.slice().reverse().map(ex => (
                  <div key={ex.id} className={styles.execucaoRegistrada}>
                    <div className={styles.execucaoRegistradaHeader}>
                      {ex.status === 'realizada' ? <CheckCircle2 size={16} /> : ex.status === 'pendente' ? <Clock size={16} color="#e65100" /> : <XCircle size={16} color="#c62828" />}
                      {ex.funcionarioNome} — {ex.status === 'realizada' ? 'Realizada' : ex.status === 'pendente' ? 'Pendente' : 'Não Executada'}
                    </div>
                    {ex.observacao && <span className={styles.execucaoDetalhe}><FileText size={12} /> {ex.observacao}</span>}
                    <span className={styles.execucaoDetalhe}><Clock size={12} /> {new Date(ex.dataExecucao).toLocaleDateString('pt-BR')} às {ex.horaExecucao}</span>
                    {ex.endereco && <span className={styles.execucaoDetalhe}><MapPin size={12} /> {ex.endereco}</span>}
                    {ex.fotos.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        {ex.fotos.map((f, i) => <img key={i} src={f} alt="" className={styles.fotoThumb} />)}
                      </div>
                    )}
                    {ex.audioUrl && <audio controls src={ex.audioUrl} className={styles.audioPlayer} />}
                    {ex.reporteProblema && <span className={styles.execucaoDetalhe} style={{ color: '#c62828' }}><AlertTriangle size={12} /> Problema: {ex.reporteProblema}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   CARD DE TAREFA INDIVIDUAL
═══════════════════════════════════════ */
const TarefaCardItem: React.FC<{
  tarefa: TarefaAgendada;
  execucoes: ExecucaoTarefa[];
  setExecucoes: React.Dispatch<React.SetStateAction<ExecucaoTarefa[]>>;
  isSupervisor: boolean;
  usuario: any;
  onExcluir: () => void;
  prioridadeLabel: Record<string, string>;
  recorrenciaLabel: Record<string, string>;
}> = ({ tarefa, execucoes, setExecucoes, isSupervisor, usuario, onExcluir, prioridadeLabel, recorrenciaLabel }) => {
  const { tentarAcao } = useDemo();
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState<StatusExecucao | ''>('');
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [geo, setGeo] = useState<{ lat: number; lon: number; endereco: string } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [reporteAberto, setReporteAberto] = useState(false);
  const [reporteTexto, setReporteTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const execucaoExistente = execucoes.find(e => e.tarefaId === tarefa.id && e.dataExecucao === new Date().toISOString().split('T')[0]);

  const capturarGeo = useCallback(async () => {
    if (geo) return;
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
      const end = await buscarEndereco(pos.coords.latitude, pos.coords.longitude);
      setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude, endereco: end });
    } catch {
      setGeo({ lat: 0, lon: 0, endereco: 'Localização indisponível' });
    }
    setGeoLoading(false);
  }, [geo]);

  useEffect(() => {
    if (aberto && !geo) capturarGeo();
  }, [aberto, geo, capturarGeo]);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const erro = validarImagem(file);
      if (erro) { alert(erro); return; }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setFotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => {
        setTempoGravacao(prev => {
          if (prev >= 29) {
            pararGravacao();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch { /* mic not available */ }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setGravando(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const salvarExecucao = async () => {
    if (!tentarAcao()) return;
    if (!status) return;
    setSalvando(true);
    const agora = new Date();
    try {
      const nova = await tarefasApi.addExecucao(tarefa.id, {
        funcionarioId: usuario?.id || 'unknown',
        funcionarioNome: usuario?.nome || 'Não identificado',
        status,
        fotos,
        observacao,
        audioUrl,
        dataExecucao: agora.toISOString().split('T')[0],
        horaExecucao: agora.toLocaleTimeString('pt-BR'),
        latitude: geo?.lat,
        longitude: geo?.lon,
        endereco: geo?.endereco,
        reporteProblema: reporteTexto || undefined,
      }) as ExecucaoTarefa;
      setExecucoes(prev => [...prev, nova]);
    } catch (err) { console.error(err); }
    setAberto(false);
    setSalvando(false);
  };

  const prioridadeCor: Record<string, string> = { baixa: '#43a047', media: '#fb8c00', alta: '#e65100', urgente: '#c62828' };

  return (
    <div className={styles.tarefaCard}>
      <div className={styles.tarefaHeader}>
        <div>
          <h4 className={styles.tarefaTitulo}>{tarefa.titulo}</h4>
          {tarefa.descricao && <p className={styles.tarefaDescricao}>{tarefa.descricao}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={styles.statusBadge} style={{ background: prioridadeCor[tarefa.prioridade] + '18', color: prioridadeCor[tarefa.prioridade] }}>
            {prioridadeLabel[tarefa.prioridade]}
          </span>
          {execucaoExistente && (
            <span className={`${styles.statusBadge} ${execucaoExistente.status === 'realizada' ? styles.statusRealizada : execucaoExistente.status === 'pendente' ? styles.statusPendente : styles.statusNaoExecutada}`}>
              {execucaoExistente.status === 'realizada' ? 'Realizada' : execucaoExistente.status === 'pendente' ? 'Pendente' : 'Não Exec.'}
            </span>
          )}
        </div>
      </div>

      <div className={styles.tarefaMeta}>
        <span className={styles.tarefaMetaItem}><User size={13} /> {tarefa.funcionarioNome}</span>
        <span className={styles.tarefaMetaItem}><Building2 size={13} /> {tarefa.condominio}{tarefa.bloco ? ` / ${tarefa.bloco}` : ''}</span>
        {tarefa.local && <span className={styles.tarefaMetaItem}><MapPin size={13} /> {tarefa.local}</span>}
        <span className={styles.tarefaMetaItem}><Calendar size={13} /> {recorrenciaLabel[tarefa.recorrencia]}
          {tarefa.recorrencia === 'unica' && tarefa.dataEspecifica ? ` — ${new Date(tarefa.dataEspecifica + 'T00:00').toLocaleDateString('pt-BR')}` : ''}
          {tarefa.recorrencia === 'semanal' ? ` — ${tarefa.diasSemana.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ')}` : ''}
          {tarefa.recorrencia === 'mensal' ? ` — Dia ${tarefa.diaMes}` : ''}
        </span>
      </div>

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!execucaoExistente && (
          <button className={styles.btnPrimario} onClick={() => setAberto(!aberto)} style={{ fontSize: 13, padding: '7px 16px' }}>
            {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {aberto ? 'Fechar' : 'Registrar Execução'}
          </button>
        )}
        {isSupervisor && (
          <button className={styles.reportBtn} onClick={onExcluir}>
            <Trash2 size={13} /> Excluir
          </button>
        )}
        <WhatsAppShare mensagem={`*Tarefa*\n*Título:* ${tarefa.titulo}\n*Descrição:* ${tarefa.descricao || 'N/A'}\n*Funcionário:* ${tarefa.funcionarioNome || 'N/A'}\n*Local:* ${tarefa.local || 'N/A'}\n*Prioridade:* ${prioridadeLabel[tarefa.prioridade] || tarefa.prioridade}\n*Recorrência:* ${recorrenciaLabel[tarefa.recorrencia] || tarefa.recorrencia}`} />
      </div>

      {/* ═══ Execução ═══ */}
      {aberto && !execucaoExistente && (
        <div className={styles.execucaoArea}>
          <h5 className={styles.execucaoTitulo}><ClipboardList size={16} /> Registrar Execução</h5>

          {/* Status */}
          <div className={styles.statusBotoes}>
            {(['realizada', 'pendente', 'nao_executada'] as StatusExecucao[]).map(s => (
              <button key={s} className={`${styles.statusBtn} ${status === s ? styles.statusBtnAtivo : ''}`} onClick={() => setStatus(s)}>
                {s === 'realizada' ? <CheckCircle2 size={14} /> : s === 'pendente' ? <Clock size={14} /> : <XCircle size={14} />}
                {s === 'realizada' ? 'Realizada' : s === 'pendente' ? 'Pendente' : 'Não Executada'}
              </button>
            ))}
          </div>

          {/* Foto */}
          <div className={styles.fotoArea}>
            <label className={styles.formLabel}>Fotos</label>
            {fotos.length > 0 && (
              <div className={styles.fotoPreview}>
                {fotos.map((f, i) => <img key={i} src={f} alt="" className={styles.fotoThumb} />)}
              </div>
            )}
            <label className={styles.fotoInputLabel}>
              <Camera size={16} /> Tirar / Selecionar Foto
              <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFoto} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Observação escrita */}
          <div className={styles.formGrupo}>
            <label className={styles.formLabel}>Observações</label>
            <textarea className={styles.formTextarea} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Descreva o que foi feito ou qualquer observação..." />
          </div>

          {/* Áudio 30s */}
          <div className={styles.audioArea}>
            <label className={styles.formLabel}>Áudio (máx. 30s)</label>
            <div className={styles.audioBotoes}>
              {!gravando ? (
                <button type="button" className={styles.audioBtnGravar} onClick={iniciarGravacao} disabled={!!audioUrl}>
                  <Mic size={14} /> Gravar
                </button>
              ) : (
                <>
                  <button type="button" className={styles.audioBtnParar} onClick={pararGravacao}>
                    <MicOff size={14} /> Parar
                  </button>
                  <span className={styles.audioPulse} />
                  <span className={styles.audioTimer}>{tempoGravacao}s / 30s</span>
                </>
              )}
              {audioUrl && !gravando && (
                <button type="button" className={styles.btnSecundario} style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setAudioUrl(undefined); setTempoGravacao(0); }}>
                  Regravar
                </button>
              )}
            </div>
            {audioUrl && <audio controls src={audioUrl} className={styles.audioPlayer} />}
          </div>

          {/* Reportar problema */}
          <div>
            <button className={styles.reportBtn} onClick={() => setReporteAberto(!reporteAberto)}>
              <AlertTriangle size={13} /> Reportar Problema
            </button>
            {reporteAberto && (
              <div className={styles.reportArea} style={{ marginTop: 8 }}>
                <label className={styles.formLabel}>Descreva o problema</label>
                <textarea className={styles.formTextarea} value={reporteTexto} onChange={e => setReporteTexto(e.target.value)} placeholder="Descreva o problema encontrado..." />
              </div>
            )}
          </div>

          {/* Geolocalização */}
          <div className={styles.geoInfo}>
            <span className={styles.geoItem}><MapPin size={13} /> {geoLoading ? 'Obtendo localização...' : geo?.endereco || 'Localização indisponível'}</span>
            <span className={styles.geoItem}><Clock size={13} /> {new Date().toLocaleString('pt-BR')}</span>
            <span className={styles.geoItem}><User size={13} /> {usuario?.nome || 'Não identificado'}</span>
          </div>

          {/* Salvar */}
          <button className={styles.btnSalvar} onClick={salvarExecucao} disabled={!status || salvando}>
            <Save size={16} /> Salvar Execução
          </button>
        </div>
      )}

      {/* Execução já registrada hoje */}
      {execucaoExistente && (
        <div className={styles.execucaoRegistrada}>
          <div className={styles.execucaoRegistradaHeader}>
            <CheckCircle2 size={16} /> Execução registrada hoje
          </div>
          {execucaoExistente.observacao && <span className={styles.execucaoDetalhe}><FileText size={12} /> {execucaoExistente.observacao}</span>}
          <span className={styles.execucaoDetalhe}><Clock size={12} /> {execucaoExistente.horaExecucao}</span>
          {execucaoExistente.endereco && <span className={styles.execucaoDetalhe}><MapPin size={12} /> {execucaoExistente.endereco}</span>}
          {execucaoExistente.fotos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {execucaoExistente.fotos.map((f, i) => <img key={i} src={f} alt="" className={styles.fotoThumb} />)}
            </div>
          )}
          {execucaoExistente.audioUrl && <audio controls src={execucaoExistente.audioUrl} className={styles.audioPlayer} />}
          {execucaoExistente.reporteProblema && <span className={styles.execucaoDetalhe} style={{ color: '#c62828' }}><AlertTriangle size={12} /> {execucaoExistente.reporteProblema}</span>}
        </div>
      )}
    </div>
  );
};

export default TarefasPage;
