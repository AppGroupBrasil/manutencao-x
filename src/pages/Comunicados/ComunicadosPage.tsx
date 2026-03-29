import React, { useState, useEffect, useRef, useMemo } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Pagination from '../../components/Common/Pagination';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { gerarEmailTemplate, gerarAssunto } from '../../utils/emailTemplates';
import { usePagination } from '../../hooks/usePagination';
import {
  Plus, X, Trash2, Send, Search, Building2, Mail, FileText,
  Megaphone, Clock, Check, AlertCircle, Users, Home, ChevronDown, Paperclip,
  Eye, EyeOff, ShieldAlert, BarChart3, RefreshCw, ExternalLink
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { comunicados as comunicadosApi, moradores as moradoresApi, condominios as condominiosApi } from '../../services/api';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import { safeStorage } from '../../utils/storage';
import styles from './Comunicados.module.css';

/* ============ Tipos ============ */
interface Morador {
  id: string;
  nome: string;
  condominio: string;
  bloco: string;
  apartamento: string;
  whatsapp: string;
  email: string;
  perfil: string;
}

interface Condominio {
  id: string;
  nome: string;
}

type TipoEnvio = 'comunicado' | 'aviso';
type Destinatario = 'morador' | 'bloco' | 'condominio';
type StatusEmail = 'enviado' | 'aberto' | 'nao_aberto' | 'spam';

interface EmailTracking {
  email: string;
  nome: string;
  status: StatusEmail;
  atualizadoEm: string;
}

interface Comunicado {
  id: string;
  tipo: TipoEnvio;
  titulo: string;
  mensagem: string;
  pdfAnexo?: string;
  pdfNome?: string;
  destinatarioTipo: Destinatario;
  condominio: string;
  bloco?: string;
  moradorId?: string;
  moradorNome?: string;
  emailsEnviados: string[];
  tracking: EmailTracking[];
  emailHtml?: string;
  assunto?: string;
  criadoEm: string;
  enviadoPor: string;
}

/* ============ Persistence ============ */

function obterUsuarioAtual(): string {
  const saved = safeStorage.getItem('manutencao_user') || safeStorage.getItem('manutencao-usuario');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      return u.nome || 'Administrador';
    } catch {
      return 'Administrador';
    }
  }
  return 'Administrador';
}

/* ============ Componente ============ */
const ComunicadosPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      comunicadosApi.list(),
      moradoresApi.list().catch(() => []),
      condominiosApi.list().catch(() => []),
    ]).then(([coms, mors, conds]) => {
      setComunicados(coms as Comunicado[]);
      setMoradores((mors as any[]).map(m => ({ id: m.id, nome: m.nome, condominio: m.condominioNome || m.condominio || '', bloco: m.bloco || '', apartamento: m.apartamento || '', whatsapp: m.whatsapp || '', email: m.email || '', perfil: m.perfil || '' })));
      setCondominios((conds as any[]).map(c => ({ id: c.id, nome: c.nome })));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalTracking, setModalTracking] = useState<Comunicado | null>(null);
  const [modalPreviewHtml, setModalPreviewHtml] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoEnvio>('');
  const [filtroCond, setFiltroCond] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envioSucesso, setEnvioSucesso] = useState(false);

  /* Form */
  const [tipo, setTipo] = useState<TipoEnvio>('aviso');
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pdfAnexo, setPdfAnexo] = useState<string | undefined>();
  const [pdfNome, setPdfNome] = useState<string | undefined>();
  const [destTipo, setDestTipo] = useState<Destinatario>('condominio');
  const [destCond, setDestCond] = useState('');
  const [destBloco, setDestBloco] = useState('');
  const [destMoradorId, setDestMoradorId] = useState('');

  const pdfInputRef = useRef<HTMLInputElement>(null);

  /* Persist */

  /* Derived */
  const condominiosUnicos = useMemo(() =>
    [...new Set(moradores.map(m => m.condominio).filter(Boolean))],
    [moradores]
  );

  const condList = condominios.length > 0 ? condominios.map(c => c.nome) :
    condominiosUnicos.length > 0 ? condominiosUnicos : ['Condomínio Aurora', 'Condomínio Solar'];

  const blocosDisponiveis = useMemo(() => {
    if (!destCond) return [];
    return [...new Set(moradores.filter(m => m.condominio === destCond).map(m => m.bloco).filter(Boolean))].sort();
  }, [destCond, moradores]);

  const moradoresDisponiveis = useMemo(() => {
    let filtrados = moradores;
    if (destCond) filtrados = filtrados.filter(m => m.condominio === destCond);
    if (destBloco && destTipo === 'morador') filtrados = filtrados.filter(m => m.bloco === destBloco);
    return filtrados;
  }, [destCond, destBloco, destTipo, moradores]);

  /* Destinatários calculados para envio */
  const calcularDestinatarios = (): { emails: string[]; nomes: string[]; moradores: Morador[] } => {
    let alvo: Morador[] = [];
    if (destTipo === 'condominio') {
      alvo = moradores.filter(m => m.condominio === destCond && m.email);
    } else if (destTipo === 'bloco') {
      alvo = moradores.filter(m => m.condominio === destCond && m.bloco === destBloco && m.email);
    } else {
      const mor = moradores.find(m => m.id === destMoradorId);
      if (mor && mor.email) alvo = [mor];
    }
    return {
      emails: alvo.map(m => m.email).filter(Boolean),
      nomes: alvo.map(m => m.nome),
      moradores: alvo,
    };
  };

  /* PDF upload */
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Apenas arquivos PDF são permitidos.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPdfAnexo(reader.result as string);
      setPdfNome(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* Enviar */
  const enviar = () => {
    if (!tentarAcao()) return;
    if (!titulo.trim() || !destCond) return;
    if (tipo === 'comunicado' && !mensagem.trim() && !pdfAnexo) return;
    if (tipo === 'aviso' && !mensagem.trim()) return;
    if (destTipo === 'bloco' && !destBloco) return;
    if (destTipo === 'morador' && !destMoradorId) return;

    const dest = calcularDestinatarios();
    if (dest.emails.length === 0) {
      alert('Nenhum morador com e-mail cadastrado foi encontrado para o destinatário selecionado.');
      return;
    }

    setEnviando(true);

    /* Simula envio de e-mail (em produção seria via API/backend) */
    setTimeout(() => {
      const moradorSelecionado = destTipo === 'morador' ? moradores.find(m => m.id === destMoradorId) : undefined;
      const agora = new Date().toISOString();

      /* Gera tracking inicial — status senviados para todos */
      const trackingInicial: EmailTracking[] = dest.moradores.map(m => ({
        email: m.email,
        nome: m.nome,
        status: 'enviado' as StatusEmail,
        atualizadoEm: agora,
      }));

      /* Gera o template HTML do e-mail */
      const dataFormatada = new Date().toLocaleDateString('pt-BR');
      const assunto = gerarAssunto(tipo, titulo.trim(), destCond);
      const emailHtml = gerarEmailTemplate({
        tipo,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        condominio: destCond,
        destinatarioNome: destTipo === 'morador' && moradorSelecionado ? moradorSelecionado.nome : 'Morador(a)',
        enviadoPor: obterUsuarioAtual(),
        data: dataFormatada,
        pdfNome: tipo === 'comunicado' ? pdfNome : undefined,
      });

      const novo: Comunicado = {
        id: `com${Date.now()}`,
        tipo,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        pdfAnexo: tipo === 'comunicado' ? pdfAnexo : undefined,
        pdfNome: tipo === 'comunicado' ? pdfNome : undefined,
        destinatarioTipo: destTipo,
        condominio: destCond,
        bloco: destTipo === 'bloco' ? destBloco : undefined,
        moradorId: destTipo === 'morador' ? destMoradorId : undefined,
        moradorNome: moradorSelecionado?.nome,
        emailsEnviados: dest.emails,
        tracking: trackingInicial,
        emailHtml,
        assunto,
        criadoEm: new Date().toISOString(),
        enviadoPor: obterUsuarioAtual(),
      };

      comunicadosApi.create(novo).then((criado) => {
        setComunicados(prev => [criado as Comunicado || novo, ...prev]);
      }).catch(() => {
        setComunicados(prev => [novo, ...prev]);
      });
      setEnviando(false);
      setEnvioSucesso(true);
      setTimeout(() => {
        setEnvioSucesso(false);
        fecharModal();
      }, 2000);
    }, 1500);
  };

  /* Modal control */
  const abrirNovo = () => {
    setTipo('aviso');
    setTitulo('');
    setMensagem('');
    setPdfAnexo(undefined);
    setPdfNome(undefined);
    setDestTipo('condominio');
    setDestCond('');
    setDestBloco('');
    setDestMoradorId('');
    setEnviando(false);
    setEnvioSucesso(false);
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (enviando) return;
    setModalAberto(false);
  };

  /* Delete */
  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await comunicadosApi.remove(id);
      setComunicados(prev => prev.filter(c => c.id !== id));
    } catch (err) { console.error(err); }
    setConfirmDelete(null);
  };

  /* Simular atualização de tracking (em produção viria de webhook do serviço de e-mail) */
  const simularAtualizacaoTracking = (comunicadoId: string) => {
    setComunicados(prev => prev.map(c => {
      if (c.id !== comunicadoId) return c;
      const statusOpcoes: StatusEmail[] = ['aberto', 'nao_aberto', 'spam'];
      const pesos = [0.55, 0.35, 0.10]; /* 55% abriu, 35% não abriu, 10% spam */
      const agora = new Date().toISOString();
      const novoTracking = c.tracking.map(t => {
        const rand = Math.random();
        let acumulado = 0;
        let novoStatus: StatusEmail = 'nao_aberto';
        for (let i = 0; i < statusOpcoes.length; i++) {
          acumulado += pesos[i];
          if (rand <= acumulado) { novoStatus = statusOpcoes[i]; break; }
        }
        return { ...t, status: novoStatus, atualizadoEm: agora };
      });
      return { ...c, tracking: novoTracking };
    }));
  };

  /* Sync modal tracking com estado atualizado */
  useEffect(() => {
    if (modalTracking) {
      const atualizado = comunicados.find(c => c.id === modalTracking.id);
      if (atualizado && atualizado !== modalTracking) {
        setModalTracking(atualizado);
      }
    }
  }, [comunicados]);

  /* Filter */
  const comunicadosFiltrados = comunicados.filter(c => {
    const matchBusca = !busca ||
      c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      c.condominio.toLowerCase().includes(busca.toLowerCase()) ||
      (c.moradorNome || '').toLowerCase().includes(busca.toLowerCase());
    const matchTipo = !filtroTipo || c.tipo === filtroTipo;
    const matchCond = !filtroCond || c.condominio === filtroCond;
    return matchBusca && matchTipo && matchCond;
  });

  const pag = usePagination(comunicadosFiltrados, { pageSize: 20 });

  /* Stats */
  const totalComunicados = comunicados.filter(c => c.tipo === 'comunicado').length;
  const totalAvisos = comunicados.filter(c => c.tipo === 'aviso').length;
  const totalEmails = comunicados.reduce((acc, c) => acc + c.emailsEnviados.length, 0);

  /* Tracking stats helpers */
  const trackingStats = (c: Comunicado) => {
    const t = c.tracking || [];
    return {
      abertos: t.filter(x => x.status === 'aberto').length,
      naoAbertos: t.filter(x => x.status === 'enviado' || x.status === 'nao_aberto').length,
      spam: t.filter(x => x.status === 'spam').length,
      total: t.length,
    };
  };

  const statusLabel = (s: StatusEmail) => {
    switch (s) {
      case 'aberto': return 'Aberto';
      case 'nao_aberto': return 'Não aberto';
      case 'spam': return 'Spam';
      default: return 'Enviado';
    }
  };

  /* Dest label */
  const destLabel = (c: Comunicado) => {
    if (c.destinatarioTipo === 'condominio') return `Todo o ${c.condominio}`;
    if (c.destinatarioTipo === 'bloco') return `${c.condominio} — Bloco ${c.bloco}`;
    return `${c.moradorNome || 'Morador'} (${c.condominio})`;
  };

  /* Export */
  const compartilhar = () => compartilharConteudo(
    'Comunicados e Avisos',
    comunicados.map(c => `[${c.tipo.toUpperCase()}] ${c.titulo} → ${destLabel(c)} (${new Date(c.criadoEm).toLocaleDateString('pt-BR')})`).join('\n')
  );
  const imprimir = () => imprimirElemento('comunicados-content');
  const gerarPdf = () => gerarPdfDeElemento('comunicados-content', 'comunicados');

  /* Preview do e-mail no modal de envio */
  const gerarPreviewAtual = (): string | null => {
    if (!titulo.trim() || !destCond) return null;
    return gerarEmailTemplate({
      tipo,
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      condominio: destCond,
      destinatarioNome: 'Morador(a)',
      enviadoPor: obterUsuarioAtual(),
      data: new Date().toLocaleDateString('pt-BR'),
      pdfNome: tipo === 'comunicado' ? pdfNome : undefined,
    });
  };

  /* Preview do destinatário no modal */
  const previewDest = useMemo(() => {
    const d = calcularDestinatarios();
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destTipo, destCond, destBloco, destMoradorId, moradores]);

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}>Carregando comunicados...</div>;

  return (
    <div id="comunicados-content">
      <HowItWorks
        titulo="Comunicado e Avisos"
        descricao="Envie comunicado em PDF e avisos rápidos para moradores."
        passos={[
          '📄 Comunicado — Envie documentos em PDF para moradores, blocos ou todo o condomínio.',
          '⚡ Aviso Rápido — Envie mensagens de texto curtas diretamente por e-mail.',
          '🎯 Segmentação — Escolha enviar por morador individual, bloco ou condomínio inteiro.',
          '👁️ Visualizar E-mail — Pré-visualize o e-mail antes de enviar e confira o enviado no histórico.',
        ]}
      />

      <PageHeader
        titulo="Comunicado / Avisos"
        onCompartilhar={compartilhar}
        onImprimir={imprimir}
        onGerarPdf={gerarPdf}
      />

      {/* Cards de resumo */}
      <div className={styles.resumoGrid}>
        <Card>
          <div className={styles.resumoCard}>
            <FileText size={24} />
            <div>
              <span className={styles.resumoNum}>{totalComunicados}</span>
              <span className={styles.resumoLabel}>Comunicados (PDF)</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className={styles.resumoCard}>
            <Megaphone size={24} />
            <div>
              <span className={styles.resumoNum}>{totalAvisos}</span>
              <span className={styles.resumoLabel}>Avisos Rápidos</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className={styles.resumoCard}>
            <Mail size={24} />
            <div>
              <span className={styles.resumoNum}>{totalEmails}</span>
              <span className={styles.resumoLabel}>E-mails Enviados</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por título, condomínio ou morador..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select className={styles.filtroSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as '' | TipoEnvio)}>
          <option value="">Todos os tipos</option>
          <option value="comunicado">Comunicados</option>
          <option value="aviso">Avisos</option>
        </select>
        <select className={styles.filtroSelect} value={filtroCond} onChange={e => setFiltroCond(e.target.value)}>
          <option value="">Todos os condomínios</option>
          {[...new Set(comunicados.map(c => c.condominio))].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className={styles.addBtn} onClick={abrirNovo}>
          <Plus size={16} /> Novo Envio
        </button>
      </div>

      {/* Lista / Histórico */}
      <Card>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Destinatário</th>
                <th>E-mails</th>
                <th>Status</th>
                <th>Enviado por</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {comunicadosFiltrados.length === 0 ? (
                <tr><td colSpan={8} className={styles.empty}>Nenhum comunicado ou aviso enviado.</td></tr>
              ) : (
                pag.items.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className={`${styles.tipoBadge} ${c.tipo === 'comunicado' ? styles.tipoComunicado : styles.tipoAviso}`}>
                        {c.tipo === 'comunicado' ? <FileText size={12} /> : <Megaphone size={12} />}
                        {c.tipo === 'comunicado' ? 'Comunicado' : 'Aviso'}
                      </span>
                    </td>
                    <td className={styles.cellTitulo}>
                      {c.titulo}
                      {c.pdfNome && <span className={styles.pdfTag}><Paperclip size={11} /> PDF</span>}
                    </td>
                    <td>{destLabel(c)}</td>
                    <td className={styles.cellCenter}>{c.emailsEnviados.length}</td>
                    <td>
                      {(() => {
                        const s = trackingStats(c);
                        return (
                          <div className={styles.trackingMini}>
                            {s.abertos > 0 && <span className={styles.trackAberto} title="Abertos"><Eye size={11} /> {s.abertos}</span>}
                            {s.naoAbertos > 0 && <span className={styles.trackNaoAberto} title="Não abertos"><EyeOff size={11} /> {s.naoAbertos}</span>}
                            {s.spam > 0 && <span className={styles.trackSpam} title="Spam"><ShieldAlert size={11} /> {s.spam}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td>{c.enviadoPor}</td>
                    <td>{new Date(c.criadoEm).toLocaleDateString('pt-BR')} {new Date(c.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <div className={styles.cellActions}>
                        <button className={styles.actionBtn} onClick={() => { if (c.emailHtml) setModalPreviewHtml(c.emailHtml); }} title="Ver e-mail enviado" disabled={!c.emailHtml}>
                          <Mail size={14} />
                        </button>
                        <button className={styles.actionBtn} onClick={() => setModalTracking(c)} title="Ver rastreamento">
                          <BarChart3 size={14} />
                        </button>
                        {confirmDelete === c.id ? (
                          <>
                            <button className={styles.actionBtnDanger} onClick={() => excluir(c.id)} title="Confirmar"><Check size={14} /></button>
                            <button className={styles.actionBtn} onClick={() => setConfirmDelete(null)} title="Cancelar"><X size={14} /></button>
                          </>
                        ) : (
                          <button className={styles.actionBtnDanger} onClick={() => setConfirmDelete(c.id)} title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <WhatsAppShare mensagem={`*Comunicado*\n*Tipo:* ${c.tipo}\n*Título:* ${c.titulo}\n*Mensagem:* ${c.mensagem || 'N/A'}\n*Destinatário:* ${c.destinatarioTipo || 'N/A'}\n*Enviado por:* ${c.enviadoPor}`} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pag.page}
          totalPages={pag.totalPages}
          totalItems={pag.totalItems}
          pageSize={pag.pageSize}
          onPageChange={pag.goToPage}
          hasNext={pag.hasNext}
          hasPrev={pag.hasPrev}
        />
      </Card>

      {/* ===== Modal Envio ===== */}
      {modalAberto && (
        <div className={styles.overlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Novo Comunicado / Aviso</h3>
              <button className={styles.modalClose} onClick={fecharModal}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>

              {envioSucesso ? (
                <div className={styles.sucessoMsg}>
                  <Check size={32} />
                  <h4>Envio realizado com sucesso!</h4>
                  <p>{previewDest.emails.length} e-mail(") enviado(").</p>
                </div>
              ) : (
                <>
                  {/* Tipo */}
                  <div className={styles.tipoSelector}>
                    <button
                      className={`${styles.tipoBtn} ${tipo === 'aviso' ? styles.tipoBtnAtivo : ''}`}
                      onClick={() => setTipo('aviso')}
                    >
                      <Megaphone size={18} /> Aviso Rápido
                    </button>
                    <button
                      className={`${styles.tipoBtn} ${tipo === 'comunicado' ? styles.tipoBtnAtivo : ''}`}
                      onClick={() => setTipo('comunicado')}
                    >
                      <FileText size={18} /> Comunicado (PDF)
                    </button>
                  </div>

                  {/* Título */}
                  <div className={styles.formGroup}>
                    <label>Título *</label>
                    <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Manutenção da piscina" />
                  </div>

                  {/* Mensagem */}
                  <div className={styles.formGroup}>
                    <label>{tipo === 'aviso' ? 'Mensagem *' : 'Mensagem (corpo do e-mail)'}</label>
                    <textarea
                      value={mensagem}
                      onChange={e => setMensagem(e.target.value)}
                      placeholder={tipo === 'aviso' ? 'Digite o aviso rápido...' : 'Texto complementar ao PDF (opcional)...'}
                      rows={4}
                      className={styles.textarea}
                    />
                  </div>

                  {/* PDF Upload (comunicado) */}
                  {tipo === 'comunicado' && (
                    <div className={styles.formGroup}>
                      <label>Anexo PDF {!mensagem.trim() && '*'}</label>
                      {pdfAnexo ? (
                        <div className={styles.pdfPreview}>
                          <FileText size={18} />
                          <span>{pdfNome}</span>
                          <button onClick={() => { setPdfAnexo(undefined); setPdfNome(undefined); }} className={styles.pdfRemove}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className={styles.uploadLabel}>
                          <Paperclip size={16} /> Selecionar PDF
                          <input
                            ref={pdfInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Destinatário */}
                  <div className={styles.destSection}>
                    <h4 className={styles.destTitle}><Send size={16} /> Destinatário</h4>

                    <div className={styles.destSelector}>
                      <button className={`${styles.destBtn} ${destTipo === 'condominio' ? styles.destBtnAtivo : ''}`} onClick={() => { setDestTipo('condominio'); setDestBloco(''); setDestMoradorId(''); }}>
                        <Building2 size={16} /> Todo Condomínio
                      </button>
                      <button className={`${styles.destBtn} ${destTipo === 'bloco' ? styles.destBtnAtivo : ''}`} onClick={() => { setDestTipo('bloco'); setDestMoradorId(''); }}>
                        <Home size={16} /> Por Bloco
                      </button>
                      <button className={`${styles.destBtn} ${destTipo === 'morador' ? styles.destBtnAtivo : ''}`} onClick={() => { setDestTipo('morador'); setDestBloco(''); }}>
                        <Users size={16} /> Por Morador
                      </button>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Condomínio *</label>
                      <select value={destCond} onChange={e => { setDestCond(e.target.value); setDestBloco(''); setDestMoradorId(''); }}>
                        <option value="">Selecione...</option>
                        {condList.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {destTipo === 'bloco' && destCond && (
                      <div className={styles.formGroup}>
                        <label>Bloco *</label>
                        <select value={destBloco} onChange={e => setDestBloco(e.target.value)}>
                          <option value="">Selecione o bloco...</option>
                          {blocosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {blocosDisponiveis.length === 0 && <small className={styles.hint}>Nenhum bloco encontrado para este condomínio.</small>}
                      </div>
                    )}

                    {destTipo === 'morador' && destCond && (
                      <div className={styles.formGroup}>
                        <label>Morador *</label>
                        <select value={destMoradorId} onChange={e => setDestMoradorId(e.target.value)}>
                          <option value="">Selecione o morador...</option>
                          {moradoresDisponiveis.map(m => (
                            <option key={m.id} value={m.id}>{m.nome} — Bl.{m.bloco} Ap.{m.apartamento}</option>
                          ))}
                        </select>
                        {moradoresDisponiveis.length === 0 && <small className={styles.hint}>Nenhum morador cadastrado neste condomínio.</small>}
                      </div>
                    )}

                    {/* Preview de destinatários */}
                    {destCond && previewDest.emails.length > 0 && (
                      <div className={styles.destPreview}>
                        <Mail size={14} />
                        <span>{previewDest.emails.length} e-mail(") será(ão) enviado(")</span>
                      </div>
                    )}
                    {destCond && previewDest.emails.length === 0 && (
                      <div className={styles.destPreviewVazio}>
                        <AlertCircle size={14} />
                        <span>Nenhum morador com e-mail encontrado para este destinatário.</span>
                      </div>
                    )}
                  </div>

                  {/* Botão Preview do E-mail */}
                  {titulo.trim() && (tipo === 'aviso' ? mensagem.trim() : (mensagem.trim() || pdfAnexo)) && (
                    <button
                      type="button"
                      className={styles.previewEmailBtn}
                      onClick={() => { const html = gerarPreviewAtual(); if (html) setModalPreviewHtml(html); }}
                    >
                      <Eye size={16} /> Visualizar E-mail
                    </button>
                  )}
                </>
              )}
            </div>

            {!envioSucesso && (
              <div className={styles.modalFooter}>
                <button className={styles.btnCancelar} onClick={fecharModal} disabled={enviando}>Cancelar</button>
                <button
                  className={styles.btnEnviar}
                  onClick={enviar}
                  disabled={
                    enviando ||
                    !titulo.trim() ||
                    !destCond ||
                    (tipo === 'aviso' && !mensagem.trim()) ||
                    (tipo === 'comunicado' && !mensagem.trim() && !pdfAnexo) ||
                    (destTipo === 'bloco' && !destBloco) ||
                    (destTipo === 'morador' && !destMoradorId) ||
                    previewDest.emails.length === 0
                  }
                >
                  {enviando ? (
                    <><Clock size={16} /> Enviando...</>
                  ) : (
                    <><Send size={16} /> Enviar</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ===== Modal Preview E-mail ===== */}
      {modalPreviewHtml && (
        <div className={styles.overlay} onClick={() => setModalPreviewHtml(null)}>
          <div className={styles.modalLarge} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Preview do E-mail</h3>
              <button className={styles.modalClose} onClick={() => setModalPreviewHtml(null)}><X size={18} /></button>
            </div>
            <div className={styles.emailPreviewWrap}>
              <iframe
                title="Email Preview"
                srcDoc={modalPreviewHtml}
                className={styles.emailIframe}
                sandbox="allow-same-origin"
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={() => setModalPreviewHtml(null)}>Fechar</button>
              <button
                className={styles.btnEnviar}
                onClick={() => {
                  const blob = new Blob([modalPreviewHtml], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'email-preview.html';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <ExternalLink size={14} /> Baixar HTML
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== Modal Rastreamento ===== */}
      {modalTracking && (
        <div className={styles.overlay} onClick={() => setModalTracking(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Rastreamento de E-mails</h3>
              <button className={styles.modalClose} onClick={() => setModalTracking(null)}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.trackingInfo}>
                <strong>{modalTracking.titulo}</strong>
                <span className={styles.trackingInfoSub}>{destLabel(modalTracking)} — {new Date(modalTracking.criadoEm).toLocaleDateString('pt-BR')}</span>
              </div>

              {/* Resumo visual */}
              {(() => {
                const s = trackingStats(modalTracking);
                const pctAberto = s.total > 0 ? Math.round((s.abertos / s.total) * 100) : 0;
                return (
                  <div className={styles.trackingResumo}>
                    <div className={styles.trackingBar}>
                      <div className={styles.trackingBarAberto} style={{ width: `${s.total > 0 ? (s.abertos / s.total) * 100 : 0}%` }} />
                      <div className={styles.trackingBarSpam} style={{ width: `${s.total > 0 ? (s.spam / s.total) * 100 : 0}%` }} />
                    </div>
                    <div className={styles.trackingResumoCards}>
                      <div className={styles.trackResumoItem}>
                        <Eye size={16} className={styles.iconAberto} />
                        <span className={styles.trackResumoNum}>{s.abertos}</span>
                        <span className={styles.trackResumoLabel}>Aberto(s) ({pctAberto}%)</span>
                      </div>
                      <div className={styles.trackResumoItem}>
                        <EyeOff size={16} className={styles.iconNaoAberto} />
                        <span className={styles.trackResumoNum}>{s.naoAbertos}</span>
                        <span className={styles.trackResumoLabel}>Não aberto(s)</span>
                      </div>
                      <div className={styles.trackResumoItem}>
                        <ShieldAlert size={16} className={styles.iconSpam} />
                        <span className={styles.trackResumoNum}>{s.spam}</span>
                        <span className={styles.trackResumoLabel}>Spam</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button className={styles.refreshBtn} onClick={() => simularAtualizacaoTracking(modalTracking.id)}>
                <RefreshCw size={14} /> Atualizar Status (simulação)
              </button>

              {/* Tabela de detalhes */}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Morador</th>
                      <th>E-mail</th>
                      <th>Status</th>
                      <th>Última Atualização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalTracking.tracking || []).map((t, i) => (
                      <tr key={i}>
                        <td className={styles.cellTitulo}>{t.nome}</td>
                        <td>{t.email}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[`status_${t.status}`]}`}>
                            {t.status === 'aberto' && <Eye size={11} />}
                            {t.status === 'enviado' && <Send size={11} />}
                            {t.status === 'nao_aberto' && <EyeOff size={11} />}
                            {t.status === 'spam' && <ShieldAlert size={11} />}
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td>{new Date(t.atualizadoEm).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.trackingNote}>
                Em produção, o rastreamento é feito via pixel de abertura e webhooks do serviço de e-mail (SendGrid, AWS SES, Mailgun). Os status são atualizados automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComunicadosPage;
