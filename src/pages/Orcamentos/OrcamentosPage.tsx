import React, { useState, useMemo, useEffect, useRef } from 'react';
import PageHeader from '../../components/Common/PageHeader';
import HowItWorks from '../../components/Common/HowItWorks';
import Modal from '../../components/Common/Modal';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import { usePagination } from '../../hooks/usePagination';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { orcamentos as orcamentosApi, condominios as condominiosApi, upload as uploadApi } from '../../services/api';
import type { Orcamento, OrcamentoItem, OrcamentoFoto } from '../../types';
import {
  Plus, Search, FileText, Edit, Trash2, Send, CheckCircle, XCircle,
  Clock, DollarSign, User, Phone, Mail, MapPin, Image, X, Camera,
  MessageCircle, Download, Building2, Percent, Hash, Briefcase
} from 'lucide-react';
import styles from './Orcamentos.module.css';

const STATUS_MAP: Record<string, { label: string; classe: string; icon: React.ReactNode }> = {
  rascunho: { label: 'Rascunho', classe: styles.statusRascunho, icon: <Clock size={12} /> },
  enviado: { label: 'Enviado', classe: styles.statusEnviado, icon: <Send size={12} /> },
  aprovado: { label: 'Aprovado', classe: styles.statusAprovado, icon: <CheckCircle size={12} /> },
  recusado: { label: 'Recusado', classe: styles.statusRecusado, icon: <XCircle size={12} /> },
  expirado: { label: 'Expirado', classe: styles.statusExpirado, icon: <Clock size={12} /> },
};

const TIPO_ITEM_LABELS: Record<string, string> = {
  material: 'Material',
  servico: 'Serviço',
  mao_de_obra: 'Mão de Obra',
};

const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ITEM_VAZIO = (): OrcamentoItem => ({
  descricao: '', tipo: 'servico', quantidade: 1, unidade: 'un', valorUnitario: 0, valorTotal: 0, ordem: 0,
});

const FORM_INICIAL = {
  condominioId: '',
  titulo: '',
  clienteNome: '',
  clienteTelefone: '',
  clienteEmail: '',
  clienteEndereco: '',
  descricaoGeral: '',
  observacoes: '',
  condicoesPagamento: 'À vista ou em até 3x sem juros',
  validadeDias: 30,
  prazoExecucao: '',
  descontoTipo: 'nenhum' as 'nenhum' | 'percentual' | 'valor',
  descontoValor: 0,
  logoUrl: '',
  osReferencia: '',
};

const OrcamentosPage: React.FC = () => {
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const ehGestor = roleNivel >= 2;

  const [orcamentosList, setOrcamentosList] = useState<Orcamento[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCondo, setFiltroCondo] = useState('todos');

  // Modal form
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Orcamento | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [itens, setItens] = useState<OrcamentoItem[]>([ITEM_VAZIO()]);
  const [fotos, setFotos] = useState<OrcamentoFoto[]>([]);
  const [salvando, setSalvando] = useState(false);

  // WhatsApp modal
  const [showWhats, setShowWhats] = useState(false);
  const [whatsOrc, setWhatsOrc] = useState<Orcamento | null>(null);
  const [whatsNumero, setWhatsNumero] = useState('');

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Carregar dados ──
  const carregar = async () => {
    setLoading(true);
    try {
      const [orcRes, condRes] = await Promise.all([
        orcamentosApi.list({ pageSize: '500' }),
        condominiosApi.list().catch(() => []),
      ]);
      const lista = Array.isArray(orcRes) ? orcRes : (orcRes.data ?? []);
      setOrcamentosList(lista);
      const conds = Array.isArray(condRes) ? condRes : (condRes as any).data ?? [];
      setCondominiosList(conds);
    } catch (err) {
      console.error('Erro ao carregar orçamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // ── Filtrar ──
  const filtrados = useMemo(() => {
    let lista = orcamentosList;
    if (filtroStatus !== 'todos') lista = lista.filter(o => o.status === filtroStatus);
    if (filtroCondo !== 'todos') lista = lista.filter(o => o.condominioId === filtroCondo);
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter(o =>
        (o.titulo || '').toLowerCase().includes(t) ||
        (o.clienteNome || '').toLowerCase().includes(t) ||
        String(o.numero).includes(t)
      );
    }
    return lista;
  }, [orcamentosList, filtroStatus, filtroCondo, busca]);

  // ── Resumo ──
  const resumo = useMemo(() => {
    const total = filtrados.length;
    const aprovados = filtrados.filter(o => o.status === 'aprovado').length;
    const enviados = filtrados.filter(o => o.status === 'enviado').length;
    const valorTotal = filtrados.reduce((s, o) => s + (o.valorFinal || 0), 0);
    const valorAprovado = filtrados.filter(o => o.status === 'aprovado').reduce((s, o) => s + (o.valorFinal || 0), 0);
    return { total, aprovados, enviados, valorTotal, valorAprovado };
  }, [filtrados]);

  // ── Abrir formulário ──
  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_INICIAL, condominioId: condominiosList[0]?.id || '' });
    setItens([ITEM_VAZIO()]);
    setFotos([]);
    setShowModal(true);
  };

  const abrirEditar = async (orc: Orcamento) => {
    try {
      const full = await orcamentosApi.get(orc.id);
      setEditando(full);
      setForm({
        condominioId: full.condominioId || '',
        titulo: full.titulo || '',
        clienteNome: full.clienteNome || '',
        clienteTelefone: full.clienteTelefone || '',
        clienteEmail: full.clienteEmail || '',
        clienteEndereco: full.clienteEndereco || '',
        descricaoGeral: full.descricaoGeral || '',
        observacoes: full.observacoes || '',
        condicoesPagamento: full.condicoesPagamento || '',
        validadeDias: full.validadeDias || 30,
        prazoExecucao: full.prazoExecucao || '',
        descontoTipo: full.descontoTipo || 'nenhum',
        descontoValor: full.descontoValor || 0,
        logoUrl: full.logoUrl || '',
        osReferencia: full.osReferencia || '',
      });
      setItens(full.itens?.length ? full.itens : [ITEM_VAZIO()]);
      setFotos(full.fotos || []);
      setShowModal(true);
    } catch (err) { console.error(err); }
  };

  // ── Salvar ──
  const salvar = async () => {
    if (!tentarAcao()) return;
    if (!form.titulo.trim() || !form.condominioId) return;
    setSalvando(true);
    try {
      const payload = {
        condominio_id: form.condominioId,
        titulo: form.titulo,
        cliente_nome: form.clienteNome || null,
        cliente_telefone: form.clienteTelefone || null,
        cliente_email: form.clienteEmail || null,
        cliente_endereco: form.clienteEndereco || null,
        descricao_geral: form.descricaoGeral || null,
        observacoes: form.observacoes || null,
        condicoes_pagamento: form.condicoesPagamento || null,
        validade_dias: form.validadeDias,
        prazo_execucao: form.prazoExecucao || null,
        desconto_tipo: form.descontoTipo,
        desconto_valor: form.descontoValor,
        logo_url: form.logoUrl || null,
        os_referencia: form.osReferencia || null,
        itens: itens.filter(i => i.descricao.trim()).map((i, idx) => ({
          descricao: i.descricao,
          tipo: i.tipo,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valor_unitario: i.valorUnitario,
        })),
        fotos: fotos.map((f, idx) => ({ url: f.url, legenda: f.legenda })),
      };

      if (editando) {
        await orcamentosApi.update(editando.id, payload);
      } else {
        await orcamentosApi.create(payload);
      }
      setShowModal(false);
      carregar();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  // ── Excluir ──
  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    if (!confirm('Excluir este orçamento?')) return;
    try {
      await orcamentosApi.remove(id);
      setOrcamentosList(prev => prev.filter(o => o.id !== id));
    } catch (err) { console.error(err); }
  };

  // ── Mudar Status ──
  const mudarStatus = async (id: string, status: string) => {
    if (!tentarAcao()) return;
    try {
      await orcamentosApi.updateStatus(id, status);
      setOrcamentosList(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
    } catch (err) { console.error(err); }
  };

  // ── Upload foto ──
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadApi.image(files[i], 'fotos');
        setFotos(prev => [...prev, { url, legenda: '', ordem: prev.length }]);
      } catch (err) { console.error(err); }
    }
    e.target.value = '';
  };

  // ── Upload logo ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadApi.image(file, 'fotos');
      setForm(prev => ({ ...prev, logoUrl: url }));
    } catch (err) { console.error(err); }
    e.target.value = '';
  };

  // ── Itens helpers ──
  const updateItem = (idx: number, field: string, value: any) => {
    setItens(prev => {
      const novo = [...prev];
      (novo[idx] as any)[field] = value;
      novo[idx].valorTotal = (novo[idx].quantidade || 0) * (novo[idx].valorUnitario || 0);
      return novo;
    });
  };

  const addItem = () => setItens(prev => [...prev, ITEM_VAZIO()]);

  const removeItem = (idx: number) => {
    setItens(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const subtotal = itens.reduce((s, i) => s + (i.quantidade || 0) * (i.valorUnitario || 0), 0);
  const desconto = form.descontoTipo === 'percentual'
    ? subtotal * (form.descontoValor || 0) / 100
    : form.descontoTipo === 'valor' ? (form.descontoValor || 0) : 0;
  const valorFinal = Math.max(0, subtotal - desconto);

  // ── WhatsApp ──
  const enviarWhatsApp = () => {
    if (!whatsOrc || !whatsNumero.trim()) return;
    const numero = whatsNumero.replace(/\D/g, '');
    if (numero.length < 10) return;

    const msg = [
      `*ORÇAMENTO Nº ${whatsOrc.numero}*`,
      ``,
      `*${whatsOrc.titulo}*`,
      whatsOrc.clienteNome ? `Cliente: ${whatsOrc.clienteNome}` : '',
      `Valor: *${fmtBRL(whatsOrc.valorFinal)}*`,
      `Validade: ${whatsOrc.validadeDias} dias`,
      ``,
      `Para visualizar o orçamento completo em PDF, solicite o link ao responsável.`,
      ``,
      `_Enviado via Manutenção X_`,
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/${numero.startsWith('55') ? numero : '55' + numero}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    mudarStatus(whatsOrc.id, 'enviado');
    setShowWhats(false);
    setWhatsNumero('');
  };

  const abrirWhatsApp = (orc: Orcamento) => {
    setWhatsOrc(orc);
    setWhatsNumero(orc.clienteTelefone || '');
    setShowWhats(true);
  };

  const pag = usePagination(filtrados, { pageSize: 12 });

  if (loading) return <LoadingSpinner texto="Carregando orçamentos..." />;

  return (
    <div id="orcamentos-content" className={styles.page}>
      <HowItWorks
        titulo="Módulo de Orçamentos"
        descricao="Crie orçamentos profissionais, envie por WhatsApp e acompanhe aprovações."
        passos={[
          'Preencha os dados do cliente e descrição do serviço',
          'Adicione itens com valores de material, serviço e mão de obra',
          'Inclua fotos do local e a logo da empresa',
          'Envie o orçamento pelo WhatsApp ou gere o PDF',
        ]}
      />

      <PageHeader
        titulo="Orçamentos"
        subtitulo={`${filtrados.length} orçamento${filtrados.length !== 1 ? 's' : ''}`}
        onCompartilhar={() => compartilharConteudo('Orçamentos', `Total: ${filtrados.length} | Valor: ${fmtBRL(resumo.valorTotal)}`)}
        onImprimir={() => imprimirElemento('orcamentos-content')}
        onGerarPdf={() => gerarPdfDeElemento('orcamentos-content', 'orcamentos')}
        acoes={ehGestor ? (
          <button className={styles.btnPrimary} onClick={abrirNovo}>
            <Plus size={16} /> Novo Orçamento
          </button>
        ) : undefined}
      />

      {/* ── Resumo ── */}
      <div className={styles.resumoGrid}>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.azul}`}><FileText size={20} /></div>
          <div className={styles.resumoInfo}><h4>{resumo.total}</h4><span>Total de Orçamentos</span></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.verde}`}><CheckCircle size={20} /></div>
          <div className={styles.resumoInfo}><h4>{resumo.aprovados}</h4><span>Aprovados</span></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.laranja}`}><Send size={20} /></div>
          <div className={styles.resumoInfo}><h4>{resumo.enviados}</h4><span>Aguardando Resposta</span></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.roxo}`}><DollarSign size={20} /></div>
          <div className={styles.resumoInfo}><h4>{fmtBRL(resumo.valorTotal)}</h4><span>Valor Total</span></div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.verde}`}><DollarSign size={20} /></div>
          <div className={styles.resumoInfo}><h4>{fmtBRL(resumo.valorAprovado)}</h4><span>Valor Aprovado</span></div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filterBar}>
        <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)}>
          <option value="todos">Todos os Condomínios</option>
          {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os Status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviado">Enviado</option>
          <option value="aprovado">Aprovado</option>
          <option value="recusado">Recusado</option>
          <option value="expirado">Expirado</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input placeholder="Buscar por título, cliente ou nº..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* ── Lista de Orçamentos ── */}
      {filtrados.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={48} />
          <h4>Nenhum orçamento encontrado</h4>
          <p>Crie seu primeiro orçamento para começar</p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {pag.items.map((orc: Orcamento) => {
              const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
              return (
                <div className={styles.card} key={orc.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardNumero}><Hash size={11} /> ORC-{orc.numero}</span>
                      <h3 className={styles.cardTitle}>{orc.titulo}</h3>
                    </div>
                    <span className={`${styles.statusBadge} ${st.classe}`}>{st.icon} {st.label}</span>
                  </div>
                  <div className={styles.cardBody}>
                    {orc.clienteNome && <div className={styles.cardRow}><User size={13} /> {orc.clienteNome}</div>}
                    {orc.clienteTelefone && <div className={styles.cardRow}><Phone size={13} /> {orc.clienteTelefone}</div>}
                    {orc.condominioNome && <div className={styles.cardRow}><Building2 size={13} /> {orc.condominioNome}</div>}
                    {orc.osReferencia && <div className={styles.cardRow}><Briefcase size={13} /> Ref: {orc.osReferencia}</div>}
                    <div className={styles.cardRow}><Clock size={13} /> Validade: {orc.validadeDias} dias</div>
                    <div className={styles.cardRow} style={{ fontSize: 11 }}>
                      Criado em {new Date(orc.criadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className={styles.cardValor}>
                    <span className={styles.cardValorLabel}>Valor Final</span>
                    <span className={styles.cardValorNum}>{fmtBRL(orc.valorFinal)}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.btnWhatsapp} onClick={() => abrirWhatsApp(orc)}>
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button className={styles.btnSm} onClick={() => orcamentosApi.pdf(orc.id)}>
                      <Download size={14} /> PDF
                    </button>
                    {ehGestor && (
                      <>
                        <button className={styles.btnSm} onClick={() => abrirEditar(orc)}><Edit size={14} /></button>
                        {orc.status === 'rascunho' && <button className={styles.btnDanger} onClick={() => excluir(orc.id)}><Trash2 size={14} /></button>}
                      </>
                    )}
                    {ehGestor && orc.status === 'enviado' && (
                      <>
                        <button className={styles.btnSuccess} onClick={() => mudarStatus(orc.id, 'aprovado')}><CheckCircle size={14} /> Aprovar</button>
                        <button className={styles.btnDanger} onClick={() => mudarStatus(orc.id, 'recusado')}><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />
        </>
      )}

      {/* ── Modal Formulário ── */}
      {showModal && (
        <Modal aberto={showModal} titulo={editando ? 'Editar Orçamento' : 'Novo Orçamento'} onFechar={() => setShowModal(false)}>
          <div className={styles.formGrid}>

            {/* Logo */}
            <div className={styles.sectionTitle}><Image size={15} /> Logo da Empresa</div>
            <div className={styles.logoArea}>
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className={styles.logoPreview} />
              ) : (
                <div className={styles.logoPlaceholder} onClick={() => logoInputRef.current?.click()}>
                  <Camera size={24} />
                </div>
              )}
              <div>
                <button className={styles.btnSm} onClick={() => logoInputRef.current?.click()}>
                  <Image size={13} /> {form.logoUrl ? 'Trocar' : 'Enviar'} Logo
                </button>
                {form.logoUrl && (
                  <button className={styles.btnSm} style={{ marginLeft: 6 }} onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}>
                    <X size={13} /> Remover
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              </div>
            </div>

            {/* Dados gerais */}
            <div className={styles.sectionTitle}><FileText size={15} /> Dados do Orçamento</div>
            <label>Condomínio *
              <select value={form.condominioId} onChange={e => setForm({ ...form, condominioId: e.target.value })}>
                <option value="">Selecione...</option>
                {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Título do Orçamento *
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Manutenção do elevador — Bloco A" />
            </label>
            <label>Validade (dias)
              <input type="number" min={1} max={365} value={form.validadeDias} onChange={e => setForm({ ...form, validadeDias: parseInt(e.target.value) || 30 })} />
            </label>
            <label>Prazo de Execução
              <input value={form.prazoExecucao} onChange={e => setForm({ ...form, prazoExecucao: e.target.value })} placeholder="Ex: 5 dias úteis" />
            </label>
            <label>Referência OS (opcional)
              <input value={form.osReferencia} onChange={e => setForm({ ...form, osReferencia: e.target.value })} placeholder="Ex: OS-0042 (preencha manualmente)" />
            </label>

            {/* Cliente */}
            <div className={styles.sectionTitle}><User size={15} /> Dados do Cliente</div>
            <label>Nome
              <input value={form.clienteNome} onChange={e => setForm({ ...form, clienteNome: e.target.value })} placeholder="Nome do cliente" />
            </label>
            <label>Telefone / WhatsApp
              <input value={form.clienteTelefone} onChange={e => setForm({ ...form, clienteTelefone: e.target.value })} placeholder="(11) 99999-9999" />
            </label>
            <label>E-mail
              <input type="email" value={form.clienteEmail} onChange={e => setForm({ ...form, clienteEmail: e.target.value })} placeholder="cliente@email.com" />
            </label>
            <label>Endereço
              <input value={form.clienteEndereco} onChange={e => setForm({ ...form, clienteEndereco: e.target.value })} placeholder="Endereço completo" />
            </label>

            {/* Descrição */}
            <div className={styles.sectionTitle}><FileText size={15} /> Descrição do Serviço</div>
            <label className={styles.fullWidth}>Descrição Geral
              <textarea value={form.descricaoGeral} onChange={e => setForm({ ...form, descricaoGeral: e.target.value })} placeholder="Descreva detalhadamente o serviço que será realizado, incluindo métodos, materiais e escopo..." rows={4} />
            </label>

            {/* Itens */}
            <div className={styles.sectionTitle}><DollarSign size={15} /> Itens do Orçamento</div>
            <div className={styles.itensLista}>
              {itens.map((item, idx) => (
                <div className={styles.itemRow} key={idx}>
                  <label>Descrição
                    <input value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição do item" />
                  </label>
                  <label>Tipo
                    <select value={item.tipo} onChange={e => updateItem(idx, 'tipo', e.target.value)}>
                      <option value="servico">Serviço</option>
                      <option value="material">Material</option>
                      <option value="mao_de_obra">Mão de Obra</option>
                    </select>
                  </label>
                  <label>Qtd
                    <input type="number" min={0} step={0.01} value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
                  </label>
                  <label>Unid.
                    <input value={item.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} placeholder="un" />
                  </label>
                  <label>Unitário (R$)
                    <input type="number" min={0} step={0.01} value={item.valorUnitario} onChange={e => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)} />
                  </label>
                  <label>Total
                    <span className={styles.itemTotal}>{fmtBRL((item.quantidade || 0) * (item.valorUnitario || 0))}</span>
                  </label>
                  <button className={styles.itemRemove} onClick={() => removeItem(idx)} title="Remover item"><X size={14} /></button>
                </div>
              ))}
              <button className={styles.btnSm} onClick={addItem}><Plus size={14} /> Adicionar Item</button>
            </div>

            {/* Desconto e total */}
            <div className={styles.sectionTitle}><Percent size={15} /> Desconto e Totais</div>
            <label>Tipo de Desconto
              <select value={form.descontoTipo} onChange={e => setForm({ ...form, descontoTipo: e.target.value as any })}>
                <option value="nenhum">Sem desconto</option>
                <option value="percentual">Percentual (%)</option>
                <option value="valor">Valor fixo (R$)</option>
              </select>
            </label>
            {form.descontoTipo !== 'nenhum' && (
              <label>{form.descontoTipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
                <input type="number" min={0} step={0.01} value={form.descontoValor} onChange={e => setForm({ ...form, descontoValor: parseFloat(e.target.value) || 0 })} />
              </label>
            )}
            <div className={styles.fullWidth} style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '12px 0', fontSize: 14 }}>
              <span>Subtotal: <strong>{fmtBRL(subtotal)}</strong></span>
              {desconto > 0 && <span style={{ color: '#ef4444' }}>Desconto: <strong>- {fmtBRL(desconto)}</strong></span>}
              <span style={{ color: '#3b82f6', fontSize: 16 }}>Total: <strong>{fmtBRL(valorFinal)}</strong></span>
            </div>

            {/* Condições de pagamento */}
            <div className={styles.sectionTitle}><DollarSign size={15} /> Condições</div>
            <label className={styles.fullWidth}>Condições de Pagamento
              <textarea value={form.condicoesPagamento} onChange={e => setForm({ ...form, condicoesPagamento: e.target.value })} placeholder="Ex: 50% na aprovação e 50% na conclusão" rows={2} />
            </label>
            <label className={styles.fullWidth}>Observações
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Informações adicionais, garantias, ressalvas..." rows={3} />
            </label>

            {/* Fotos */}
            <div className={styles.sectionTitle}><Camera size={15} /> Fotos do Local / Serviço</div>
            <div className={styles.fotosGrid}>
              {fotos.map((foto, idx) => (
                <div className={styles.fotoCard} key={idx}>
                  <img src={foto.url} alt={foto.legenda || 'Foto'} />
                  <button className={styles.fotoRemove} onClick={() => setFotos(prev => prev.filter((_, i) => i !== idx))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className={styles.fotoAdd} onClick={() => fotoInputRef.current?.click()}>
                <Camera size={20} />
                <span>Adicionar</span>
              </div>
              <input ref={fotoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotoUpload} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className={styles.btnSm} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : (editando ? 'Salvar Alterações' : 'Criar Orçamento')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal WhatsApp ── */}
      {showWhats && whatsOrc && (
        <Modal aberto={showWhats} titulo="Enviar via WhatsApp" onFechar={() => setShowWhats(false)}>
          <p style={{ fontSize: 13, color: 'var(--cor-texto-secundario)', marginBottom: 12 }}>
            O orçamento <strong>ORC-{whatsOrc.numero}</strong> será enviado como mensagem no WhatsApp.
            Informe o número do destinatário:
          </p>
          <div className={styles.whatsInput}>
            <input
              value={whatsNumero}
              onChange={e => setWhatsNumero(e.target.value)}
              placeholder="(11) 99999-9999"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && enviarWhatsApp()}
            />
            <button className={styles.btnWhatsapp} onClick={enviarWhatsApp}>
              <MessageCircle size={16} /> Enviar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OrcamentosPage;
