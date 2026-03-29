import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { calendario as calendarioApi, ordensServico, planosManutencao, vencimentos as vencimentosApi, escalas as escalasApi } from '../../services/api';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Save, X, StickyNote, Settings, Mail } from 'lucide-react';
import styles from './CalendarioPage.module.css';

type CalendarEventType = 'os' | 'plano' | 'vencimento' | 'escala' | 'documento' | 'fornecedor' | 'contrato';

interface CalendarEvent {
  id: string;
  titulo: string;
  data: string;
  tipo: CalendarEventType;
  status?: string;
  prioridade?: string;
  extra?: string;
}

interface Anotacao {
  id: number;
  data: string;
  texto: string;
  cor: string;
  usuario_id?: number;
  criado_em?: string;
  atualizado_em?: string;
}

interface Legenda {
  id: number;
  cor: string;
  rotulo: string;
}

interface CalendarResponse {
  eventos?: CalendarEvent[];
  anotacoes?: Anotacao[];
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const FILTER_OPTIONS: Array<{ value: 'todos' | CalendarEventType; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'os', label: 'OS' },
  { value: 'plano', label: 'Planos' },
  { value: 'vencimento', label: 'Vencimentos' },
  { value: 'documento', label: 'Documentos' },
  { value: 'contrato', label: 'Contratos' },
  { value: 'fornecedor', label: 'Fornecedores' },
  { value: 'escala', label: 'Escalas' },
];

const EVENT_CLASS_BY_TYPE: Record<CalendarEventType, string> = {
  os: styles.eventOS,
  plano: styles.eventPlano,
  vencimento: styles.eventVencimento,
  escala: styles.eventEscala,
  documento: styles.eventDocumento,
  fornecedor: styles.eventFornecedor,
  contrato: styles.eventContrato,
};

const EVENT_LABEL_BY_TYPE: Record<CalendarEventType, string> = {
  os: 'OS',
  plano: 'Plano',
  vencimento: 'Vencimento',
  escala: 'Escala',
  documento: 'Documento',
  fornecedor: 'Fornecedor',
  contrato: 'Contrato',
};

const CORES_PADRAO = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280', '#ffffff',
];

const mesParam = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

const extrairLista = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: any[] }).data;
  }
  return [];
};

const fetchFallbackOs = async (): Promise<CalendarEvent[]> => {
  try {
    const osList = extrairLista(await ordensServico.list());
    const eventos: CalendarEvent[] = [];
    for (const os of osList) {
      if (os.dataAbertura) eventos.push({ id: os.id, titulo: os.titulo, data: os.dataAbertura.slice(0, 10), tipo: 'os', status: os.status, prioridade: os.prioridade });
      if (os.dataPrevisao) eventos.push({ id: `${os.id}-prev`, titulo: `[Previsão] ${os.titulo}`, data: os.dataPrevisao.slice(0, 10), tipo: 'os', status: os.status });
    }
    return eventos;
  } catch {
    return [];
  }
};

const fetchFallbackPlanos = async (): Promise<CalendarEvent[]> => {
  try {
    const planos = await planosManutencao.list();
    return planos
      .filter((p) => Boolean(p.proximaExecucao))
      .map((p) => ({ id: p.id, titulo: p.titulo, data: p.proximaExecucao.slice(0, 10), tipo: 'plano' as const, extra: p.frequencia }));
  } catch {
    return [];
  }
};

const fetchFallbackVencimentos = async (): Promise<CalendarEvent[]> => {
  try {
    const vencs = await vencimentosApi.list();
    return vencs
      .filter((v) => Boolean(v.dataVencimento))
      .map((v) => ({ id: v.id, titulo: v.titulo || v.descricao, data: v.dataVencimento.slice(0, 10), tipo: 'vencimento' as const, status: v.status }));
  } catch {
    return [];
  }
};

const fetchFallbackEscalas = async (): Promise<CalendarEvent[]> => {
  try {
    const escalas = await escalasApi.list();
    return escalas
      .filter((e) => Boolean(e.data))
      .map((e) => ({ id: e.id, titulo: e.titulo || `Escala - ${e.funcionarioNome || ''}`, data: e.data.slice(0, 10), tipo: 'escala' as const }));
  } catch {
    return [];
  }
};

function contrastText(hex: string): string {
  if (!hex || hex === '#ffffff') return 'var(--cor-texto)';
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

const CalendarioPage: React.FC = () => {
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [legendas, setLegendas] = useState<Legenda[]>([]);
  const [filtro, setFiltro] = useState<'todos' | CalendarEventType>('todos');
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showLegendas, setShowLegendas] = useState(false);

  // Form states for new annotation
  const [novaAnotTexto, setNovaAnotTexto] = useState('');
  const [novaAnotCor, setNovaAnotCor] = useState('#ffffff');
  const [editandoAnot, setEditandoAnot] = useState<number | null>(null);
  const [editTexto, setEditTexto] = useState('');
  const [editCor, setEditCor] = useState('');

  // Form states for legends
  const [novaLegCor, setNovaLegCor] = useState('#ef4444');
  const [novaLegRotulo, setNovaLegRotulo] = useState('');
  const [editandoLeg, setEditandoLeg] = useState<number | null>(null);
  const [editLegCor, setEditLegCor] = useState('');
  const [editLegRotulo, setEditLegRotulo] = useState('');

  // Email notification states
  const [emailsVencimento, setEmailsVencimento] = useState<string[]>([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [emailsLoading, setEmailsLoading] = useState(false);

  const loadLegendas = useCallback(async () => {
    try {
      const rows = await calendarioApi.legendas();
      if (Array.isArray(rows)) setLegendas(rows);
    } catch { /* ignore */ }
  }, []);

  const loadEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const res = await vencimentosApi.getEmails();
      if (res?.emails) setEmailsVencimento(res.emails);
    } catch { /* ignore */ }
    setEmailsLoading(false);
  }, []);

  useEffect(() => { loadLegendas(); loadEmails(); }, [loadLegendas, loadEmails]);

  useEffect(() => {
    loadEvents();
  }, [mesAtual]);

  const loadFallbackEvents = async (): Promise<CalendarEvent[]> => {
    const [os, planos, vencimentos, escalas] = await Promise.all([
      fetchFallbackOs(),
      fetchFallbackPlanos(),
      fetchFallbackVencimentos(),
      fetchFallbackEscalas(),
    ]);
    return [...os, ...planos, ...vencimentos, ...escalas];
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await calendarioApi.eventos(mesParam(mesAtual.year, mesAtual.month)) as CalendarResponse;
      if (Array.isArray(response?.eventos)) {
        setEvents(response.eventos);
        if (Array.isArray(response.anotacoes)) setAnotacoes(response.anotacoes);
        setLoading(false);
        return;
      }
    } catch { /* fallback */ }
    setEvents(await loadFallbackEvents());
    // load annotations separately as fallback
    try {
      const anots = await calendarioApi.anotacoes(mesParam(mesAtual.year, mesAtual.month));
      if (Array.isArray(anots)) setAnotacoes(anots);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const diasDoMes = useMemo(() => {
    const { year, month } = mesAtual;
    const primeiroDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const diasAntes = primeiroDia.getDay();
    const totalDias = ultimoDia.getDate();
    const dias: { date: Date; currentMonth: boolean }[] = [];

    for (let i = diasAntes - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      dias.push({ date: d, currentMonth: false });
    }
    for (let i = 1; i <= totalDias; i++) {
      dias.push({ date: new Date(year, month, i), currentMonth: true });
    }
    const restante = 42 - dias.length;
    for (let i = 1; i <= restante; i++) {
      dias.push({ date: new Date(year, month + 1, i), currentMonth: false });
    }
    return dias;
  }, [mesAtual]);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const today = formatDate(new Date());

  const filteredEvents = useMemo(() => {
    if (filtro === 'todos') return events;
    return events.filter(e => e.tipo === filtro);
  }, [events, filtro]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of filteredEvents) {
      if (!map[e.data]) map[e.data] = [];
      map[e.data].push(e);
    }
    return map;
  }, [filteredEvents]);

  const anotacoesByDate = useMemo(() => {
    const map: Record<string, Anotacao[]> = {};
    for (const a of anotacoes) {
      const d = a.data.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [anotacoes]);

  // Build a map: cor -> rotulo from legendas
  const legendaMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of legendas) map[l.cor] = l.rotulo;
    return map;
  }, [legendas]);

  const mesLabel = new Date(mesAtual.year, mesAtual.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const dayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];
  const dayAnotacoes = selectedDay ? (anotacoesByDate[selectedDay] || []) : [];

  // ── Anotação handlers ──
  const handleCriarAnotacao = async () => {
    if (!selectedDay || !novaAnotTexto.trim()) return;
    try {
      const row = await calendarioApi.criarAnotacao({ data: selectedDay, texto: novaAnotTexto.trim(), cor: novaAnotCor });
      setAnotacoes(prev => [...prev, row]);
      setNovaAnotTexto('');
      setNovaAnotCor('#ffffff');
    } catch { /* ignore */ }
  };

  const handleEditarAnotacao = async (id: number) => {
    try {
      const row = await calendarioApi.atualizarAnotacao(id, { texto: editTexto, cor: editCor });
      setAnotacoes(prev => prev.map(a => a.id === id ? { ...a, ...row } : a));
      setEditandoAnot(null);
    } catch { /* ignore */ }
  };

  const handleExcluirAnotacao = async (id: number) => {
    try {
      await calendarioApi.excluirAnotacao(id);
      setAnotacoes(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  };

  // ── Legenda handlers ──
  const handleCriarLegenda = async () => {
    if (!novaLegRotulo.trim()) return;
    try {
      const row = await calendarioApi.criarLegenda({ cor: novaLegCor, rotulo: novaLegRotulo.trim() });
      setLegendas(prev => {
        const idx = prev.findIndex(l => l.cor === row.cor);
        if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
        return [...prev, row];
      });
      setNovaLegRotulo('');
    } catch { /* ignore */ }
  };

  const handleEditarLegenda = async (id: number) => {
    try {
      const row = await calendarioApi.atualizarLegenda(id, { cor: editLegCor, rotulo: editLegRotulo });
      setLegendas(prev => prev.map(l => l.id === id ? { ...l, ...row } : l));
      setEditandoLeg(null);
    } catch { /* ignore */ }
  };

  const handleExcluirLegenda = async (id: number) => {
    try {
      await calendarioApi.excluirLegenda(id);
      setLegendas(prev => prev.filter(l => l.id !== id));
    } catch { /* ignore */ }
  };

  // ── Email handlers ──
  const handleAdicionarEmail = async () => {
    const email = novoEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (emailsVencimento.includes(email)) { setNovoEmail(''); return; }
    const novos = [...emailsVencimento, email];
    try {
      await vencimentosApi.setEmails(novos);
      setEmailsVencimento(novos);
      setNovoEmail('');
    } catch { /* ignore */ }
  };

  const handleRemoverEmail = async (email: string) => {
    const novos = emailsVencimento.filter(e => e !== email);
    try {
      await vencimentosApi.setEmails(novos);
      setEmailsVencimento(novos);
    } catch { /* ignore */ }
  };

  // Get the dominant annotation color for a date (last one with non-white color)
  const getDateColor = (dateStr: string): string | null => {
    const anots = anotacoesByDate[dateStr];
    if (!anots || anots.length === 0) return null;
    for (let i = anots.length - 1; i >= 0; i--) {
      if (anots[i].cor && anots[i].cor !== '#ffffff') return anots[i].cor;
    }
    return null;
  };

  return (
    <div className={styles.calendarPage}>
      <PageHeader titulo="Calendário de Manutenção" subtitulo="Visão unificada de prazos, vencimentos e rotinas operacionais" />

      <Card>
        <div className={styles.controls}>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={() => setMesAtual(p => {
              const d = new Date(p.year, p.month - 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}>
              <ChevronLeft size={16} />
            </button>
            <span className={styles.monthLabel}>{mesLabel}</span>
            <button className={styles.navBtn} onClick={() => setMesAtual(p => {
              const d = new Date(p.year, p.month + 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button className={styles.legendasBtn} onClick={() => setShowLegendas(true)} title="Configurações do calendário">
            <Settings size={15} /> Configurações
          </button>
          <div className={styles.filterGroup}>
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.filterBtn} ${filtro === option.value ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltro(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--cor-texto-secundario)' }}>Carregando...</div>
        ) : (
          <div className={styles.calendar}>
            {DIAS_SEMANA.map(d => <div key={d} className={styles.dayHeader}>{d}</div>)}
            {diasDoMes.map(({ date, currentMonth }) => {
              const dateStr = formatDate(date);
              const dayEvts = eventsByDate[dateStr] || [];
              const isToday = dateStr === today;
              const isOtherMonth = currentMonth === false;
              const dateColor = currentMonth ? getDateColor(dateStr) : null;
              const hasAnot = (anotacoesByDate[dateStr] || []).length > 0;
              return (
                <button
                  type="button"
                  key={dateStr}
                  className={`${styles.dayCell} ${isOtherMonth ? styles.dayCellOther : ''} ${isToday && !dateColor ? styles.dayCellToday : ''}`}
                  style={dateColor ? { background: `${dateColor}80` } : undefined}
                  onClick={() => { if (currentMonth) setSelectedDay(dateStr); }}
                  disabled={!currentMonth}
                  aria-label={`Abrir ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                >
                  <div className={styles.dayTop}>
                    <div className={isToday ? styles.dayNumberToday : styles.dayNumber}>
                      {date.getDate()}
                    </div>
                    {dateColor && <div className={styles.colorIndicator} style={{ background: dateColor }} />}
                    {hasAnot && !dateColor && <StickyNote size={10} className={styles.noteIcon} />}
                  </div>
                  <div className={styles.eventList}>
                    {dayEvts.slice(0, 3).map(e => (
                      <div
                        key={e.id}
                        className={`${styles.event} ${EVENT_CLASS_BY_TYPE[e.tipo]}`}
                      >
                        {e.titulo}
                      </div>
                    ))}
                    {dayEvts.length > 3 && <div className={styles.more}>+{dayEvts.length - 3} mais</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Legenda fixa de tipos de evento */}
        <div className={styles.legend}>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#dbeafe' }} /> OS</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#dcfce7' }} /> Planos Preventivos</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#fef3c7' }} /> Vencimentos</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#fee2e2' }} /> Documentos</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#e0f2fe' }} /> Contratos</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#fae8ff' }} /> Fornecedores</div>
          <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#ede9fe' }} /> Escalas</div>
        </div>

        {/* Legendas personalizadas */}
        {legendas.length > 0 && (
          <div className={styles.legend} style={{ marginTop: 6 }}>
            {legendas.map(l => (
              <div key={l.id} className={styles.legendItem}>
                <div className={styles.legendDot} style={{ background: l.cor }} /> {l.rotulo}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Modal do dia: eventos + anotações ── */}
      {selectedDay && (
        <Modal aberto={true} titulo={`Eventos — ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR')}`} largura="md" onFechar={() => { setSelectedDay(null); setEditandoAnot(null); setNovaAnotTexto(''); setNovaAnotCor('#ffffff'); }}>
          {/* Eventos do dia */}
          {dayEvents.length > 0 && (
            <div className={styles.detailList}>
              {dayEvents.map(e => (
                <div key={e.id} className={styles.detailItem}>
                  <div className={styles.detailTitle}>
                    <span className={`${styles.event} ${EVENT_CLASS_BY_TYPE[e.tipo]}`} style={{ display: 'inline-block', marginRight: 8 }}>
                      {EVENT_LABEL_BY_TYPE[e.tipo]}
                    </span>
                    {e.titulo}
                  </div>
                  {e.status && <div className={styles.detailMeta}>Status: {e.status}</div>}
                  {e.prioridade && <div className={styles.detailMeta}>Prioridade: {e.prioridade}</div>}
                  {e.extra && <div className={styles.detailMeta}>{e.extra}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Divisor se há eventos e anotações */}
          {dayEvents.length > 0 && (dayAnotacoes.length > 0 || true) && (
            <div className={styles.sectionDivider}>
              <StickyNote size={14} /> Observações
            </div>
          )}
          {dayEvents.length === 0 && (
            <div className={styles.sectionDivider}>
              <StickyNote size={14} /> Observações
            </div>
          )}

          {/* Lista de anotações do dia */}
          {dayAnotacoes.length > 0 && (
            <div className={styles.anotList}>
              {dayAnotacoes.map(a => (
                <div key={a.id} className={styles.anotItem} style={{ borderLeft: `4px solid ${a.cor === '#ffffff' ? 'var(--cor-borda)' : a.cor}` }}>
                  {editandoAnot === a.id ? (
                    <div className={styles.anotEditRow}>
                      <textarea className={styles.anotInput} value={editTexto} onChange={e => setEditTexto(e.target.value)} rows={2} />
                      <div className={styles.anotColorRow}>
                        <span className={styles.anotColorLabel}>Cor:</span>
                        {CORES_PADRAO.map(c => (
                          <button key={c} className={`${styles.colorBtn} ${editCor === c ? styles.colorBtnActive : ''}`} style={{ background: c }} onClick={() => setEditCor(c)} />
                        ))}
                        {legendas.filter(l => !CORES_PADRAO.includes(l.cor)).map(l => (
                          <button key={l.id} className={`${styles.colorBtn} ${editCor === l.cor ? styles.colorBtnActive : ''}`} style={{ background: l.cor }} onClick={() => setEditCor(l.cor)} title={l.rotulo} />
                        ))}
                      </div>
                      <div className={styles.anotActions}>
                        <button className={styles.anotSaveBtn} onClick={() => handleEditarAnotacao(a.id)}><Save size={14} /> Salvar</button>
                        <button className={styles.anotCancelBtn} onClick={() => setEditandoAnot(null)}><X size={14} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.anotTexto}>{a.texto}</div>
                      <div className={styles.anotFooter}>
                        {a.cor !== '#ffffff' && legendaMap[a.cor] && (
                          <span className={styles.anotBadge} style={{ background: `${a.cor}22`, color: a.cor, border: `1px solid ${a.cor}44` }}>
                            {legendaMap[a.cor]}
                          </span>
                        )}
                        <div className={styles.anotBtns}>
                          <button className={styles.anotIconBtn} onClick={() => { setEditandoAnot(a.id); setEditTexto(a.texto); setEditCor(a.cor); }} title="Editar"><Edit2 size={13} /></button>
                          <button className={styles.anotIconBtn} onClick={() => handleExcluirAnotacao(a.id)} title="Excluir"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {dayAnotacoes.length === 0 && (
            <div className={styles.anotEmpty}>Nenhuma observação nesta data.</div>
          )}

          {/* Formulário para nova anotação */}
          <div className={styles.novaAnotForm}>
            <textarea
              className={styles.anotInput}
              placeholder="Adicionar observação..."
              value={novaAnotTexto}
              onChange={e => setNovaAnotTexto(e.target.value)}
              rows={2}
            />
            <div className={styles.anotColorRow}>
              <span className={styles.anotColorLabel}>Cor:</span>
              {CORES_PADRAO.map(c => (
                <button key={c} className={`${styles.colorBtn} ${novaAnotCor === c ? styles.colorBtnActive : ''}`} style={{ background: c === '#ffffff' ? '#f3f4f6' : c }} onClick={() => setNovaAnotCor(c)} title={legendaMap[c] || (c === '#ffffff' ? 'Sem cor' : c)} />
              ))}
              {legendas.filter(l => !CORES_PADRAO.includes(l.cor)).map(l => (
                <button key={l.id} className={`${styles.colorBtn} ${novaAnotCor === l.cor ? styles.colorBtnActive : ''}`} style={{ background: l.cor }} onClick={() => setNovaAnotCor(l.cor)} title={l.rotulo} />
              ))}
            </div>
            {novaAnotCor !== '#ffffff' && legendaMap[novaAnotCor] && (
              <div className={styles.selectedLegBadge} style={{ color: novaAnotCor }}>
                {legendaMap[novaAnotCor]}
              </div>
            )}
            <button className={styles.anotAddBtn} onClick={handleCriarAnotacao} disabled={!novaAnotTexto.trim()}>
              <Plus size={14} /> Adicionar observação
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal de configurações (legendas + e-mails) ── */}
      {showLegendas && (
        <Modal aberto={true} titulo="Configurações do Calendário" largura="md" onFechar={() => { setShowLegendas(false); setEditandoLeg(null); }}>
          <p className={styles.legendaDesc}>
            Defina cores e rótulos personalizados para classificar suas observações no calendário. As cores escolhidas aqui aparecerão no fundo das datas que possuírem observações com essa cor.
          </p>

          {/* Lista de legendas */}
          {legendas.length > 0 ? (
            <div className={styles.legendaList}>
              {legendas.map(l => (
                <div key={l.id} className={styles.legendaItem}>
                  {editandoLeg === l.id ? (
                    <div className={styles.legendaEditRow}>
                      <input type="color" className={styles.legendaColorInput} value={editLegCor} onChange={e => setEditLegCor(e.target.value)} />
                      <input className={styles.legendaTextInput} value={editLegRotulo} onChange={e => setEditLegRotulo(e.target.value)} maxLength={60} />
                      <button className={styles.anotSaveBtn} onClick={() => handleEditarLegenda(l.id)}><Save size={14} /></button>
                      <button className={styles.anotCancelBtn} onClick={() => setEditandoLeg(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <div className={styles.legendaRow}>
                      <div className={styles.legendDot} style={{ background: l.cor, width: 18, height: 18, borderRadius: 4 }} />
                      <span className={styles.legendaRotulo}>{l.rotulo}</span>
                      <div className={styles.anotBtns}>
                        <button className={styles.anotIconBtn} onClick={() => { setEditandoLeg(l.id); setEditLegCor(l.cor); setEditLegRotulo(l.rotulo); }} title="Editar"><Edit2 size={13} /></button>
                        <button className={styles.anotIconBtn} onClick={() => handleExcluirLegenda(l.id)} title="Excluir"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.anotEmpty}>Nenhuma legenda definida. Crie a primeira abaixo.</div>
          )}

          {/* Formulário para nova legenda */}
          <div className={styles.novaLegForm}>
            <input type="color" className={styles.legendaColorInput} value={novaLegCor} onChange={e => setNovaLegCor(e.target.value)} />
            <input
              className={styles.legendaTextInput}
              placeholder="Ex: Urgente, Em execução, Finalizado..."
              value={novaLegRotulo}
              onChange={e => setNovaLegRotulo(e.target.value)}
              maxLength={60}
              onKeyDown={e => { if (e.key === 'Enter') handleCriarLegenda(); }}
            />
            <button className={styles.anotAddBtn} onClick={handleCriarLegenda} disabled={!novaLegRotulo.trim()}>
              <Plus size={14} /> Criar
            </button>
          </div>

          {/* Pré-definidas sugeridas */}
          <div className={styles.legendaSugestoes}>
            <span className={styles.anotColorLabel}>Sugestões rápidas:</span>
            <div className={styles.sugestoesList}>
              {[
                { cor: '#ef4444', rotulo: 'Urgente' },
                { cor: '#f97316', rotulo: 'Atenção' },
                { cor: '#eab308', rotulo: 'Pendente' },
                { cor: '#22c55e', rotulo: 'Concluído' },
                { cor: '#3b82f6', rotulo: 'Em execução' },
                { cor: '#8b5cf6', rotulo: 'Agendado' },
              ].filter(s => !legendas.some(l => l.cor === s.cor)).map(s => (
                <button key={s.cor} className={styles.sugestaoBtn} style={{ background: `${s.cor}15`, color: s.cor, border: `1px solid ${s.cor}44` }} onClick={() => { setNovaLegCor(s.cor); setNovaLegRotulo(s.rotulo); }}>
                  <div className={styles.legendDot} style={{ background: s.cor, width: 10, height: 10 }} /> {s.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* ── Seção de e-mails para notificações de vencimentos ── */}
          <div className={styles.emailSection}>
            <div className={styles.emailSectionHeader}>
              <Mail size={16} />
              <h4 className={styles.emailSectionTitle}>E-mails para Alertas de Vencimentos</h4>
            </div>
            <p className={styles.emailSectionDesc}>
              Cadastre e-mails que receberão alertas automáticos quando vencimentos estiverem próximos (30, 15 e 7 dias antes).
            </p>

            {emailsLoading ? (
              <div className={styles.anotEmpty}>Carregando...</div>
            ) : (
              <>
                {emailsVencimento.length > 0 && (
                  <div className={styles.emailList}>
                    {emailsVencimento.map(email => (
                      <div key={email} className={styles.emailItem}>
                        <Mail size={14} className={styles.emailItemIcon} />
                        <span className={styles.emailItemText}>{email}</span>
                        <button className={styles.anotIconBtn} onClick={() => handleRemoverEmail(email)} title="Remover">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {emailsVencimento.length === 0 && (
                  <div className={styles.anotEmpty}>Nenhum e-mail cadastrado. Adicione abaixo.</div>
                )}

                <div className={styles.novaEmailForm}>
                  <input
                    type="email"
                    className={styles.legendaTextInput}
                    placeholder="Digite o e-mail..."
                    value={novoEmail}
                    onChange={e => setNovoEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdicionarEmail(); }}
                  />
                  <button className={styles.anotAddBtn} onClick={handleAdicionarEmail} disabled={!novoEmail.trim()}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalendarioPage;
