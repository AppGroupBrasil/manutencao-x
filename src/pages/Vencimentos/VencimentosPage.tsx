import React, { useState, useRef, useEffect } from 'react';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import HowItWorks from '../../components/Common/HowItWorks';
import { validarImagem } from '../../utils/imageUtils';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Plus, CalendarClock, Trash2, Save, Edit2, X, Mail, Bell, AlertTriangle,
  Clock, CheckCircle2, FileText, Wrench, Building2, Search, ChevronDown, ChevronUp, BookmarkPlus, ImagePlus, Settings
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { configuracoes as configuracoesApi, vencimentos as vencimentosApi, condominios as condominiosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './Vencimentos.module.css';

/* ═══════ types ═══════ */
type TipoVencimento = string;
type CategoriaVencimento = 'contrato' | 'servico' | 'manutencao';
type StatusVencimento = 'em_dia' | 'proximo' | 'vencido';

interface TipoManutencaoConfig {
  id: string;
  label: string;
}

interface TipoVencimentoOption {
  value: string;
  label: string;
  categoria: CategoriaVencimento;
}

interface Aviso {
  id: string;
  tipo: 'dias_antes' | 'data_especifica';
  valor: number;     // dias antes do vencimento
  dataEspecifica?: string;  // ISO date when tipo=data_especifica
  descricao?: string;
  imagens?: string[];  // base64 data URLs
}

interface Vencimento {
  id: string;
  titulo: string;
  tipo: TipoVencimento;
  descricao: string;
  condominioId: string;
  condominio: string;
  dataVencimento: string;       // ISO date
  dataUltimaManutencao?: string; // ISO date
  dataProximaManutencao?: string; // ISO date
  emails: string[];
  avisos: Aviso[];
  qtdNotificacoes: number;       // quantas vezes notificar
  imagens?: string[];             // base64 data URLs
  criadoEm: string;
}

type VencimentoPayload = Omit<Vencimento, 'id' | 'criadoEm'>;

type VencimentoApi = Partial<Vencimento> & {
  condominioNome?: string;
  criadoEm?: string;
};



/* ═══════ helpers ═══════ */
const gerarId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '') || gerarId();

const TIPOS_BASE: TipoVencimentoOption[] = [
  { value: 'contrato', label: 'Contrato', categoria: 'contrato' },
  { value: 'servico', label: 'Serviço', categoria: 'servico' },
  { value: 'manutencao', label: 'Manutenção', categoria: 'manutencao' },
];

function ehTipoManutencao(tipo: string) {
  return tipo === 'manutencao' || tipo.startsWith('manutencao:');
}

function obterCategoriaTipo(tipo: string): CategoriaVencimento {
  if (tipo === 'contrato') return 'contrato';
  if (tipo === 'servico') return 'servico';
  return 'manutencao';
}

function montarOpcoesTipo(configs: TipoManutencaoConfig[]): TipoVencimentoOption[] {
  return [
    ...TIPOS_BASE,
    ...configs.map((item) => ({
      value: `manutencao:${item.id}`,
      label: item.label,
      categoria: 'manutencao' as const,
    })),
  ];
}

function obterLabelTipo(tipo: string, opcoes: TipoVencimentoOption[]) {
  return opcoes.find((item) => item.value === tipo)?.label || (tipo.startsWith('manutencao:') ? tipo.split(':').slice(1).join(':') : tipo);
}

function diasRestantes(dataVenc: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVenc); venc.setHours(0, 0, 0, 0);
  return Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
}

function statusVencimento(dataVenc: string): StatusVencimento {
  const dias = diasRestantes(dataVenc);
  if (dias < 0) return 'vencido';
  if (dias <= 30) return 'proximo';
  return 'em_dia';
}

const STATUS_LABELS: Record<StatusVencimento, { texto: string; cor: string; bg: string }> = {
  em_dia: { texto: 'Em dia', cor: '#2e7d32', bg: '#e8f5e9' },
  proximo: { texto: 'Próximo ao vencimento', cor: '#e65100', bg: '#fff3e0' },
  vencido: { texto: 'Vencido', cor: '#c62828', bg: '#ffebee' },
};

function formatarData(iso: string) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

/* ═══════ default form ═══════ */
const formVazio = (): VencimentoPayload => ({
  titulo: '', tipo: 'contrato', descricao: '', condominioId: '', condominio: '',
  dataVencimento: '', dataUltimaManutencao: '', dataProximaManutencao: '',
  emails: [], avisos: [], qtdNotificacoes: 1, imagens: [],
});

function normalizarVencimento(vencimento: VencimentoApi, condominios: { id: string; nome: string }[]): Vencimento {
  const condominioId = vencimento.condominioId || '';
  const condominio = vencimento.condominio || vencimento.condominioNome || condominios.find((item) => item.id === condominioId)?.nome || '';

  return {
    id: vencimento.id || gerarId(),
    titulo: vencimento.titulo || '',
    tipo: (vencimento.tipo as TipoVencimento) || 'contrato',
    descricao: vencimento.descricao || '',
    condominioId,
    condominio,
    dataVencimento: vencimento.dataVencimento || '',
    dataUltimaManutencao: vencimento.dataUltimaManutencao || '',
    dataProximaManutencao: vencimento.dataProximaManutencao || '',
    emails: vencimento.emails || [],
    avisos: vencimento.avisos || [],
    qtdNotificacoes: vencimento.qtdNotificacoes || 0,
    imagens: vencimento.imagens || [],
    criadoEm: vencimento.criadoEm || new Date().toISOString(),
  };
}

/* ═══════ Component ═══════ */
const VencimentosPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [vencimentos, setVencimentos] = useState<Vencimento[]>([]);
  const [condominiosList, setCondominiosList] = useState<{id:string;nome:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(formVazio());
  const [emailInput, setEmailInput] = useState('');
  const [emailsSalvos, setEmailsSalvos] = useState<string[]>([]);
  const [tiposManutencao, setTiposManutencao] = useState<TipoManutencaoConfig[]>([]);
  const [modalTiposAberto, setModalTiposAberto] = useState(false);
  const [novoTipoManutencao, setNovoTipoManutencao] = useState('');
  const [salvandoTipos, setSalvandoTipos] = useState(false);
  const opcoesTipo = montarOpcoesTipo(tiposManutencao);

  useEffect(() => {
    Promise.all([
      vencimentosApi.list(),
      vencimentosApi.getEmails().catch(() => ({ emails: [] })),
      condominiosApi.list().catch(() => []),
      configuracoesApi.getVencimentosTipos().catch(() => ({ tipos: [] })),
    ]).then(([vencs, emailsResponse, conds, tiposResponse]) => {
      const condominios = (conds as any[]).map(c => ({ id: c.id, nome: c.nome }));
      setCondominiosList(condominios);
      setVencimentos((vencs as VencimentoApi[]).map((item) => normalizarVencimento(item, condominios)));
      setEmailsSalvos(Array.isArray((emailsResponse as { emails?: string[] }).emails) ? (emailsResponse as { emails: string[] }).emails : []);
      setTiposManutencao(Array.isArray((tiposResponse as { tipos?: TipoManutencaoConfig[] }).tipos) ? (tiposResponse as { tipos: TipoManutencaoConfig[] }).tipos : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<StatusVencimento | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);



  /* ── modal open/close ── */
  const abrirNovo = () => {
    if (!tentarAcao()) return;
    setForm(formVazio());
    setEditandoId(null);
    setEmailInput('');
    setModalAberto(true);
  };
  const abrirEditar = (v: Vencimento) => {
    if (!tentarAcao()) return;
    setForm({ titulo: v.titulo, tipo: v.tipo, descricao: v.descricao, condominioId: v.condominioId, condominio: v.condominio, dataVencimento: v.dataVencimento, dataUltimaManutencao: v.dataUltimaManutencao || '', dataProximaManutencao: v.dataProximaManutencao || '', emails: [...v.emails], avisos: v.avisos.map(a => ({ ...a })), qtdNotificacoes: v.qtdNotificacoes, imagens: [...(v.imagens || [])] });
    setEditandoId(v.id); setEmailInput(''); setModalAberto(true);
  };
  const fecharModal = () => { setModalAberto(false); setEditandoId(null); };

  /* ── imagens do vencimento ── */
  const handleImagemVencimento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setForm(p => ({ ...p, imagens: [...(p.imagens || []), url] }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const removerImagemVencimento = (idx: number) => {
    setForm(p => ({ ...p, imagens: (p.imagens || []).filter((_, i) => i !== idx) }));
  };

  /* ── emails ── */
  const adicionarEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (form.emails.includes(e)) return;
    setForm(p => ({ ...p, emails: [...p.emails, e] }));
    // auto-salvar no banco de e-mails
    if (!emailsSalvos.includes(e)) {
      const novos = [...emailsSalvos, e];
      setEmailsSalvos(novos);
      vencimentosApi.setEmails(novos).catch(console.error);
    }
    setEmailInput('');
  };
  const removerEmail = (email: string) => setForm(p => ({ ...p, emails: p.emails.filter(e => e !== email) }));
  const selecionarEmailSalvo = (e: string) => {
    if (!e || form.emails.includes(e)) return;
    setForm(p => ({ ...p, emails: [...p.emails, e] }));
  };
  const removerEmailSalvo = (email: string) => {
    const novos = emailsSalvos.filter(e => e !== email);
    setEmailsSalvos(novos);
    vencimentosApi.setEmails(novos).catch(console.error);
  };

  /* ── avisos ── */
  const adicionarAviso = () => {
    if (form.avisos.length >= 3) return;
    setForm(p => ({ ...p, avisos: [...p.avisos, { id: gerarId(), tipo: 'dias_antes', valor: 7 }] }));
  };
  const atualizarAviso = (id: string, campo: Partial<Aviso>) => {
    setForm(p => ({ ...p, avisos: p.avisos.map(a => a.id === id ? { ...a, ...campo } : a) }));
  };
  const removerAviso = (id: string) => setForm(p => ({ ...p, avisos: p.avisos.filter(a => a.id !== id) }));

  const handleImagemAviso = (avisoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setForm(p => ({ ...p, avisos: p.avisos.map(a =>
        a.id === avisoId ? { ...a, imagens: [...(a.imagens || []), url] } : a
      ) }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const removerImagemAviso = (avisoId: string, idx: number) => {
    setForm(p => ({ ...p, avisos: p.avisos.map(a =>
      a.id === avisoId ? { ...a, imagens: (a.imagens || []).filter((_, i) => i !== idx) } : a
    ) }));
  };

  const persistirTiposManutencao = async (tipos: TipoManutencaoConfig[]) => {
    setSalvandoTipos(true);
    try {
      const response = await configuracoesApi.setVencimentosTipos(tipos);
      setTiposManutencao(Array.isArray(response.tipos) ? response.tipos : tipos);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Não foi possível salvar os tipos de manutenção.');
    } finally {
      setSalvandoTipos(false);
    }
  };

  const adicionarTipoManutencao = async () => {
    const label = novoTipoManutencao.trim();
    if (!label) return;
    if (tiposManutencao.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      alert('Esse tipo de manutenção já está cadastrado.');
      return;
    }
    await persistirTiposManutencao([...tiposManutencao, { id: slugify(label), label }]);
    setNovoTipoManutencao('');
  };

  const removerTipoManutencao = async (id: string) => {
    await persistirTiposManutencao(tiposManutencao.filter((item) => item.id !== id));
    setForm((prev) => prev.tipo === `manutencao:${id}` ? { ...prev, tipo: 'manutencao' } : prev);
  };

  /* ── save ── */
  const salvar = async () => {
    if (!form.titulo.trim() || !form.dataVencimento || !form.condominioId) return;

    const payload = {
      titulo: form.titulo,
      tipo: form.tipo,
      descricao: form.descricao,
      condominioId: form.condominioId,
      dataVencimento: form.dataVencimento,
      dataUltimaManutencao: form.dataUltimaManutencao || null,
      dataProximaManutencao: form.dataProximaManutencao || null,
      emails: form.emails,
      avisos: form.avisos,
      imagens: form.imagens || [],
      qtdNotificacoes: form.qtdNotificacoes,
    };

    try {
      if (editandoId) {
        const atualizado = await vencimentosApi.update(editandoId, payload) as VencimentoApi;
        setVencimentos(prev => prev.map(v => v.id === editandoId ? normalizarVencimento({ ...v, ...atualizado, condominioId: form.condominioId, condominio: form.condominio }, condominiosList) : v));
      } else {
        const criado = await vencimentosApi.create(payload) as VencimentoApi;
        setVencimentos(prev => [...prev, normalizarVencimento({ ...criado, condominioId: form.condominioId, condominio: form.condominio }, condominiosList)]);
      }
      fecharModal();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Não foi possível salvar o vencimento.');
    }
  };

  /* ── delete ── */
  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await vencimentosApi.remove(id);
      setVencimentos(prev => prev.filter(v => v.id !== id));
    } catch (err) { console.error(err); }
  };

  /* ── filter ── */
  const filtrados = vencimentos.filter(v => {
    if (filtroTipo !== 'todos' && v.tipo !== filtroTipo) return false;
    if (filtroStatus !== 'todos' && statusVencimento(v.dataVencimento) !== filtroStatus) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return v.titulo.toLowerCase().includes(b) || v.condominio.toLowerCase().includes(b) || v.descricao.toLowerCase().includes(b);
    }
    return true;
  }).sort((a, b) => diasRestantes(a.dataVencimento) - diasRestantes(b.dataVencimento));

  /* ── stats ── */
  const totalVencidos = vencimentos.filter(v => statusVencimento(v.dataVencimento) === 'vencido').length;
  const totalProximos = vencimentos.filter(v => statusVencimento(v.dataVencimento) === 'proximo').length;
  const totalEmDia = vencimentos.filter(v => statusVencimento(v.dataVencimento) === 'em_dia').length;

  /* ── export ── */
  const handleCompartilhar = () => compartilharConteudo('Agenda de Vencimentos', `Total: ${vencimentos.length} vencimentos cadastrados.\nVencidos: ${totalVencidos}\nPróximos: ${totalProximos}\nEm dia: ${totalEmDia}`);
  const handleImprimir = () => printRef.current && imprimirElemento(printRef.current);
  const handlePdf = () => printRef.current && gerarPdfDeElemento(printRef.current, 'agenda-vencimentos');

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando vencimentos..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        titulo="Agenda de Vencimentos"
        subtitulo="Controle de contratos, serviços e manutenções"
        acoes={<button className={styles.btnNovo} onClick={abrirNovo}><Plus size={18} /> Novo Vencimento</button>}
        onCompartilhar={handleCompartilhar}
        onImprimir={handleImprimir}
        onGerarPdf={handlePdf}
      />

      <HowItWorks
        titulo="Como funciona a Agenda de Vencimentos"
        descricao="Cadastre vencimento de contratos, serviços e manutenções. Configure alertas por e-mail para ser notificado antes dos prazos."
        passos={[
          'Cadastre um vencimento com título, tipo, datas e descrição',
          'Adicione e-mails para receber notificações automáticas',
          'Configure até 3 avisos com dias de antecedência ou datas específicas',
          'Acompanhe no painel quais itens estão próximos ou vencidos',
        ]}
      />

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <Card padding="md">
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statVencido}`}><AlertTriangle size={22} /></div>
            <div><span className={styles.statNum}>{totalVencidos}</span><span className={styles.statLabel}>Vencidos</span></div>
          </div>
        </Card>
        <Card padding="md">
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statProximo}`}><Clock size={22} /></div>
            <div><span className={styles.statNum}>{totalProximos}</span><span className={styles.statLabel}>Próximos</span></div>
          </div>
        </Card>
        <Card padding="md">
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statEmDia}`}><CheckCircle2 size={22} /></div>
            <div><span className={styles.statNum}>{totalEmDia}</span><span className={styles.statLabel}>Em dia</span></div>
          </div>
        </Card>
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>
        <div className={styles.filtroSearch}>
          <Search size={16} />
          <input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className={styles.filtroInput} />
        </div>
        <select className={styles.filtroSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {opcoesTipo.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
        </select>
        <select className={styles.filtroSelect} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
          <option value="todos">Todos os status</option>
          <option value="vencido">Vencidos</option>
          <option value="proximo">Próximos</option>
          <option value="em_dia">Em dia</option>
        </select>
      </div>

      {/* ── Lista ── */}
      <div className={styles.lista} ref={printRef}>
        {filtrados.length === 0 && (
          <Card padding="lg">
            <div className={styles.vazio}>
              <CalendarClock size={48} strokeWidth={1.2} />
              <h3>Nenhum vencimento encontrado</h3>
              <p>Cadastre contratos, serviços ou manutenções para acompanhar seus prazos.</p>
              <button className={styles.btnNovo} onClick={abrirNovo}><Plus size={18} /> Cadastrar Vencimento</button>
            </div>
          </Card>
        )}

        {pag.items.map(v => {
          const dias = diasRestantes(v.dataVencimento);
          const st = statusVencimento(v.dataVencimento);
          const stInfo = STATUS_LABELS[st];
          const isExpanded = expandido === v.id;
          return (
            <Card key={v.id} padding="md" hover>
              <div className={styles.vencCard}>
                <div className={styles.vencTop}>
                  <div className={styles.vencTipo}>
                    {obterCategoriaTipo(v.tipo) === 'contrato' && <FileText size={16} />}
                    {obterCategoriaTipo(v.tipo) === 'servico' && <Wrench size={16} />}
                    {obterCategoriaTipo(v.tipo) === 'manutencao' && <Building2 size={16} />}
                    <span>{obterLabelTipo(v.tipo, opcoesTipo)}</span>
                  </div>
                  <span className={styles.statusBadge} style={{ background: stInfo.bg, color: stInfo.cor }}>{stInfo.texto}</span>
                </div>

                <h3 className={styles.vencTitulo}>{v.titulo}</h3>
                {v.condominio && <p className={styles.vencCond}>{v.condominio}</p>}

                <div className={styles.vencDatas}>
                  <div className={styles.vencDataItem}>
                    <span className={styles.vencDataLabel}>Vencimento</span>
                    <span className={styles.vencDataValor}>{formatarData(v.dataVencimento)}</span>
                  </div>
                  <div className={styles.vencDataItem}>
                    <span className={styles.vencDataLabel}>Dias</span>
                    <span className={`${styles.vencDias} ${styles[`dias_${st}`]}`}>
                      {dias === 0 ? 'Vence hoje' : dias > 0 ? `${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}` : `${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''} vencido${Math.abs(dias) > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                {ehTipoManutencao(v.tipo) && (
                  <div className={styles.vencDatas}>
                    {v.dataUltimaManutencao && (
                      <div className={styles.vencDataItem}>
                        <span className={styles.vencDataLabel}>Última Manutenção</span>
                        <span className={styles.vencDataValor}>{formatarData(v.dataUltimaManutencao)}</span>
                      </div>
                    )}
                    {v.dataProximaManutencao && (
                      <div className={styles.vencDataItem}>
                        <span className={styles.vencDataLabel}>Próxima Manutenção</span>
                        <span className={styles.vencDataValor}>{formatarData(v.dataProximaManutencao)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.vencMeta}>
                  <span className={styles.metaItem}><Mail size={13} /> {v.emails.length} e-mail{v.emails.length !== 1 ? 's' : ''}</span>
                  <span className={styles.metaItem}><Bell size={13} /> {v.avisos.length} aviso{v.avisos.length !== 1 ? 's' : ''}</span>
                  <span className={styles.metaItem}><CalendarClock size={13} /> {v.qtdNotificacoes}x notificação</span>
                </div>

                <button className={styles.expandBtn} onClick={() => setExpandido(isExpanded ? null : v.id)}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {isExpanded ? 'Menos detalhes' : 'Mais detalhes'}
                </button>

                {isExpanded && (
                  <div className={styles.detalhes}>
                    {v.descricao && <p className={styles.detalheDesc}>{v.descricao}</p>}

                    {v.emails.length > 0 && (
                      <div className={styles.detalheSecao}>
                        <h4><Mail size={14} /> E-mails para notificação</h4>
                        <div className={styles.emailTags}>
                          {v.emails.map(e => <span key={e} className={styles.emailTag}>{e}</span>)}
                        </div>
                      </div>
                    )}

                    {v.avisos.length > 0 && (
                      <div className={styles.detalheSecao}>
                        <h4><Bell size={14} /> Avisos configurados</h4>
                        <ul className={styles.avisoLista}>
                          {v.avisos.map(a => (
                            <li key={a.id}>
                              {a.tipo === 'dias_antes'
                                ? `${a.valor} dia${a.valor > 1 ? 's' : ''} antes do vencimento`
                                : `Data específica: ${formatarData(a.dataEspecifica || '')}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.vencActions}>
                  <button className={styles.btnEditar} onClick={() => abrirEditar(v)}><Edit2 size={15} /> Editar</button>
                  <button className={styles.btnExcluir} onClick={() => excluir(v.id)}><Trash2 size={15} /> Excluir</button>
                  <WhatsAppShare mensagem={`*Vencimento*\n*Título:* ${v.titulo}\n*Tipo:* ${obterLabelTipo(v.tipo, opcoesTipo)}\n*Condomínio:* ${v.condominio || 'N/A'}\n*Data Vencimento:* ${v.dataVencimento ? new Date(v.dataVencimento).toLocaleDateString('pt-BR') : 'N/A'}\n*Descrição:* ${v.descricao || 'N/A'}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {/* ═══ Modal ═══ */}
      <Modal aberto={modalAberto} onFechar={fecharModal} titulo={editandoId ? 'Editar Vencimento' : 'Novo Vencimento'} largura="lg">
        <div className={styles.modalForm}>
          {/* tipo + titulo */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo *</label>
              <div className={styles.tipoSelectRow}>
                <select className={styles.formSelect} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoVencimento }))}>
                  {opcoesTipo.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                </select>
                <button type="button" className={styles.btnTipoConfig} onClick={() => setModalTiposAberto(true)} title="Cadastrar tipos de manutenção">
                  <Settings size={16} />
                </button>
              </div>
            </div>
            <div className={styles.formGroup} style={{ flex: 2 }}>
              <label className={styles.formLabel}>Título *</label>
              <input className={styles.formInput} placeholder="Ex: Contrato de manutenção do elevador" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
            </div>
          </div>

          {/* condominio + desc */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Condomínio</label>
            <select
              className={styles.formSelect}
              value={form.condominioId}
              onChange={e => setForm(p => ({
                ...p,
                condominioId: e.target.value,
                condominio: condominiosList.find(c => c.id === e.target.value)?.nome || '',
              }))}
            >
              <option value="">Selecione o condomínio</option>
              {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {/* Galeria de imagens */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><ImagePlus size={15} /> Imagens</label>
            <div className={styles.avisoGaleria}>
              {(form.imagens || []).map((img, idx) => (
                <div key={idx} className={styles.avisoGaleriaItem}>
                  <img src={img} alt={`Imagem ${idx + 1}`} className={styles.avisoGaleriaImg} />
                  <button type="button" className={styles.avisoGaleriaRemover} onClick={() => removerImagemVencimento(idx)}><X size={12} /></button>
                </div>
              ))}
              <label className={styles.avisoGaleriaAdd}>
                <ImagePlus size={18} />
                <span>Adicionar</span>
                <input type="file" accept="image/*" hidden onChange={handleImagemVencimento} />
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descrição</label>
            <textarea className={styles.formTextarea} rows={3} placeholder="Detalhe sobre este vencimento..." value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
          </div>

          {/* datas */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de Vencimento *</label>
              <input type="date" className={styles.formInput} value={form.dataVencimento} onChange={e => setForm(p => ({ ...p, dataVencimento: e.target.value }))} />
            </div>
            {ehTipoManutencao(form.tipo) && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Última Manutenção</label>
                  <input type="date" className={styles.formInput} value={form.dataUltimaManutencao} onChange={e => setForm(p => ({ ...p, dataUltimaManutencao: e.target.value }))} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Próxima Manutenção</label>
                  <input type="date" className={styles.formInput} value={form.dataProximaManutencao} onChange={e => setForm(p => ({ ...p, dataProximaManutencao: e.target.value }))} />
                </div>
              </>
            )}
          </div>

          {/* ── Seção E-mails ── */}
          <div className={styles.secao}>
            <h4 className={styles.secaoTitulo}><Mail size={16} /> E-mails para Notificação</h4>

            {/* Selecionar e-mail salvo */}
            {emailsSalvos.length > 0 && (
              <div className={styles.emailSalvos}>
                <label className={styles.formLabel}>E-mails salvos</label>
                <div className={styles.emailSalvosLista}>
                  {emailsSalvos.map(e => (
                    <div key={e} className={styles.emailSalvoItem}>
                      <button
                        type="button"
                        className={`${styles.emailSalvoBtn} ${form.emails.includes(e) ? styles.emailSalvoBtnAtivo : ''}`}
                        onClick={() => selecionarEmailSalvo(e)}
                        disabled={form.emails.includes(e)}
                      >
                        <Mail size={12} /> {e}
                        {form.emails.includes(e) && <CheckCircle2 size={12} />}
                      </button>
                      <button className={styles.emailSalvoRemover} onClick={() => removerEmailSalvo(e)} title="Remover do salvos"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adicionar novo e-mail */}
            <div className={styles.emailAdd}>
              <input className={styles.formInput} placeholder="email@exemplo.com" type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarEmail())} />
              <button type="button" className={styles.btnAdd} onClick={adicionarEmail}><Plus size={16} /> Adicionar</button>
            </div>
            <p className={styles.formHint}><BookmarkPlus size={12} /> E-mails adicionados são salvos automaticamente para uso futuro</p>

            {form.emails.length > 0 && (
              <div className={styles.emailTags}>
                {form.emails.map(e => (
                  <span key={e} className={styles.emailTag}>
                    {e}
                    <button className={styles.emailRemove} onClick={() => removerEmail(e)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Seção Avisos ── */}
          <div className={styles.secao}>
            <div className={styles.secaoHeader}>
              <h4 className={styles.secaoTitulo}><Bell size={16} /> Avisos de Vencimento</h4>
              {form.avisos.length < 3 && (
                <button type="button" className={styles.btnAddSmall} onClick={adicionarAviso}><Plus size={14} /> Aviso</button>
              )}
            </div>
            <p className={styles.secaoDesc}>Configure até 3 avisos para ser notificado antes do prazo.</p>
            {form.avisos.map((a, i) => (
              <div key={a.id} className={styles.avisoBlock}>
                <div className={styles.avisoRow}>
                  <span className={styles.avisoNum}>Aviso {i + 1}</span>
                  <select className={styles.formSelect} value={a.tipo} onChange={e => atualizarAviso(a.id, { tipo: e.target.value as Aviso['tipo'] })}>
                    <option value="dias_antes">Dias antes</option>
                    <option value="data_especifica">Data específica</option>
                  </select>
                  {a.tipo === 'dias_antes' ? (
                    <div className={styles.avisoInputWrap}>
                      <input type="number" className={styles.formInput} min={1} max={365} value={a.valor} onChange={e => atualizarAviso(a.id, { valor: parseInt(e.target.value) || 1 })} />
                      <span className={styles.avisoSuffix}>dias</span>
                    </div>
                  ) : (
                    <input type="date" className={styles.formInput} value={a.dataEspecifica || ''} onChange={e => atualizarAviso(a.id, { dataEspecifica: e.target.value })} />
                  )}
                  <button className={styles.btnRemoveAviso} onClick={() => removerAviso(a.id)}><Trash2 size={14} /></button>
                </div>
                <input
                  type="text"
                  className={`${styles.formInput} ${styles.avisoDescricao}`}
                  placeholder="Descrição do aviso (opcional)"
                  value={a.descricao || ''}
                  onChange={e => atualizarAviso(a.id, { descricao: e.target.value })}
                />
              </div>
            ))}
          </div>

          {/* ── Qtd notificações ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Quantidade de notificações por aviso</label>
            <input type="number" className={styles.formInput} min={1} max={10} value={form.qtdNotificacoes} onChange={e => setForm(p => ({ ...p, qtdNotificacoes: parseInt(e.target.value) || 1 }))} style={{ maxWidth: 120 }} />
            <span className={styles.formHint}>Quantas vezes cada aviso será enviado por e-mail</span>
          </div>

          <button className={styles.btnSalvar} onClick={salvar} disabled={!form.titulo.trim() || !form.dataVencimento || !form.condominioId}>
            <Save size={18} /> {editandoId ? 'Salvar Alterações' : 'Cadastrar Vencimento'}
          </button>
        </div>
      </Modal>

      <Modal aberto={modalTiposAberto} onFechar={() => setModalTiposAberto(false)} titulo="Tipos de vencimento de manutenção">
        <div className={styles.tiposModalConteudo}>
          <p className={styles.secaoDesc}>Cadastre tipos específicos para vencimentos de manutenção. Eles aparecerão no campo ao lado da engrenagem.</p>
          <div className={styles.tipoAddRow}>
            <input
              className={styles.formInput}
              placeholder="Ex: Elevador, Gerador, Bomba"
              value={novoTipoManutencao}
              onChange={e => setNovoTipoManutencao(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarTipoManutencao())}
            />
            <button type="button" className={styles.btnAdd} onClick={adicionarTipoManutencao} disabled={salvandoTipos}>
              <Plus size={16} /> Adicionar
            </button>
          </div>

          <div className={styles.tiposModalLista}>
            {tiposManutencao.length === 0 && <div className={styles.tiposModalVazio}>Nenhum tipo personalizado cadastrado.</div>}
            {tiposManutencao.map((tipo) => (
              <div key={tipo.id} className={styles.tipoItem}>
                <span className={styles.tipoItemLabel}>{tipo.label}</span>
                <button type="button" className={styles.btnExcluirTipo} onClick={() => removerTipoManutencao(tipo.id)} disabled={salvandoTipos}>
                  <Trash2 size={14} /> Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VencimentosPage;
