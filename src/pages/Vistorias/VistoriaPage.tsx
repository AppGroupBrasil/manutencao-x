import React, { useState, useRef, useMemo, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import Modal from '../../components/Common/Modal';
import { validarImagem } from '../../utils/imageUtils';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Plus, Camera, X, Upload, ChevronRight, AlertTriangle, Hash,
  Search, Eye, MapPin, Calendar, MessageCircle, Settings, Save,
  Trash2, Image, FileText, CheckCircle2
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { vistorias as vistoriasApi, condominios as condominiosApi, moradores as moradoresApi, reportes as reportesApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import styles from './Vistoria.module.css';

/* ── Tipos ── */
interface FotoVistoria {
  id: string;
  url: string;
  descricao: string;
}

interface ItemVistoria {
  id: string;
  local: string;
  descricao: string;
  fotos: FotoVistoria[];
  status: 'pendente' | 'conforme' | 'nao_conforme' | 'atencao';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  observacao: string;
}

interface Vistoria {
  id: string;
  titulo: string;
  condominio: string;
  tipo: 'rotina' | 'preventiva' | 'corretiva' | 'entrega';
  data: string;
  responsavel: string;
  itens: ItemVistoria[];
  status: 'pendente' | 'em_andamento' | 'concluida';
  criadoEm: number;
}

interface ProblemaReport {
  itemId: string;
  vistoriaId: string;
  descricao: string;
  status: string;
  prioridade: string;
  imagens: string[];
}

interface AntesDepois {
  itemId: string;
  vistoriaId: string;
  fotoAntes: string | null;
  descAntes: string;
  fotoDepois: string | null;
  descDepois: string;
}

interface ContatoWhats {
  id: string;
  nome: string;
  telefone: string;
}

/* ── Helpers ── */
function gerarProtocolo(): string {
  const a = new Date();
  return `VST-${a.getFullYear().toString().slice(2)}${String(a.getMonth() + 1).padStart(2, '0')}${String(a.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

const CORES_CHART = ['#2e7d32', '#f57c00', '#9e9e9e'];

/* ── Componente ── */
const VistoriaPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [condominiosNomes, setCondominiosNomes] = useState<string[]>([]);
  const [contatosWhats, setContatosWhats] = useState<ContatoWhats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    Promise.all([
      vistoriasApi.list().catch(() => []),
      condominiosApi.list().catch(() => []),
      moradoresApi.listWhatsContatos().catch(() => []),
    ]).then(([vst, conds, contatos]: any[]) => {
      setVistorias(vst);
      setCondominiosNomes(conds.length ? conds.map((c: any) => c.nome) : []);
      setContatosWhats(contatos);
    }).finally(() => setLoading(false));
  }, []);

  const CONDOMINIOS = condominiosNomes;

  // Modal: Nova Vistoria
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [novoForm, setNovoForm] = useState({
    titulo: '', condominio: CONDOMINIOS[0], tipo: 'rotina' as Vistoria['tipo'], responsavel: '',
  });
  const [novosItens, setNovosItens] = useState<{ local: string; descricao: string }[]>([{ local: '', descricao: '' }]);

  // Modal: Detalhes da Vistoria
  const [detalheVistoria, setDetalheVistoria] = useState<Vistoria | null>(null);

  // Modal: Galeria de Fotos do Item
  const [galeriaItem, setGaleriaItem] = useState<{ vistoriaId: string; item: ItemVistoria } | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [descFotoNova, setDescFotoNova] = useState('');

  // Reportar Problema
  const [problemaModal, setProblemaModal] = useState<{ vistoriaId: string; itemId: string; itemDesc: string } | null>(null);
  const [problema, setProblema] = useState<ProblemaReport>({ itemId: '', vistoriaId: '', descricao: '', status: 'aberto', prioridade: 'media', imagens: [] });
  const [protocolo, setProtocolo] = useState('');
  const problemaInputRef = useRef<HTMLInputElement>(null);

  // Antes/Depois
  const [antesDepoisModal, setAntesDepoisModal] = useState<{ vistoriaId: string; itemId: string; itemDesc: string } | null>(null);
  const [antesDepois, setAntesDepois] = useState<AntesDepois>({ itemId: '', vistoriaId: '', fotoAntes: null, descAntes: '', fotoDepois: null, descDepois: '' });
  const antesInputRef = useRef<HTMLInputElement>(null);
  const depoisInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp
  const [contatoSelecionado, setContatoSelecionado] = useState<string>('');
  const [whatsNome, setWhatsNome] = useState('');
  const [whatsTelefone, setWhatsTelefone] = useState('');
  const [showWhatsConfig, setShowWhatsConfig] = useState(false);

  useEffect(() => {
    if (contatosWhats.length && !contatoSelecionado) setContatoSelecionado(contatosWhats[0]?.id || '');
  }, [contatosWhats]);

  const salvarNovoContato = async () => {
    if (!whatsNome.trim() || !whatsTelefone.trim()) return;
    try {
      const novo = await moradoresApi.addWhatsContato({ nome: whatsNome.trim(), telefone: whatsTelefone.trim() });
      const atualizado = [...contatosWhats, novo];
      setContatosWhats(atualizado);
      setContatoSelecionado(atualizado.length === 1 ? novo.id : contatoSelecionado || novo.id);
      setWhatsNome(''); setWhatsTelefone('');
    } catch { alert('Erro ao salvar contato'); }
  };
  const removerContato = async (id: string) => {
    try {
      await moradoresApi.removeWhatsContato(id);
      const atualizado = contatosWhats.filter(c => c.id !== id);
      setContatosWhats(atualizado);
      if (contatoSelecionado === id) setContatoSelecionado(atualizado[0]?.id || '');
    } catch { alert('Erro ao remover contato'); }
  };
  const formatarTelefone = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    return v;
  };

  /* ── Filtro + Busca ── */
  const filtrados = useMemo(() => {
    let lista = vistorias;
    if (filtro !== 'todos') lista = lista.filter(v => v.status === filtro);
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(v => {
        const texto = `${v.titulo} ${v.condominio} ${v.id} ${v.tipo} ${v.responsavel} ${v.itens.map(i => `${i.local} ${i.descricao}`).join(' ')}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }
    return lista;
  }, [vistorias, filtro, busca]);

  /* ── Chart ── */
  const chartData = useMemo(() => [
    { nome: 'Concluídas', valor: vistorias.filter(v => v.status === 'concluida').length },
    { nome: 'Em Andamento', valor: vistorias.filter(v => v.status === 'em_andamento').length },
    { nome: 'Pendentes', valor: vistorias.filter(v => v.status === 'pendente').length },
  ], [vistorias]);

  /* ── Criar Vistoria ── */
  const criarVistoria = async () => {
    if (!tentarAcao()) return;
    if (!novoForm.titulo.trim() || !novoForm.responsavel.trim() || novosItens.every(i => !i.local.trim())) return;
    try {
      const nova = await vistoriasApi.create({
        titulo: novoForm.titulo.trim(),
        condominio: novoForm.condominio,
        tipo: novoForm.tipo,
        data: new Date().toISOString().split('T')[0],
        responsavel: novoForm.responsavel.trim(),
        status: 'pendente',
        itens: novosItens.filter(i => i.local.trim()).map((it, idx) => ({
          id: `vi-${Date.now()}-${idx}`,
          local: it.local.trim(),
          descricao: it.descricao.trim() || 'Verificar condições gerais',
          fotos: [],
          status: 'pendente',
          prioridade: 'media',
          observacao: '',
        })),
      });
      setVistorias(prev => [nova, ...prev]);
    } catch { alert('Erro ao criar vistoria'); }
    setNovoForm({ titulo: '', condominio: CONDOMINIOS[0], tipo: 'rotina', responsavel: '' });
    setNovosItens([{ local: '', descricao: '' }]);
    setShowNovaModal(false);
  };

  /* ── Atualizar status de item ── */
  const atualizarStatusItem = async (vistoriaId: string, itemId: string, novoStatus: ItemVistoria['status']) => {
    const vistoria = vistorias.find(v => v.id === vistoriaId);
    if (!vistoria) return;
    const itensAtualizados = vistoria.itens.map(i => i.id === itemId ? { ...i, status: novoStatus } : i);
    const todosConformes = itensAtualizados.every(i => i.status === 'conforme' || i.status === 'atencao');
    const algumNaoConf = itensAtualizados.some(i => i.status !== 'pendente');
    let statusVistoria = vistoria.status;
    if (todosConformes && itensAtualizados.length > 0) statusVistoria = 'concluida';
    else if (algumNaoConf) statusVistoria = 'em_andamento';
    try {
      await vistoriasApi.update(vistoriaId, { itens: itensAtualizados, status: statusVistoria });
      setVistorias(prev => prev.map(v => v.id === vistoriaId ? { ...v, itens: itensAtualizados, status: statusVistoria } : v));
    } catch { alert('Erro ao atualizar item'); }
    // Atualizar detalhe se aberto
    if (detalheVistoria?.id === vistoriaId) {
      setDetalheVistoria(prev => {
        if (!prev) return prev;
        const itens = prev.itens.map(i => i.id === itemId ? { ...i, status: novoStatus } : i);
        return { ...prev, itens };
      });
    }
  };

  /* ── Fotos da Galeria ── */
  const handleAddFotoGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !galeriaItem) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const novaFoto: FotoVistoria = { id: `f-${Date.now()}`, url: ev.target.result as string, descricao: descFotoNova.trim() || `Foto ${galeriaItem.item.fotos.length + 1}` };
        setVistorias(prev => prev.map(v => {
          if (v.id !== galeriaItem.vistoriaId) return v;
          return { ...v, itens: v.itens.map(i => i.id === galeriaItem.item.id ? { ...i, fotos: [...i.fotos, novaFoto] } : i) };
        }));
        setGaleriaItem(prev => prev ? { ...prev, item: { ...prev.item, fotos: [...prev.item.fotos, novaFoto] } } : prev);
        setDescFotoNova('');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removerFotoGaleria = (fotoId: string) => {
    if (!galeriaItem) return;
    setVistorias(prev => prev.map(v => {
      if (v.id !== galeriaItem.vistoriaId) return v;
      return { ...v, itens: v.itens.map(i => i.id === galeriaItem.item.id ? { ...i, fotos: i.fotos.filter(f => f.id !== fotoId) } : i) };
    }));
    setGaleriaItem(prev => prev ? { ...prev, item: { ...prev.item, fotos: prev.item.fotos.filter(f => f.id !== fotoId) } } : prev);
  };

  /* ── Ações: Reportar Problema ── */
  const abrirProblema = (vistoriaId: string, itemId: string, itemDesc: string) => {
    setProblema({ itemId, vistoriaId, descricao: '', status: 'aberto', prioridade: 'media', imagens: [] });
    setProtocolo(gerarProtocolo());
    setProblemaModal({ vistoriaId, itemId, itemDesc });
  };

  const abrirAntesDepois = (vistoriaId: string, itemId: string, itemDesc: string) => {
    setAntesDepois({ itemId, vistoriaId, fotoAntes: null, descAntes: '', fotoDepois: null, descDepois: '' });
    setAntesDepoisModal({ vistoriaId, itemId, itemDesc });
  };

  const handleImagemProblema = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const erro = validarImagem(file);
      if (erro) { alert(erro); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setProblema(prev => ({ ...prev, imagens: [...prev.imagens, ev.target!.result as string] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const enviarReporte = async () => {
    if (!tentarAcao()) return;
    const reporte = {
      protocolo, itemDesc: problemaModal?.itemDesc || '', vistoriaId: problema.vistoriaId,
      descricao: problema.descricao, status: problema.status, prioridade: problema.prioridade,
      imagens: problema.imagens, data: new Date().toISOString(), origem: 'vistoria',
    };
    try {
      await reportesApi.create(reporte);
    } catch { /* ignore */ }
    // Marcar item como não conforme
    atualizarStatusItem(problema.vistoriaId, problema.itemId, 'nao_conforme');
    alert('Problema reportado com sucesso! Protocolo: ' + protocolo);
    setProblemaModal(null);
  };

  const handleFoto = (tipo: 'antes' | 'depois', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        if (tipo === 'antes') setAntesDepois(prev => ({ ...prev, fotoAntes: ev.target!.result as string }));
        else setAntesDepois(prev => ({ ...prev, fotoDepois: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Helpers visuais ── */
  const statusLabel = (s: ItemVistoria['status']) => {
    const map = { pendente: 'Pendente', conforme: 'Conforme', nao_conforme: 'Não Conforme', atencao: 'Atenção' };
    return map[s];
  };
  const statusVariante = (s: ItemVistoria['status']) => {
    const map: Record<string, 'neutro' | 'sucesso' | 'perigo' | 'aviso'> = { pendente: 'neutro', conforme: 'sucesso', nao_conforme: 'perigo', atencao: 'aviso' };
    return map[s];
  };
  const prioridadeLabel = (p: string) => {
    const map: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
    return map[p] || p;
  };
  const prioridadeCor = (p: string) => {
    const map: Record<string, string> = { baixa: '#4caf50', media: '#ff9800', alta: '#f44336', urgente: '#b71c1c' };
    return map[p] || '#999';
  };
  const tipoLabel = (t: string) => {
    const map: Record<string, string> = { rotina: 'Rotina', preventiva: 'Preventiva', corretiva: 'Corretiva', entrega: 'Entrega' };
    return map[t] || t;
  };

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando vistorias..." />;

  return (
    <div id="vistorias-content">
      <HowItWorks
        titulo="Vistorias"
        descricao="Realize vistoria com galeria de fotos, descrições detalhadas, status e prioridade para cada item inspecionado."
        passos={[
          'Crie uma nova vistoria definindo título, condomínio, tipo e responsável',
          'Adicione os locais/itens a serem vistoriados',
          'Para cada item, adicione fotos com descrição na galeria',
          'Defina status (Conforme, Não Conforme, Atenção) e prioridade',
          'Reporte problemas com fotos e registre antes/depois',
          'Acompanhe o progresso de cada vistoria em tempo real',
        ]}
      />

      <PageHeader
        titulo="Vistorias"
        subtitulo={`${filtrados.length} vistorias`}
        onCompartilhar={() => compartilharConteudo('Vistorias', 'Listagem de vistorias')}
        onImprimir={() => imprimirElemento('vistorias-content')}
        onGerarPdf={() => gerarPdfDeElemento('vistorias-content', 'vistorias')}
        acoes={
          <button className={styles.addBtn} onClick={() => setShowNovaModal(true)}>
            <Plus size={18} /> <span>Nova Vistoria</span>
          </button>
        }
      />

      {/* Busca */}
      <div className={styles.buscaArea}>
        <Search size={18} className={styles.buscaIcon} />
        <input className={styles.buscaInput} placeholder="Buscar por título, condomínio, local..." value={busca} onChange={e => setBusca(e.target.value)} />
        {busca && <button className={styles.buscaLimpar} onClick={() => setBusca('')}><X size={16} /></button>}
      </div>

      {/* Filtros */}
      <div className={styles.filters}>
        {(['todos', 'pendente', 'em_andamento', 'concluida'] as const).map(f => {
          const labels: Record<string, string> = { todos: 'Todas', pendente: 'Pendentes', em_andamento: 'Em Andamento', concluida: 'Concluídas' };
          const baseClass = f === 'todos' ? styles.tabTodos : f === 'pendente' ? styles.tabPendente : f === 'em_andamento' ? styles.tabAndamento : styles.tabConcluida;
          const activeClass = f === 'todos' ? styles.tabTodosActive : f === 'pendente' ? styles.tabPendenteActive : f === 'em_andamento' ? styles.tabAndamentoActive : styles.tabConcluidaActive;
          return (
            <button key={f} className={`${styles.filterTab} ${baseClass} ${filtro === f ? activeClass : ''}`} onClick={() => setFiltro(f)}>
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Lista de Vistorias */}
      <div className={styles.list}>
        {filtrados.length === 0 ? (
          <div className={styles.vazio}><Eye size={40} strokeWidth={1.2} /><span>Nenhuma vistoria encontrada</span></div>
        ) : pag.items.map(vst => {
          const conformes = vst.itens.filter(i => i.status === 'conforme').length;
          const naoConf = vst.itens.filter(i => i.status === 'nao_conforme').length;
          const total = vst.itens.length;
          const pct = total > 0 ? Math.round((conformes / total) * 100) : 0;
          return (
            <Card key={vst.id} hover padding="md">
              <div className={styles.vstCard}>
                <div className={styles.vstTop}>
                  <span className={styles.vstId}><Hash size={12} />{vst.id}</span>
                  <span className={styles.vstTipo}>{tipoLabel(vst.tipo)}</span>
                  <StatusBadge
                    texto={vst.status === 'concluida' ? 'Concluída' : vst.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                    variante={vst.status === 'concluida' ? 'sucesso' : vst.status === 'em_andamento' ? 'aviso' : 'neutro'}
                  />
                </div>
                <h4 className={styles.vstTitulo}>{vst.titulo}</h4>
                <div className={styles.vstMeta}>
                  <span><MapPin size={13} /> {vst.condominio}</span>
                  <span><Calendar size={13} /> {vst.data}</span>
                </div>
                <div className={styles.vstResumo}>
                  <span className={styles.vstConf}><CheckCircle2 size={13} /> {conformes} conformes</span>
                  {naoConf > 0 && <span className={styles.vstNaoConf}><AlertTriangle size={13} /> {naoConf} não conformes</span>}
                  <span className={styles.vstTotal}>{total} itens</span>
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
                  <span className={styles.progressText}>{pct}% conforme</span>
                </div>
                <button className={styles.vstDetalhes} onClick={() => setDetalheVistoria(vst)}>
                  <Eye size={15} /> Ver Detalhes e Fotos
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {/* Gráfico */}
      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--cor-texto)', margin: '0 0 20px' }}>Status das Vistorias</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="valor" nameKey="nome" label>
                {chartData.map((_, i) => <Cell key={i} fill={CORES_CHART[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ═══ Modal: Nova Vistoria ═══ */}
      <Modal aberto={showNovaModal} onFechar={() => setShowNovaModal(false)} titulo="Nova Vistoria" largura="md">
        <div className={styles.formGrid}>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Título</label>
            <input className={styles.formInput} placeholder="Ex: Vistoria Área Comuns - Bloco B" value={novoForm.titulo} onChange={e => setNovoForm(p => ({ ...p, titulo: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Condomínio</label>
            <select className={styles.formSelect} value={novoForm.condominio} onChange={e => setNovoForm(p => ({ ...p, condominio: e.target.value }))}>
              {CONDOMINIOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tipo</label>
            <select className={styles.formSelect} value={novoForm.tipo} onChange={e => setNovoForm(p => ({ ...p, tipo: e.target.value as Vistoria['tipo'] }))}>
              <option value="rotina">Rotina</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
              <option value="entrega">Entrega</option>
            </select>
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Responsável</label>
            <input className={styles.formInput} placeholder="Nome do responsável" value={novoForm.responsavel} onChange={e => setNovoForm(p => ({ ...p, responsavel: e.target.value }))} />
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Locais / Itens a vistoriar</label>
            <div className={styles.itensLista}>
              {novosItens.map((it, idx) => (
                <div key={idx} className={styles.itemRow}>
                  <input className={styles.formInput} placeholder={`Local ${idx + 1}`} value={it.local} onChange={e => setNovosItens(prev => prev.map((v, i) => i === idx ? { ...v, local: e.target.value } : v))} style={{ flex: 1 }} />
                  <input className={styles.formInput} placeholder="Descrição" value={it.descricao} onChange={e => setNovosItens(prev => prev.map((v, i) => i === idx ? { ...v, descricao: e.target.value } : v))} style={{ flex: 2 }} />
                  {novosItens.length > 1 && <button className={styles.itemRemoveBtn} onClick={() => setNovosItens(prev => prev.filter((_, i) => i !== idx))}><X size={16} /></button>}
                </div>
              ))}
              <button className={styles.itemAddBtn} onClick={() => setNovosItens(prev => [...prev, { local: '', descricao: '' }])}>
                <Plus size={16} /> Adicionar Local
              </button>
            </div>
          </div>

          <button className={styles.formSubmit} onClick={criarVistoria}>
            <Plus size={18} /> Criar Vistoria
          </button>
        </div>
      </Modal>

      {/* ═══ Modal: Detalhes da Vistoria ═══ */}
      <Modal aberto={!!detalheVistoria} onFechar={() => setDetalheVistoria(null)} titulo={detalheVistoria?.titulo || 'Detalhes'} largura="lg">
        {detalheVistoria && (
          <div className={styles.detalheModal}>
            <div className={styles.detalheMeta}>
              <span><Hash size={13} />{detalheVistoria.id}</span>
              <span><MapPin size={13} />{detalheVistoria.condominio}</span>
              <span><Calendar size={13} />{detalheVistoria.data}</span>
              <span className={styles.vstTipo}>{tipoLabel(detalheVistoria.tipo)}</span>
            </div>

            <div className={styles.detalheItens}>
              {detalheVistoria.itens.map(item => (
                <div key={item.id} className={styles.detalheItem}>
                  <div className={styles.detalheItemHeader}>
                    <div className={styles.detalheItemInfo}>
                      <strong>{item.local}</strong>
                      <span>{item.descricao}</span>
                    </div>
                    <div className={styles.detalheItemBadges}>
                      <span className={styles.prioridadeBadge} style={{ background: prioridadeCor(item.prioridade) + '20', color: prioridadeCor(item.prioridade), borderColor: prioridadeCor(item.prioridade) }}>
                        {prioridadeLabel(item.prioridade)}
                      </span>
                      <StatusBadge texto={statusLabel(item.status)} variante={statusVariante(item.status)} />
                    </div>
                  </div>

                  {/* Status select */}
                  <div className={styles.detalheItemActions}>
                    <select
                      className={styles.statusSelect}
                      value={item.status}
                      onChange={e => atualizarStatusItem(detalheVistoria.id, item.id, e.target.value as ItemVistoria['status'])}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="conforme">Conforme</option>
                      <option value="nao_conforme">Não Conforme</option>
                      <option value="atencao">Atenção</option>
                    </select>

                    <button className={styles.btnGaleria} onClick={() => setGaleriaItem({ vistoriaId: detalheVistoria.id, item })}>
                      <Camera size={14} /> Adicionar Fotos ({item.fotos.length})
                    </button>
                    <button className={styles.btnProblema} onClick={() => abrirProblema(detalheVistoria.id, item.id, `${item.local} - ${item.descricao}`)}>
                      <AlertTriangle size={14} /> Reportar Problema
                    </button>
                    <button className={styles.btnAntesDepois} onClick={() => abrirAntesDepois(detalheVistoria.id, item.id, `${item.local} - ${item.descricao}`)}>
                      <Camera size={14} /> Antes e Depois
                    </button>
                  </div>

                  {/* Mini galeria preview */}
                  {item.fotos.length > 0 && (
                    <div className={styles.miniGaleria}>
                      {item.fotos.slice(0, 4).map(f => (
                        <div key={f.id} className={styles.miniThumb}>
                          <img src={f.url} alt={f.descricao} />
                        </div>
                      ))}
                      {item.fotos.length > 4 && <span className={styles.miniMais}>+{item.fotos.length - 4}</span>}
                    </div>
                  )}

                  {item.observacao && <p className={styles.detalheObs}>{item.observacao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ Modal: Galeria de Fotos ═══ */}
      <Modal aberto={!!galeriaItem} onFechar={() => setGaleriaItem(null)} titulo={`📷 Galeria — ${galeriaItem?.item.local || ''}`} largura="lg">
        {galeriaItem && (
          <div className={styles.galeriaModal}>
            <div className={styles.galeriaAdd}>
              <input className={styles.formInput} placeholder="Descrição da foto (opcional)" value={descFotoNova} onChange={e => setDescFotoNova(e.target.value)} style={{ flex: 1 }} />
              <input ref={fotoInputRef} type="file" accept="image/*" hidden onChange={handleAddFotoGaleria} />
              <button className={styles.fotoAddBtn} onClick={() => fotoInputRef.current?.click()}>
                <Camera size={16} /> Adicionar Foto
              </button>
            </div>

            {galeriaItem.item.fotos.length === 0 ? (
              <div className={styles.vazio} style={{ padding: '40px 0' }}><Image size={36} strokeWidth={1.2} /><span>Nenhuma foto adicionada</span></div>
            ) : (
              <div className={styles.galeriaGrid}>
                {galeriaItem.item.fotos.map(foto => (
                  <div key={foto.id} className={styles.galeriaFoto}>
                    <img src={foto.url} alt={foto.descricao} />
                    <div className={styles.galeriaFotoInfo}>
                      <span>{foto.descricao}</span>
                      <button className={styles.galeriaFotoRemover} onClick={() => removerFotoGaleria(foto.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ Modal: Reportar Problema ═══ */}
      <Modal aberto={!!problemaModal} onFechar={() => setProblemaModal(null)} titulo="Reportar Problema" largura="md">
        <div className={styles.problemaForm}>
          <div className={styles.protocoloHeader}>
            <div className={styles.protocoloTag}><Hash size={14} /><span>{protocolo}</span></div>
          </div>
          <p className={styles.modalItemDesc}>Item: <strong>{problemaModal?.itemDesc}</strong></p>

          <label className={styles.formLabel}>Imagens</label>
          <div className={styles.imagensArea}>
            {problema.imagens.map((img, i) => (
              <div key={i} className={styles.imagemThumb}>
                <img src={img} alt={`Imagem ${i + 1}`} />
                <button className={styles.imagemRemover} onClick={() => setProblema(prev => ({ ...prev, imagens: prev.imagens.filter((_, j) => j !== i) }))}><X size={14} /></button>
              </div>
            ))}
            <button className={styles.imagemAdd} onClick={() => problemaInputRef.current?.click()}>
              <Upload size={20} /><span>Adicionar</span>
            </button>
            <input ref={problemaInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagemProblema} />
          </div>

          <label className={styles.formLabel}>Descrição do Problema</label>
          <textarea className={styles.formTextarea} placeholder="Descreva o problema encontrado..." value={problema.descricao} onChange={e => setProblema(prev => ({ ...prev, descricao: e.target.value }))} rows={4} />

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status</label>
              <select className={styles.formSelect} value={problema.status} onChange={e => setProblema(prev => ({ ...prev, status: e.target.value }))}>
                <option value="aberto">Aberto</option>
                <option value="em_analise">Em Análise</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prioridade</label>
              <select className={styles.formSelect} value={problema.prioridade} onChange={e => setProblema(prev => ({ ...prev, prioridade: e.target.value }))}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <button className={styles.formSubmit} onClick={enviarReporte}>
            <AlertTriangle size={16} /> Enviar Reporte
          </button>

          {/* WhatsApp */}
          <div className={styles.whatsSection}>
            <div className={styles.whatsHeader}>
              <button className={styles.whatsBtn} onClick={() => {
                const contato = contatosWhats.find(c => c.id === contatoSelecionado);
                if (!contato) { setShowWhatsConfig(true); return; }
                const num = contato.telefone.replace(/\D/g, '');
                const texto = encodeURIComponent(`*Problema na Vistoria*\n*Protocolo:* ${protocolo}\n\n*Item:* ${problemaModal?.itemDesc}\n*Descrição:* ${problema.descricao || 'N/A'}\n*Status:* ${problema.status}\n*Prioridade:* ${problema.prioridade}`);
                window.open(`https://wa.me/55${num}?text=${texto}`, '_blank');
              }}>
                <MessageCircle size={18} /> Enviar para WhatsApp
              </button>
              <button className={`${styles.whatsConfigBtn} ${showWhatsConfig ? styles.whatsConfigBtnActive : ''}`} onClick={() => setShowWhatsConfig(prev => !prev)} title="Configurar Contatos">
                <Settings size={18} />
              </button>
            </div>
            {contatosWhats.length > 0 && (
              <div className={styles.whatsContatoSelect}>
                <label className={styles.formLabel}>Enviar para:</label>
                <select className={styles.formSelect} value={contatoSelecionado} onChange={e => setContatoSelecionado(e.target.value)}>
                  {contatosWhats.map(c => <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>)}
                </select>
              </div>
            )}
            {showWhatsConfig && (
              <div className={styles.whatsConfigPanel}>
                <h5 className={styles.whatsConfigTitle}>Adicionar Contato</h5>
                <div className={styles.whatsConfigFields}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nome</label>
                    <input className={styles.formInput} placeholder="Nome" value={whatsNome} onChange={e => setWhatsNome(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>WhatsApp</label>
                    <input className={styles.formInput} placeholder="(00) 00000-0000" value={whatsTelefone} maxLength={15} onChange={e => setWhatsTelefone(formatarTelefone(e.target.value))} />
                  </div>
                  <button className={styles.whatsSaveBtn} onClick={salvarNovoContato}><Save size={15} /> Salvar</button>
                </div>
                {contatosWhats.length > 0 && (
                  <div className={styles.whatsContatosList}>
                    <h5 className={styles.whatsConfigTitle}>Contatos Salvos</h5>
                    {contatosWhats.map(c => (
                      <div key={c.id} className={styles.whatsContatoItem}>
                        <div className={styles.whatsContatoInfo}><strong>{c.nome}</strong><span>{c.telefone}</span></div>
                        <button className={styles.whatsContatoRemover} onClick={() => removerContato(c.id)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ═══ Modal: Antes e Depois ═══ */}
      <Modal aberto={!!antesDepoisModal} onFechar={() => setAntesDepoisModal(null)} titulo="Ante e Depois" largura="lg">
        <div className={styles.antesDepoisForm}>
          <p className={styles.modalItemDesc}>Item: <strong>{antesDepoisModal?.itemDesc}</strong></p>
          <div className={styles.antesDepoisGrid}>
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}><span className={styles.adBadgeAntes}>ANTES</span></h4>
              {antesDepois.fotoAntes ? (
                <div className={styles.adFotoContainer}>
                  <img src={antesDepois.fotoAntes} alt="Antes" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => setAntesDepois(prev => ({ ...prev, fotoAntes: null }))}><X size={14} /></button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => antesInputRef.current?.click()}>
                  <Camera size={32} /><span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={antesInputRef} type="file" accept="image/*" hidden onChange={e => handleFoto('antes', e)} />
              <textarea className={styles.formTextarea} placeholder="Descrição do estado antes..." value={antesDepois.descAntes} onChange={e => setAntesDepois(prev => ({ ...prev, descAntes: e.target.value }))} rows={3} />
            </div>
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}><span className={styles.adBadgeDepois}>DEPOIS</span></h4>
              {antesDepois.fotoDepois ? (
                <div className={styles.adFotoContainer}>
                  <img src={antesDepois.fotoDepois} alt="Depois" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => setAntesDepois(prev => ({ ...prev, fotoDepois: null }))}><X size={14} /></button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => depoisInputRef.current?.click()}>
                  <Camera size={32} /><span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={depoisInputRef} type="file" accept="image/*" hidden onChange={e => handleFoto('depois', e)} />
              <textarea className={styles.formTextarea} placeholder="Descrição do estado depois..." value={antesDepois.descDepois} onChange={e => setAntesDepois(prev => ({ ...prev, descDepois: e.target.value }))} rows={3} />
            </div>
          </div>
          {antesDepois.fotoAntes && antesDepois.fotoDepois && (
            <div className={styles.adComparacao}>
              <h4 className={styles.adCompTitulo}>Comparação</h4>
              <div className={styles.adCompGrid}>
                <div className={styles.adCompItem}><span className={styles.adBadgeAntes}>ANTES</span><img src={antesDepois.fotoAntes} alt="Antes" /><p>{antesDepois.descAntes || 'Sem descrição'}</p></div>
                <div className={styles.adCompItem}><span className={styles.adBadgeDepois}>DEPOIS</span><img src={antesDepois.fotoDepois} alt="Depois" /><p>{antesDepois.descDepois || 'Sem descrição'}</p></div>
              </div>
            </div>
          )}
          <button className={styles.formSubmit} onClick={() => { alert('Registro Antes/Depois salvo com sucesso!'); setAntesDepoisModal(null); }}>
            <Camera size={16} /> Salvar Registro
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default VistoriaPage;
