import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_HIERARCHY } from '../../types';
import type { UserRole } from '../../types';
import PageHeader from '../../components/Common/PageHeader';
import HowItWorks from '../../components/Common/HowItWorks';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Plus, Search, Filter, MoreVertical, X, Save,
  Columns3, List, Settings2, Clock, Trash2, Edit3,
  CircleDot, ArrowRight, CalendarDays, Repeat,
  AlertTriangle, ChevronDown, GripVertical, History,
  Inbox, CheckCircle2, Eye, RotateCcw, Star
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { quadroAtividades as qaApi, configuracoes as configApi, condominios as condominiosApi } from '../../services/api';
import styles from './QuadroAtividades.module.css';

/* ============================================================
   Types
============================================================ */
type StatusAtividade = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluido';
type Prioridade = 'urgente' | 'alta' | 'media' | 'baixa';
type Rotina = 'diaria' | 'semanal' | 'mensal' | 'anual' | 'data_especifica';

interface RegistroAlteracao {
  id: string;
  data: string;       // ISO
  usuario: string;
  statusAnterior: StatusAtividade;
  statusNovo: StatusAtividade;
}

interface Atividade {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusAtividade;
  prioridade: Prioridade;
  rotina: Rotina;
  dataEspecifica?: string;
  responsavel: string;
  condominio: string;
  criadoPor: string;
  criadoEm: string;
  historico: RegistroAlteracao[];
}

interface PermissaoQuadro {
  cadastrar: Record<UserRole, boolean>;
  editar: Record<UserRole, boolean>;
  excluir: Record<UserRole, boolean>;
}

/* ============================================================
   Constants
============================================================ */

const STATUS_LABELS: Record<StatusAtividade, string> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
};

const STATUS_ORDER: StatusAtividade[] = ['a_fazer', 'em_andamento', 'em_revisao', 'concluido'];

const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

const ROTINA_LABELS: Record<Rotina, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
  data_especifica: 'Data Específica',
};

const PERM_PADRAO: PermissaoQuadro = {
  cadastrar: { master: true, administrador: true, supervisor: true, funcionario: false },
  editar: { master: true, administrador: true, supervisor: true, funcionario: false },
  excluir: { master: true, administrador: true, supervisor: false, funcionario: false },
};

/* ============================================================
   Helpers
============================================================ */
function gerarId() {
  return `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}



function iniciais(nome: string): string {
  return nome.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ============================================================
   Component
============================================================ */
const QuadroAtividadesPage: React.FC = () => {
  const { usuario } = useAuth();
  const role = usuario?.role || 'funcionario';
  const nivel = ROLE_HIERARCHY[role];
  const { tentarAcao } = useDemo();

  /* ---- State ---- */
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [permissoes, setPermissoes] = useState<PermissaoQuadro>(PERM_PADRAO);
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [busca, setBusca] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | ''>('');
  const [filtroRotina, setFiltroRotina] = useState<Rotina | ''>('');
  const [loading, setLoading] = useState(true);
  const [condominios, setCondominios] = useState<string[]>([]);

  // Modals
  const [modalForm, setModalForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalHistorico, setModalHistorico] = useState<Atividade | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form fields
  const [fTitulo, setFTitulo] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fPrioridade, setFPrioridade] = useState<Prioridade>('media');
  const [fRotina, setFRotina] = useState<Rotina>('diaria');
  const [fDataEspecifica, setFDataEspecifica] = useState('');
  const [fResponsavel, setFResponsavel] = useState('');
  const [fCondominio, setFCondominio] = useState('');
  const [fStatus, setFStatus] = useState<StatusAtividade>('a_fazer');

  // Drag
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<StatusAtividade | null>(null);

  // Card dropdown
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const condominiosMemo = condominios;

  useEffect(() => {
    Promise.all([
      qaApi.list().catch(() => []),
      configApi.getQuadroPermissoes().catch(() => PERM_PADRAO),
      condominiosApi.list().catch(() => []),
    ]).then(([atv, perm, conds]: any) => {
      setAtividades(atv.map((a: any) => ({
        id: a.id,
        titulo: a.titulo,
        descricao: a.descricao || '',
        status: a.status || 'a_fazer',
        prioridade: a.prioridade || 'media',
        rotina: a.rotina || 'diaria',
        dataEspecifica: a.dataEspecifica,
        responsavel: a.responsavel || '',
        condominio: a.condominio || '',
        criadoPor: a.criadoPor || 'Sistema',
        criadoEm: a.criadoEm || new Date().toISOString(),
        historico: a.historico || [],
      })));
      setPermissoes(perm.cadastrar ? perm : PERM_PADRAO);
      setCondominios(conds.map((c: any) => c.nome).filter(Boolean));
    }).finally(() => setLoading(false));
  }, []);

  /* ---- Close dropdown on outside click ---- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---- Permissions ---- */
  const podeCadastrar = permissoes.cadastrar[role] ?? false;
  const podeEditar = permissoes.editar[role] ?? false;
  const podeExcluir = permissoes.excluir[role] ?? false;
  const podeConfigurar = nivel >= ROLE_HIERARCHY.administrador;

  /* ---- Filtered data ---- */
  const atividadesFiltradas = useMemo(() => {
    let list = atividades;
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(a =>
        a.titulo.toLowerCase().includes(q) ||
        a.descricao.toLowerCase().includes(q) ||
        a.responsavel.toLowerCase().includes(q) ||
        a.condominio.toLowerCase().includes(q)
      );
    }
    if (filtroPrioridade) list = list.filter(a => a.prioridade === filtroPrioridade);
    if (filtroRotina) list = list.filter(a => a.rotina === filtroRotina);
    return list;
  }, [atividades, busca, filtroPrioridade, filtroRotina]);

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const s = { a_fazer: 0, em_andamento: 0, em_revisao: 0, concluido: 0 };
    atividades.forEach(a => { s[a.status]++; });
    return s;
  }, [atividades]);

  /* ---- Open form helpers ---- */
  const abrirNovo = () => {
    setEditandoId(null);
    setFTitulo(''); setFDescricao(''); setFPrioridade('media'); setFRotina('diaria');
    setFDataEspecifica(''); setFResponsavel(''); setFCondominio(condominios[0] || '');
    setFStatus('a_fazer');
    setModalForm(true);
  };

  const abrirEditar = (a: Atividade) => {
    if (!tentarAcao()) return;
    setEditandoId(a.id);
    setFTitulo(a.titulo); setFDescricao(a.descricao); setFPrioridade(a.prioridade);
    setFRotina(a.rotina); setFDataEspecifica(a.dataEspecifica || '');
    setFResponsavel(a.responsavel); setFCondominio(a.condominio);
    setFStatus(a.status);
    setModalForm(true);
    setDropdownOpen(null);
  };

  /* ---- Save ---- */
  const salvar = async () => {
    if (!tentarAcao()) return;
    if (!fTitulo.trim()) return;
    const agora = new Date().toISOString();

    if (editandoId) {
      const a = atividades.find(x => x.id === editandoId);
      if (!a) return;
      const mudouStatus = a.status !== fStatus;
      const hist = mudouStatus
        ? [...a.historico, { id: gerarId(), data: agora, usuario: usuario?.nome || 'Usuário', statusAnterior: a.status, statusNovo: fStatus }]
        : a.historico;
      const updated = { titulo: fTitulo.trim(), descricao: fDescricao.trim(), prioridade: fPrioridade, rotina: fRotina, dataEspecifica: fRotina === 'data_especifica' ? fDataEspecifica : undefined, responsavel: fResponsavel.trim(), condominio: fCondominio, status: fStatus, historico: hist };
      try {
        await qaApi.update(editandoId, updated);
        setAtividades(prev => prev.map(x => x.id === editandoId ? { ...x, ...updated } : x));
      } catch {}
    } else {
      const nova = {
        titulo: fTitulo.trim(), descricao: fDescricao.trim(),
        status: fStatus, prioridade: fPrioridade, rotina: fRotina,
        dataEspecifica: fRotina === 'data_especifica' ? fDataEspecifica : undefined,
        responsavel: fResponsavel.trim(), condominio: fCondominio,
      };
      try {
        const created = await qaApi.create(nova);
        setAtividades(prev => [{ ...created, historico: created.historico || [], criadoPor: created.criadoPor || usuario?.nome || 'Sistema', criadoEm: created.criadoEm || agora }, ...prev]);
      } catch {}
    }
    setModalForm(false);
  };

  /* ---- Delete ---- */
  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await qaApi.remove(id);
      setAtividades(prev => prev.filter(a => a.id !== id));
    } catch {}
    setConfirmDelete(null);
    setDropdownOpen(null);
  };

  /* ---- Drag & Drop (status change — allowed for ALL) ---- */
  const handleDragStart = (id: string) => { setDragId(id); };
  const handleDragEnd = () => { setDragId(null); setDragOverCol(null); };

  const handleDragOver = (e: React.DragEvent, status: StatusAtividade) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => { setDragOverCol(null); };

  const handleDrop = (e: React.DragEvent, novoStatus: StatusAtividade) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragId) return;
    if (!tentarAcao()) return;
    const agora = new Date().toISOString();
    setAtividades(prev => prev.map(a => {
      if (a.id !== dragId || a.status === novoStatus) return a;
      qaApi.updateStatus(a.id, novoStatus).catch(() => {});
      return {
        ...a,
        status: novoStatus,
        historico: [...a.historico, {
          id: gerarId(), data: agora, usuario: usuario?.nome || 'Usuário',
          statusAnterior: a.status, statusNovo: novoStatus,
        }],
      };
    }));
    setDragId(null);
  };

  /* ---- Save permissions ---- */
  const salvarConfig = async () => {
    if (!tentarAcao()) return;
    try { await configApi.setQuadroPermissoes(permissoes); } catch {}
    setModalConfig(false);
  };

  const togglePerm = (tipo: 'cadastrar' | 'editar' | 'excluir', role: UserRole) => {
    if (!tentarAcao()) return;
    setPermissoes(prev => ({
      ...prev,
      [tipo]: { ...prev[tipo], [role]: !prev[tipo][role] },
    }));
  };

  /* ---- Priority sort helper ---- */
  const prioSort: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

  /* ---- Render helpers ---- */
  const prioClass = (p: Prioridade) => {
    const map: Record<Prioridade, string> = { urgente: styles.prioUrgente, alta: styles.prioAlta, media: styles.prioMedia, baixa: styles.prioBaixa };
    return map[p];
  };

  const statusClass = (s: StatusAtividade) => {
    const map: Record<StatusAtividade, string> = { a_fazer: styles.statusAFazer, em_andamento: styles.statusEmAndamento, em_revisao: styles.statusEmRevisao, concluido: styles.statusConcluido };
    return map[s];
  };

  const dotClass = (s: StatusAtividade) => {
    const map: Record<StatusAtividade, string> = { a_fazer: styles.dotAFazer, em_andamento: styles.dotEmAndamento, em_revisao: styles.dotEmRevisao, concluido: styles.dotConcluido };
    return map[s];
  };

  const headerClass = (s: StatusAtividade) => {
    const map: Record<StatusAtividade, string> = { a_fazer: styles.headerAFazer, em_andamento: styles.headerEmAndamento, em_revisao: styles.headerEmRevisao, concluido: styles.headerConcluido };
    return map[s];
  };

  const iconClass = (s: StatusAtividade) => {
    const map: Record<StatusAtividade, string> = { a_fazer: styles.iconAFazer, em_andamento: styles.iconEmAndamento, em_revisao: styles.iconEmRevisao, concluido: styles.iconConcluido };
    return map[s];
  };

  /* ============================================================
     JSX
  ============================================================ */
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  return (
    <div id="quadro-content" className={styles.container}>
      <PageHeader
        titulo="Quadro de Atividades"
        subtitulo="Gerencie atividade da equipe de forma visual e organizada"
        onCompartilhar={() => compartilharConteudo('Quadro de Atividades', 'Quadro de gerenciamento visual de atividades da equipe.')}
        onImprimir={() => imprimirElemento('quadro-content')}
        onGerarPdf={() => gerarPdfDeElemento('quadro-content', 'quadro-atividades')}
      />

      <HowItWorks
        titulo="Quadro de Atividades"
        descricao="Organize a atividades da equipe em colunas de status, defina prioridades e rotinas, e acompanhe todo o histórico de mudanças."
        passos={[
          'Crie atividades com título, prioridade, rotina e responsável',
          'Arraste os cartões entre as colunas para mudar o status',
          'Acompanhe o histórico completo de cada atividade',
          'Administradores configuram quem pode cadastrar, editar e excluir',
        ]}
      />

      {/* ===== Resumo ===== */}
      <div className={styles.resumoGrid}>
        {STATUS_ORDER.map(s => (
          <div className={styles.resumoCard} key={s}>
            <div className={`${styles.resumoIcon} ${iconClass(s)}`}>
              {s === 'a_fazer' && <Inbox size={22} />}
              {s === 'em_andamento' && <RotateCcw size={22} />}
              {s === 'em_revisao' && <Eye size={22} />}
              {s === 'concluido' && <CheckCircle2 size={22} />}
            </div>
            <div className={styles.resumoInfo}>
              <h4>{stats[s]}</h4>
              <span>{STATUS_LABELS[s]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Toolbar ===== */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input placeholder="Buscar atividade..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <select className={styles.filterSelect} value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value as Prioridade | '')}>
          <option value="">Todas Prioridades</option>
          {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className={styles.filterSelect} value={filtroRotina} onChange={e => setFiltroRotina(e.target.value as Rotina | '')}>
          <option value="">Todas Rotinas</option>
          {Object.entries(ROTINA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'kanban' ? styles.active : ''}`} onClick={() => setView('kanban')}><Columns3 size={15} /> Kanban</button>
          <button className={`${styles.viewBtn} ${view === 'lista' ? styles.active : ''}`} onClick={() => setView('lista')}><List size={15} /> Lista</button>
        </div>

        {podeConfigurar && (
          <button className={styles.btnConfig} onClick={() => setModalConfig(true)}>
            <Settings2 size={15} /> Permissões
          </button>
        )}

        {podeCadastrar && (
          <button className={styles.btnNovo} onClick={abrirNovo}>
            <Plus size={16} /> Nova Atividade
          </button>
        )}
      </div>

      {/* ===== Board / List ===== */}
      {view === 'kanban' ? (
        <div className={styles.board}>
          {STATUS_ORDER.map(status => {
            const cards = atividadesFiltradas
              .filter(a => a.status === status)
              .sort((a, b) => prioSort[a.prioridade] - prioSort[b.prioridade]);

            return (
              <div
                key={status}
                className={`${styles.column} ${dragOverCol === status ? styles.dragOver : ''}`}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}
              >
                <div className={`${styles.columnHeader} ${headerClass(status)}`}>
                  <div className={styles.columnTitle}>
                    <span className={`${styles.columnDot} ${dotClass(status)}`} />
                    <h3>{STATUS_LABELS[status]}</h3>
                  </div>
                  <span className={styles.columnCount}>{cards.length}</span>
                </div>

                <div className={styles.columnBody}>
                  {cards.length === 0 ? (
                    <div className={styles.emptyColumn}>
                      <Inbox size={28} />
                      <span>Arraste atividades<br />para esta coluna</span>
                    </div>
                  ) : (
                    cards.map(a => (
                      <div
                        key={a.id}
                        className={`${styles.card} ${dragId === a.id ? styles.dragging : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(a.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className={styles.cardTopRow}>
                          <span className={styles.cardTitle}>{a.titulo}</span>
                          <button className={styles.cardMenu} onClick={() => setDropdownOpen(dropdownOpen === a.id ? null : a.id)}>
                            <MoreVertical size={14} />
                          </button>
                        </div>

                        {a.descricao && <div className={styles.cardDesc}>{a.descricao}</div>}

                        <div className={styles.cardTags}>
                          <span className={`${styles.tagPrioridade} ${prioClass(a.prioridade)}`}>
                            {PRIORIDADE_LABELS[a.prioridade]}
                          </span>
                          <span className={styles.tagRotina}>
                            <Repeat size={10} />
                            {ROTINA_LABELS[a.rotina]}
                          </span>
                        </div>

                        <div className={styles.cardFooter}>
                          <div className={styles.cardResponsavel}>
                            <span className={styles.avatar}>{iniciais(a.responsavel || 'US')}</span>
                            {a.responsavel || 'Sem responsável'}
                          </div>
                          <div className={styles.cardData}>
                            <CalendarDays size={11} />
                            {formatarData(a.criadoEm)}
                          </div>
                        </div>

                        {/* Dropdown */}
                        {dropdownOpen === a.id && (
                          <div className={styles.cardDropdown} ref={dropdownRef}>
                            <button className={styles.dropdownItem} onClick={() => { setModalHistorico(a); setDropdownOpen(null); }}>
                              <History size={14} /> Histórico
                            </button>
                            {podeEditar && (
                              <button className={styles.dropdownItem} onClick={() => abrirEditar(a)}>
                                <Edit3 size={14} /> Editar
                              </button>
                            )}
                            {podeExcluir && (
                              <button className={styles.dropdownItemDanger} onClick={() => { setConfirmDelete(a.id); setDropdownOpen(null); }}>
                                <Trash2 size={14} /> Excluir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== List View ===== */
        <div className={styles.listView}>
          {atividadesFiltradas.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox size={48} />
              <h4>Nenhuma atividade encontrada</h4>
              <p>Crie sua primeira atividade clicando em sNova Atividades.</p>
            </div>
          ) : (
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Rotina</th>
                  <th>Responsável</th>
                  <th>Condomínio</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atividadesFiltradas
                  .sort((a, b) => prioSort[a.prioridade] - prioSort[b.prioridade])
                  .map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.titulo}</strong></td>
                      <td><span className={`${styles.statusBadge} ${statusClass(a.status)}`}>{STATUS_LABELS[a.status]}</span></td>
                      <td><span className={`${styles.tagPrioridade} ${prioClass(a.prioridade)}`}>{PRIORIDADE_LABELS[a.prioridade]}</span></td>
                      <td>{ROTINA_LABELS[a.rotina]}</td>
                      <td>{a.responsavel || '—'}</td>
                      <td>{a.condominio || '—'}</td>
                      <td>{formatarData(a.criadoEm)}</td>
                      <td>
                        <div className={styles.listActions}>
                          <button className={styles.actionBtn} onClick={() => setModalHistorico(a)} title="Histórico"><History size={15} /></button>
                          {podeEditar && <button className={styles.actionBtn} onClick={() => abrirEditar(a)} title="Editar"><Edit3 size={15} /></button>}
                          {podeExcluir && <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setConfirmDelete(a.id)} title="Excluir"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== Modal Form (Criar / Editar) ===== */}
      {modalForm && (
        <div className={styles.overlay} onClick={() => setModalForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editandoId ? 'Editar Atividade' : 'Nova Atividade'}</h3>
              <button className={styles.modalClose} onClick={() => setModalForm(false)}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Título *</label>
                <input value={fTitulo} onChange={e => setFTitulo(e.target.value)} placeholder="Ex: Limpeza da piscina" />
              </div>

              <div className={styles.formGroup}>
                <label>Descrição</label>
                <textarea value={fDescricao} onChange={e => setFDescricao(e.target.value)} placeholder="Detalhe da atividade..." rows={3} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Prioridade</label>
                  <select value={fPrioridade} onChange={e => setFPrioridade(e.target.value as Prioridade)}>
                    {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value as StatusAtividade)}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Rotina</label>
                  <select value={fRotina} onChange={e => setFRotina(e.target.value as Rotina)}>
                    {Object.entries(ROTINA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {fRotina === 'data_especifica' && (
                  <div className={styles.formGroup}>
                    <label>Data</label>
                    <input type="date" value={fDataEspecifica} onChange={e => setFDataEspecifica(e.target.value)} />
                  </div>
                )}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Responsável</label>
                  <input value={fResponsavel} onChange={e => setFResponsavel(e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div className={styles.formGroup}>
                  <label>Condomínio</label>
                  <select value={fCondominio} onChange={e => setFCondominio(e.target.value)}>
                    <option value="">Selecione...</option>
                    {condominios.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={() => setModalForm(false)}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={salvar} disabled={!fTitulo.trim()}>
                <Save size={15} /> {editandoId ? 'Salvar' : 'Criar Atividade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Configurar Permissões ===== */}
      {modalConfig && (
        <div className={styles.overlay} onClick={() => setModalConfig(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Configurar Permissões</h3>
              <button className={styles.modalClose} onClick={() => setModalConfig(false)}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--cor-texto-secundario)', margin: 0 }}>
                Defina quais perfis podem cadastrar, editar e excluir atividades. A mudança de status é permitida para todos os perfis.
              </p>

              {(['cadastrar', 'editar', 'excluir'] as const).map(tipo => (
                <div key={tipo} className={styles.permRow}>
                  <span className={styles.permLabel}>
                    {tipo === 'cadastrar' ? '📝 Cadastrar' : tipo === 'editar' ? '✏️ Editar' : '🗑️ Excluir'}
                  </span>
                  <div className={styles.permToggles}>
                    {(['master', 'administrador', 'supervisor', 'funcionario'] as UserRole[]).map(r => (
                      <label key={r} className={styles.permToggle}>
                        <input type="checkbox" checked={permissoes[tipo][r]} onChange={() => togglePerm(tipo, r)} />
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={() => setModalConfig(false)}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={salvarConfig}>
                <Save size={15} /> Salvar Permissões
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Histórico ===== */}
      {modalHistorico && (
        <div className={styles.overlay} onClick={() => setModalHistorico(null)}>
          <div className={styles.modalLarge} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Histórico — {modalHistorico.titulo}</h3>
              <button className={styles.modalClose} onClick={() => setModalHistorico(null)}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--cor-texto-secundario)', margin: 0 }}>
                Criado por <strong>{modalHistorico.criadoPor}</strong> em {formatarDataHora(modalHistorico.criadoEm)}
              </p>

              {modalHistorico.historico.length === 0 ? (
                <div className={styles.emptyState} style={{ padding: '32px 0' }}>
                  <History size={36} />
                  <h4>Sem alterações de status</h4>
                  <p>Nenhuma mudança de status registrada ainda.</p>
                </div>
              ) : (
                <div className={styles.logList}>
                  {[...modalHistorico.historico].reverse().map(h => (
                    <div key={h.id} className={styles.logItem}>
                      <div className={styles.logIcon}>
                        <ArrowRight size={16} />
                      </div>
                      <div className={styles.logContent}>
                        <strong>{h.usuario}</strong>
                        <p>
                          <span className={styles.logArrow}>
                            <span className={`${styles.from} ${statusClass(h.statusAnterior)}`}>{STATUS_LABELS[h.statusAnterior]}</span>
                            <ArrowRight size={12} />
                            <span className={`${styles.to} ${statusClass(h.statusNovo)}`}>{STATUS_LABELS[h.statusNovo]}</span>
                          </span>
                        </p>
                      </div>
                      <span className={styles.logTime}>{formatarDataHora(h.data)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={() => setModalHistorico(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Confirm Delete ===== */}
      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <AlertTriangle size={36} color="#dc2626" style={{ marginBottom: 8 }} />
            <h4>Excluir atividade?</h4>
            <p>Esta ação não pode ser desfeita. Todos os registros de histórico serão perdidos.</p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancelar} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => excluir(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuadroAtividadesPage;
