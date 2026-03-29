import React, { useState, useRef, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import Modal from '../../components/Common/Modal';
import { validarImagem } from '../../utils/imageUtils';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import type { ChecklistLimpeza } from '../../types';
import { Plus, CheckCircle2, ClipboardCheck, MoreVertical, AlertTriangle, Camera, X, Upload, ChevronRight, MessageCircle, Settings, Save, Trash2, Hash, Search, Minus, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { checklists as checklistsApi, reportes as reportesApi, moradores as moradoresApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import styles from './Checklists.module.css';

interface ProblemaReport {
  itemId: string;
  checklistId: string;
  descricao: string;
  status: string;
  prioridade: string;
  imagens: string[];
}

interface AntesDepois {
  itemId: string;
  checklistId: string;
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

function gerarProtocolo(): string {
  const agora = new Date();
  const ano = agora.getFullYear().toString().slice(2);
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `RPT-${ano}${mes}${dia}-${seq}`;
}

const CORES = ['#2e7d32', '#f57c00', '#9e9e9e'];

const ChecklistsPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [checklists, setChecklists] = useState<ChecklistLimpeza[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  // Modal Novo Checklist
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novoLocal, setNovoLocal] = useState('');
  const [novoTipo, setNovoTipo] = useState<'diaria' | 'semanal' | 'mensal' | 'especial'>('diaria');
  const [novoCond, setNovoCond] = useState('c1');
  const [novosItens, setNovosItens] = useState<string[]>(['']);

  // Config Locais
  interface LocalPreset { id: number; nome: string; itens_padrao: string[]; condominio_id?: string; }
  const [locaisPresets, setLocaisPresets] = useState<LocalPreset[]>([]);
  const [showConfigLocais, setShowConfigLocais] = useState(false);
  const [cfgNome, setCfgNome] = useState('');
  const [cfgItens, setCfgItens] = useState<string[]>(['']);
  const [editandoLocal, setEditandoLocal] = useState<number | null>(null);

  const adicionarItem = () => setNovosItens(prev => [...prev, '']);
  const removerItem = (idx: number) => setNovosItens(prev => prev.filter((_, i) => i !== idx));
  const atualizarItem = (idx: number, val: string) => setNovosItens(prev => prev.map((v, i) => i === idx ? val : v));

  const criarChecklist = async () => {
    if (!tentarAcao()) return;
    if (!novoLocal.trim() || novosItens.every(i => !i.trim())) return;
    const payload = {
      condominioId: novoCond,
      local: novoLocal.trim(),
      tipo: novoTipo,
      itens: novosItens.filter(i => i.trim()).map((desc, idx) => ({ id: String(idx + 1), descricao: desc.trim(), concluido: false })),
      responsavelId: 'func-001',
      data: new Date().toISOString().split('T')[0],
      status: 'pendente',
      criadoPor: 'sup-001',
      criadoEm: Date.now(),
    };
    try {
      const criado = await checklistsApi.create(payload) as ChecklistLimpeza;
      setChecklists(prev => [criado, ...prev]);
    } catch (err) { console.error(err); }
    setNovoLocal('');
    setNovoTipo('diaria');
    setNovoCond('c1');
    setNovosItens(['']);
    setShowNovoModal(false);
  };

  // Ações modal (2 opções: Reportar Problema + Antes/Depois)
  const [acoesModal, setAcoesModal] = useState<{ ckId: string; itemId: string; itemDesc: string } | null>(null);

  // Reportar Problema
  const [problemaModal, setProblemaModal] = useState<{ ckId: string; itemId: string; itemDesc: string } | null>(null);
  const [problema, setProblema] = useState<ProblemaReport>({ itemId: '', checklistId: '', descricao: '', status: 'aberto', prioridade: 'media', imagens: [] });
  const [protocolo, setProtocolo] = useState('');
  const problemaInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp Contatos
  const [contatosWhats, setContatosWhats] = useState<ContatoWhats[]>([]);
  const [contatoSelecionado, setContatoSelecionado] = useState<string>('');
  const [whatsNome, setWhatsNome] = useState('');
  const [whatsTelefone, setWhatsTelefone] = useState('');
  const [showWhatsConfig, setShowWhatsConfig] = useState(false);

  const handleSalvarLocal = async () => {
    if (!cfgNome.trim()) return;
    const itensFiltrados = cfgItens.filter(i => i.trim());
    try {
      if (editandoLocal === null) {
        const row = await checklistsApi.criarLocal({ nome: cfgNome.trim(), itensPadrao: itensFiltrados });
        setLocaisPresets(prev => [...prev, row]);
      } else {
        const row = await checklistsApi.atualizarLocal(editandoLocal, { nome: cfgNome.trim(), itensPadrao: itensFiltrados });
        setLocaisPresets(prev => prev.map(l => l.id === editandoLocal ? row : l));
      }
    } catch { /* ignore */ }
    setCfgNome('');
    setCfgItens(['']);
    setEditandoLocal(null);
  };

  const handleExcluirLocal = async (id: number) => {
    try {
      await checklistsApi.excluirLocal(id);
      setLocaisPresets(prev => prev.filter(l => l.id !== id));
    } catch { /* ignore */ }
  };

  const selecionarLocal = (preset: LocalPreset) => {
    setNovoLocal(preset.nome);
    if (preset.itens_padrao?.length > 0) {
      setNovosItens(preset.itens_padrao);
    }
  };

  useEffect(() => {
    Promise.all([
      checklistsApi.list(),
      moradoresApi.listWhatsContatos().catch(() => []),
      checklistsApi.locais().catch(() => []),
    ]).then(([cks, contatos, locs]) => {
      setChecklists(cks as ChecklistLimpeza[]);
      setContatosWhats(contatos as ContatoWhats[]);
      if (Array.isArray(locs)) setLocaisPresets(locs as LocalPreset[]);
      if ((contatos as ContatoWhats[]).length > 0) setContatoSelecionado((contatos as ContatoWhats[])[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const salvarNovoContato = async () => {
    if (!whatsNome.trim() || !whatsTelefone.trim()) return;
    try {
      const novo = await moradoresApi.addWhatsContato({ nome: whatsNome.trim(), telefone: whatsTelefone.trim() }) as ContatoWhats;
      setContatosWhats(prev => [...prev, novo]);
      if (!contatoSelecionado) setContatoSelecionado(novo.id);
    } catch (err) { console.error(err); }
    setWhatsNome('');
    setWhatsTelefone('');
  };

  const removerContato = async (id: string) => {
    try {
      await moradoresApi.removeWhatsContato(id);
      setContatosWhats(prev => prev.filter(c => c.id !== id));
      if (contatoSelecionado === id) setContatoSelecionado(contatosWhats.filter(c => c.id !== id)[0]?.id || '');
    } catch (err) { console.error(err); }
  };

  const formatarTelefone = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    return v;
  };

  // Antes/Depois
  const [antesDepoisModal, setAntesDepoisModal] = useState<{ ckId: string; itemId: string; itemDesc: string } | null>(null);
  const [antesDepois, setAntesDepois] = useState<AntesDepois>({ itemId: '', checklistId: '', fotoAntes: null, descAntes: '', fotoDepois: null, descDepois: '' });
  const antesInputRef = useRef<HTMLInputElement>(null);
  const depoisInputRef = useRef<HTMLInputElement>(null);

  const enviarReporte = async () => {
    if (!tentarAcao()) return;
    const reporte = {
      protocolo,
      itemDesc: problemaModal?.itemDesc || '',
      checklistId: problema.checklistId,
      descricao: problema.descricao,
      status: problema.status,
      prioridade: problema.prioridade,
      imagens: problema.imagens,
      data: new Date().toISOString(),
    };
    try {
      await reportesApi.create(reporte);
    } catch { /* ignore */ }
    alert('Problema reportado com sucesso! Protocolo: ' + protocolo);
    setProblemaModal(null);
  };

  const abrirAcoes = (ckId: string, itemId: string, itemDesc: string) => {
    setAcoesModal({ ckId, itemId, itemDesc });
  };

  const abrirProblema = () => {
    if (!acoesModal) return;
    setProblema({ itemId: acoesModal.itemId, checklistId: acoesModal.ckId, descricao: '', status: 'aberto', prioridade: 'media', imagens: [] });
    setProtocolo(gerarProtocolo());
    setProblemaModal({ ...acoesModal });
    setAcoesModal(null);
  };

  const abrirAntesDepois = () => {
    if (!acoesModal) return;
    setAntesDepois({ itemId: acoesModal.itemId, checklistId: acoesModal.ckId, fotoAntes: null, descAntes: '', fotoDepois: null, descDepois: '' });
    setAntesDepoisModal({ ...acoesModal });
    setAcoesModal(null);
  };

  const handleImagemProblema = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const erro = validarImagem(file);
      if (erro) { alert(erro); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setProblema(prev => ({ ...prev, imagens: [...prev.imagens, ev.target!.result as string] }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removerImagemProblema = (idx: number) => {
    setProblema(prev => ({ ...prev, imagens: prev.imagens.filter((_, i) => i !== idx) }));
  };

  const handleFoto = (tipo: 'antes' | 'depois', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        if (tipo === 'antes') {
          setAntesDepois(prev => ({ ...prev, fotoAntes: ev.target!.result as string }));
        } else {
          setAntesDepois(prev => ({ ...prev, fotoDepois: ev.target!.result as string }));
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filtered = checklists.filter(c => {
    if (filtro !== 'todos' && c.status !== filtro) return false;
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      const texto = `${c.local} ${c.tipo} ${c.id} ${c.itens.map(i => i.descricao).join(' ')}`.toLowerCase();
      return termos.every(t => texto.includes(t));
    }
    return true;
  });

  const pag = usePagination(filtered, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando checklists..." />;

  return (
    <div id="checklists-content">
      <HowItWorks
        titulo="Checklist de Manutenção"
        descricao="Crie e gerencie checklist para controle de qualidade da limpeza em cada área do condomínio."
        passos={[
          'Crie um novo checklist definindo o local e tipo (diário, semanal, mensal)',
          'Adicione os itens a serem verificados',
          'Atribua o responsável pelo checklist',
          'O funcionário marca cada item conforme vai concluindo',
          'Clique no ícone de ações para reportar problemas ou registrar fotos antes/depois',
          'Ao concluir, o checklist fica registrado no histórico',
        ]}
      />

      <PageHeader
        titulo="Checklist de Manutenção"
        subtitulo={`${checklists.length} checklists`}
        onCompartilhar={() => compartilharConteudo('Checklists', 'Listagem de checklists')}
        onImprimir={() => imprimirElemento('checklists-content')}
        onGerarPdf={() => gerarPdfDeElemento('checklists-content', 'checklists')}
        acoes={
          <button className={styles.addBtn} onClick={() => setShowNovoModal(true)}>
            <Plus size={18} /> <span>Novo Checklist</span>
          </button>
        }
      />

      <div className={styles.buscaArea}>
        <Search size={18} className={styles.buscaIcon} />
        <input
          type="text"
          className={styles.buscaInput}
          placeholder="Buscar checklist por local, tipo, item..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button className={styles.buscaLimpar} onClick={() => setBusca('')}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className={styles.filters}>
        {(['todos', 'pendente', 'em_andamento', 'concluido'] as const).map(f => {
          const baseClass = f === 'todos' ? styles.tabTodos : f === 'pendente' ? styles.tabPendente : f === 'em_andamento' ? styles.tabAndamento : styles.tabConcluido;
          const activeClass = f === 'todos' ? styles.tabTodosActive : f === 'pendente' ? styles.tabPendenteActive : f === 'em_andamento' ? styles.tabAndamentoActive : styles.tabConcluidoActive;
          return (
            <button
              key={f}
              className={`${styles.filterTab} ${baseClass} ${filtro === f ? activeClass : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendentes' : f === 'em_andamento' ? 'Em Andamento' : 'Concluídos'}
            </button>
          );
        })}
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={48} strokeWidth={1.5} />}
            titulo="Nenhum checklist encontrado"
            descricao="Crie um checklist para começar a acompanhar a limpeza."
          />
        ) : pag.items.map(ck => {
          const concluidos = ck.itens.filter(i => i.concluido).length;
          const total = ck.itens.length;
          const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
          return (
            <Card key={ck.id} hover padding="md">
              <div className={styles.ckCard}>
                <div className={styles.ckTop}>
                  <div className={styles.ckId}>{ck.id}</div>
                  <StatusBadge
                    texto={ck.status === 'concluido' ? 'Concluído' : ck.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                    variante={ck.status === 'concluido' ? 'sucesso' : ck.status === 'em_andamento' ? 'aviso' : 'neutro'}
                  />
                </div>
                <h4 className={styles.ckLocal}>{ck.local}</h4>
                <span className={styles.ckTipo}>{ck.tipo.charAt(0).toUpperCase() + ck.tipo.slice(1)}</span>

                <div className={styles.progress}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressText}>{concluidos}/{total} ({pct}%)</span>
                </div>

                <div className={styles.itemsList}>
                  {ck.itens.map(item => (
                    <div key={item.id} className={`${styles.item} ${item.concluido ? styles.itemDone : ''}`}>
                      <div className={styles.itemCheck}>
                        {item.concluido ? <CheckCircle2 size={16} color="#2e7d32" /> : <div className={styles.unchecked} />}
                      </div>
                      <span className={styles.itemText}>{item.descricao}</span>
                      <button
                        className={styles.itemAction}
                        onClick={() => abrirAcoes(ck.id, item.id, item.descricao)}
                        title="Ações"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--cor-texto)', margin: '0 0 20px' }}>Status dos Checklists</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[
                { nome: 'Concluídos', valor: checklists.filter(c => c.status === 'concluido').length || 0 },
                { nome: 'Em Andamento', valor: checklists.filter(c => c.status === 'em_andamento').length || 0 },
                { nome: 'Pendentes', valor: checklists.filter(c => c.status === 'pendente').length || 0 },
              ]} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="valor" nameKey="nome" label>
                {[0, 1, 2].map(i => <Cell key={i} fill={CORES[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ===== MODAL AÇÕES (2 opções) ===== */}
      <Modal aberto={!!acoesModal} onFechar={() => setAcoesModal(null)} titulo="Açõe do Item" largura="sm">
        <p className={styles.modalItemDesc}>{acoesModal?.itemDesc}</p>
        <div className={styles.acoesGrid}>
          <button className={styles.acaoCard} onClick={abrirProblema}>
            <div className={styles.acaoIcone} style={{ background: '#fff3e0', color: '#e65100' }}>
              <AlertTriangle size={26} />
            </div>
            <div className={styles.acaoTextos}>
              <strong>Reportar um Problema</strong>
              <span>Adicione fotos, descrição, status e prioridade do problema encontrado</span>
            </div>
            <ChevronRight size={18} className={styles.acaoSeta} />
          </button>
          <button className={styles.acaoCard} onClick={abrirAntesDepois}>
            <div className={styles.acaoIcone} style={{ background: '#e8f5e9', color: '#2e7d32' }}>
              <Camera size={26} />
            </div>
            <div className={styles.acaoTextos}>
              <strong>Antes e Depois</strong>
              <span>Registre fotos com descrição do antes e depois da execução</span>
            </div>
            <ChevronRight size={18} className={styles.acaoSeta} />
          </button>
        </div>
      </Modal>

      {/* ===== MODAL REPORTAR PROBLEMA ===== */}
      <Modal aberto={!!problemaModal} onFechar={() => setProblemaModal(null)} titulo="Reportar Problema" largura="md">
        <div className={styles.problemaForm}>
          <div className={styles.protocoloHeader}>
            <div className={styles.protocoloTag}>
              <Hash size={14} />
              <span>{protocolo}</span>
            </div>
          </div>
          <p className={styles.modalItemDesc}>Item: <strong>{problemaModal?.itemDesc}</strong></p>

          <label className={styles.formLabel}>Imagens</label>
          <div className={styles.imagensArea}>
            {problema.imagens.map((img, i) => (
              <div key={i} className={styles.imagemThumb}>
                <img src={img} alt={`Imagem ${i + 1}`} />
                <button className={styles.imagemRemover} onClick={() => removerImagemProblema(i)}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button className={styles.imagemAdd} onClick={() => problemaInputRef.current?.click()}>
              <Upload size={20} />
              <span>Adicionar</span>
            </button>
            <input ref={problemaInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagemProblema} />
          </div>

          <label className={styles.formLabel}>Descrição do Problema</label>
          <textarea
            className={styles.formTextarea}
            placeholder="Descreva o problema encontrado..."
            value={problema.descricao}
            onChange={e => setProblema(prev => ({ ...prev, descricao: e.target.value }))}
            rows={4}
          />

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

          <div className={styles.whatsSection}>
            <div className={styles.whatsHeader}>
              <button
                className={styles.whatsBtn}
                onClick={() => {
                  const contato = contatosWhats.find(c => c.id === contatoSelecionado);
                  if (!contato) { setShowWhatsConfig(true); return; }
                  const num = contato.telefone.replace(/\D/g, '');
                  const texto = encodeURIComponent(`*Problema Reportado*\n*Protocolo:* ${protocolo}\n\n*Item:* ${problemaModal?.itemDesc}\n*Descrição:* ${problema.descricao || 'N/A'}\n*Status:* ${problema.status}\n*Prioridade:* ${problema.prioridade}\n*Enviado para:* ${contato.nome}`);
                  window.open(`https://wa.me/55${num}?text=${texto}`, '_blank');
                }}
              >
                <MessageCircle size={18} /> Enviar para WhatsApp
              </button>
              <button
                className={`${styles.whatsConfigBtn} ${showWhatsConfig ? styles.whatsConfigBtnActive : ''}`}
                onClick={() => setShowWhatsConfig(prev => !prev)}
                title="Configurar Contatos"
              >
                <Settings size={18} />
              </button>
            </div>

            {/* Dropdown de contatos salvos */}
            {contatosWhats.length > 0 && (
              <div className={styles.whatsContatoSelect}>
                <label className={styles.formLabel}>Enviar para:</label>
                <select
                  className={styles.formSelect}
                  value={contatoSelecionado}
                  onChange={e => setContatoSelecionado(e.target.value)}
                >
                  {contatosWhats.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Painel de config para adicionar/remover contatos */}
            {showWhatsConfig && (
              <div className={styles.whatsConfigPanel}>
                <h5 className={styles.whatsConfigTitle}>Adicionar Contato</h5>
                <div className={styles.whatsConfigFields}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nome</label>
                    <input
                      className={styles.formInput}
                      placeholder="Nome do contato"
                      value={whatsNome}
                      onChange={e => setWhatsNome(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>WhatsApp</label>
                    <input
                      className={styles.formInput}
                      placeholder="(00) 00000-0000"
                      value={whatsTelefone}
                      maxLength={15}
                      onChange={e => setWhatsTelefone(formatarTelefone(e.target.value))}
                    />
                  </div>
                  <button className={styles.whatsSaveBtn} onClick={salvarNovoContato}>
                    <Save size={15} /> Salvar
                  </button>
                </div>

                {/* Lista de contatos salvos */}
                {contatosWhats.length > 0 && (
                  <div className={styles.whatsContatosList}>
                    <h5 className={styles.whatsConfigTitle}>Contatos Salvos</h5>
                    {contatosWhats.map((c, i) => (
                      <div key={c.id} className={styles.whatsContatoItem}>
                        <div className={styles.whatsContatoInfo}>
                          <strong>{c.nome}</strong>
                          <span>{c.telefone}</span>
                          {i === 0 && <span className={styles.whatsContatoBadge}>Padrão</span>}
                        </div>
                        <button className={styles.whatsContatoRemover} onClick={() => removerContato(c.id)} title="Remover">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ===== MODAL ANTES E DEPOIS ===== */}
      <Modal aberto={!!antesDepoisModal} onFechar={() => setAntesDepoisModal(null)} titulo="Ante e Depois" largura="lg">
        <div className={styles.antesDepoisForm}>
          <p className={styles.modalItemDesc}>Item: <strong>{antesDepoisModal?.itemDesc}</strong></p>

          <div className={styles.antesDepoisGrid}>
            {/* ANTES */}
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}>
                <span className={styles.adBadgeAntes}>ANTES</span>
              </h4>
              {antesDepois.fotoAntes ? (
                <div className={styles.adFotoContainer}>
                  <img src={antesDepois.fotoAntes} alt="Antes" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => setAntesDepois(prev => ({ ...prev, fotoAntes: null }))}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => antesInputRef.current?.click()}>
                  <Camera size={32} />
                  <span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={antesInputRef} type="file" accept="image/*" hidden onChange={e => handleFoto('antes', e)} />
              <textarea
                className={styles.formTextarea}
                placeholder="Descrição do estado antes..."
                value={antesDepois.descAntes}
                onChange={e => setAntesDepois(prev => ({ ...prev, descAntes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* DEPOIS */}
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}>
                <span className={styles.adBadgeDepois}>DEPOIS</span>
              </h4>
              {antesDepois.fotoDepois ? (
                <div className={styles.adFotoContainer}>
                  <img src={antesDepois.fotoDepois} alt="Depois" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => setAntesDepois(prev => ({ ...prev, fotoDepois: null }))}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => depoisInputRef.current?.click()}>
                  <Camera size={32} />
                  <span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={depoisInputRef} type="file" accept="image/*" hidden onChange={e => handleFoto('depois', e)} />
              <textarea
                className={styles.formTextarea}
                placeholder="Descrição do estado depois..."
                value={antesDepois.descDepois}
                onChange={e => setAntesDepois(prev => ({ ...prev, descDepois: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          {/* Preview lado a lado quando ambas fotos existem */}
          {antesDepois.fotoAntes && antesDepois.fotoDepois && (
            <div className={styles.adComparacao}>
              <h4 className={styles.adCompTitulo}>Comparação</h4>
              <div className={styles.adCompGrid}>
                <div className={styles.adCompItem}>
                  <span className={styles.adBadgeAntes}>ANTES</span>
                  <img src={antesDepois.fotoAntes} alt="Antes" />
                  <p>{antesDepois.descAntes || 'Sem descrição'}</p>
                </div>
                <div className={styles.adCompItem}>
                  <span className={styles.adBadgeDepois}>DEPOIS</span>
                  <img src={antesDepois.fotoDepois} alt="Depois" />
                  <p>{antesDepois.descDepois || 'Sem descrição'}</p>
                </div>
              </div>
            </div>
          )}

          <button className={styles.formSubmit} onClick={() => { alert('Registro salvo com sucesso!'); setAntesDepoisModal(null); }}>
            <Camera size={16} /> Salvar Registro
          </button>
        </div>
      </Modal>

      {/* Modal Novo Checklist */}
      <Modal aberto={showNovoModal} onFechar={() => setShowNovoModal(false)} titulo="Novo Checklist" largura="md">
        <div className={styles.novoForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <div className={styles.labelRow}>
                <label className={styles.formLabel}>Local</label>
                <button className={styles.configLocalBtn} onClick={() => setShowConfigLocais(true)} title="Configurar locais e itens padrão">
                  <Settings size={14} /> Configurações
                </button>
              </div>
              {locaisPresets.length > 0 && (
                <div className={styles.locaisChips}>
                  {locaisPresets.map(lp => (
                    <button key={lp.id} className={`${styles.localChip} ${novoLocal === lp.nome ? styles.localChipActive : ''}`} onClick={() => selecionarLocal(lp)}>
                      {lp.nome}
                    </button>
                  ))}
                </div>
              )}
              <input className={styles.formInput} placeholder="Ex: Hall de Entrada - Bloco A" value={novoLocal} onChange={e => setNovoLocal(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select className={styles.formSelect} value={novoTipo} onChange={e => setNovoTipo(e.target.value as any)}>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="especial">Especial</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Condomínio</label>
              <select className={styles.formSelect} value={novoCond} onChange={e => setNovoCond(e.target.value)}>
                <option value="c1">Cond. Aurora</option>
                <option value="c2">Cond. Solar</option>
                <option value="c3">Cond. Vista</option>
              </select>
            </div>
          </div>

          <label className={styles.formLabel}>Itens do Checklist</label>
          <div className={styles.itensLista}>
            {novosItens.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <input
                  className={styles.formInput}
                  placeholder={`Item ${idx + 1}`}
                  value={item}
                  onChange={e => atualizarItem(idx, e.target.value)}
                />
                {novosItens.length > 1 && (
                  <button className={styles.itemRemoveBtn} onClick={() => removerItem(idx)}>
                    <Minus size={16} />
                  </button>
                )}
              </div>
            ))}
            <button className={styles.itemAddBtn} onClick={adicionarItem}>
              <Plus size={16} /> Adicionar Item
            </button>
          </div>

          <button className={styles.formSubmit} onClick={criarChecklist}>
            <Plus size={18} /> Criar Checklist
          </button>
        </div>
      </Modal>

      {/* ===== MODAL CONFIG LOCAIS ===== */}
      <Modal aberto={showConfigLocais} onFechar={() => { setShowConfigLocais(false); setEditandoLocal(null); setCfgNome(''); setCfgItens(['']); }} titulo="Configurar Locais e Itens Padrão" largura="md">
        <p className={styles.cfgDesc}>Cadastre locais pré-definidos com itens padrão. Ao criar um checklist, basta selecionar o local e os itens serão preenchidos automaticamente.</p>

        {locaisPresets.length > 0 ? (
          <div className={styles.cfgLista}>
            {locaisPresets.map(lp => (
              <div key={lp.id} className={styles.cfgItem}>
                <div className={styles.cfgItemHeader}>
                  <strong className={styles.cfgItemNome}>{lp.nome}</strong>
                  <div className={styles.cfgItemBtns}>
                    <button className={styles.cfgIconBtn} onClick={() => { setEditandoLocal(lp.id); setCfgNome(lp.nome); setCfgItens(lp.itens_padrao?.length ? [...lp.itens_padrao] : ['']); }} title="Editar"><Edit2 size={13} /></button>
                    <button className={styles.cfgIconBtn} onClick={() => handleExcluirLocal(lp.id)} title="Excluir"><Trash2 size={13} /></button>
                  </div>
                </div>
                {lp.itens_padrao?.length > 0 && (
                  <div className={styles.cfgItemItens}>
                    {lp.itens_padrao.map((it, i) => <span key={i} className={styles.cfgItemTag}>{it}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: '16px 0', fontSize: 13 }}>Nenhum local cadastrado. Adicione abaixo.</div>
        )}

        <div className={styles.cfgForm}>
          <div className={styles.cfgFormHeader}>{editandoLocal === null ? 'Novo Local' : 'Editar Local'}</div>
          <input className={styles.formInput} placeholder="Nome do local (ex: Hall de Entrada)" value={cfgNome} onChange={e => setCfgNome(e.target.value)} />
          <label className={styles.formLabel} style={{ marginTop: 8 }}>Itens padrão</label>
          {cfgItens.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <input className={styles.formInput} placeholder={`Item ${idx + 1}`} value={item} onChange={e => { const next = [...cfgItens]; next[idx] = e.target.value; setCfgItens(next); }} />
              {cfgItens.length > 1 && <button className={styles.itemRemoveBtn} onClick={() => setCfgItens(prev => prev.filter((_, i) => i !== idx))}><Minus size={16} /></button>}
            </div>
          ))}
          <button className={styles.itemAddBtn} onClick={() => setCfgItens(prev => [...prev, ''])}><Plus size={16} /> Adicionar Item</button>
          <div className={styles.cfgFormActions}>
            {editandoLocal !== null && <button className={styles.cfgCancelBtn} onClick={() => { setEditandoLocal(null); setCfgNome(''); setCfgItens(['']); }}><X size={14} /> Cancelar</button>}
            <button className={styles.formSubmit} onClick={handleSalvarLocal} disabled={!cfgNome.trim()} style={{ flex: 1 }}>
              <Save size={16} /> {editandoLocal === null ? 'Cadastrar Local' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChecklistsPage;
