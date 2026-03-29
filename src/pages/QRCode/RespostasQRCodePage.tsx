import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  QrCode, Search, X, ChevronDown, Star, BarChart3, CheckSquare,
  AlertTriangle, MessageCircle, Bell, FileText, Image, Clock,
  MapPin, User, Building2, Hash, Filter, Eye, Download,
  Fingerprint, Hourglass, PenTool, Camera, Wrench, CalendarPlus,
  Siren, ClipboardCheck, Mail, Phone, RefreshCw, ChevronLeft
} from 'lucide-react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { qrcodes as qrcodesApi } from '../../services/api';
import styles from './RespostasQRCode.module.css';

/* ══════════════════════════════════════
   TIPOS
══════════════════════════════════════ */
type BlocoTipo =
  | 'titulo' | 'subtitulo' | 'texto' | 'galeria' | 'descricao'
  | 'checklist' | 'status' | 'prioridade' | 'avaliacao_estrela'
  | 'avaliacao_escala' | 'pergunta' | 'aviso' | 'comunicado' | 'feedback'
  | 'urgencia' | 'agendar_servico' | 'pesquisa_satisfacao' | 'controle_ponto'
  | 'sla_tempo' | 'assinatura_digital' | 'ocorrencia' | 'manutencao';

interface BlocoConfig {
  id: string;
  tipo: BlocoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes?: string[];
  maxFotos?: number;
  maxEstrelas?: number;
  escalaMax?: number;
}

interface QRCodeFormulario {
  id: string;
  nome: string;
  descricao: string;
  logo: string | null;
  blocos: BlocoConfig[];
  respostas: number;
  ativo: boolean;
}

interface Identificacao {
  tipo: string;
  nome: string;
  bloco: string;
  unidade: string;
  anonimo: boolean;
}

interface RespostaQRCode {
  id: string;
  qrcodeId: string;
  qrcodeNome: string;
  identificacao: Identificacao;
  respostas: Record<string, any>;
  respondidoPorNome: string;
  respondidoPorEmail: string;
  respondidoEm: string;
  latitude?: number;
  longitude?: number;
  endereco?: string;
}

/* ══════════════════════════════════════
   CONSTANTES
══════════════════════════════════════ */
const BLOCOS_INFO: Record<BlocoTipo, { label: string; icone: React.ReactNode; cor: string }> = {
  titulo:              { label: 'Título',                  icone: <FileText size={15} />,      cor: '#1565c0' },
  subtitulo:           { label: 'Sub-título',              icone: <FileText size={15} />,      cor: '#1976d2' },
  texto:               { label: 'Texto',                   icone: <FileText size={15} />,      cor: '#2196f3' },
  galeria:             { label: 'Galeria de Fotos',        icone: <Image size={15} />,         cor: '#7b1fa2' },
  descricao:           { label: 'Descrição',               icone: <FileText size={15} />,      cor: '#00838f' },
  checklist:           { label: 'Checklist',               icone: <CheckSquare size={15} />,   cor: '#2e7d32' },
  status:              { label: 'Status',                  icone: <BarChart3 size={15} />,     cor: '#f57c00' },
  prioridade:          { label: 'Prioridade',              icone: <AlertTriangle size={15} />, cor: '#d32f2f' },
  avaliacao_estrela:   { label: 'Avaliação Estrela',       icone: <Star size={15} />,          cor: '#fbc02d' },
  avaliacao_escala:    { label: 'Avaliação Escala',        icone: <BarChart3 size={15} />,     cor: '#e65100' },
  pergunta:            { label: 'Perguntas',               icone: <MessageCircle size={15} />, cor: '#5c6bc0' },
  aviso:               { label: 'Avisos',                  icone: <AlertTriangle size={15} />, cor: '#ff6f00' },
  comunicado:          { label: 'Comunicados',             icone: <Bell size={15} />,          cor: '#00695c' },
  feedback:            { label: 'Feedback',                icone: <Mail size={15} />,          cor: '#0277bd' },
  urgencia:            { label: 'Urgência',                icone: <Siren size={15} />,         cor: '#b71c1c' },
  agendar_servico:     { label: 'Agendar Serviço',         icone: <CalendarPlus size={15} />,  cor: '#4a148c' },
  pesquisa_satisfacao: { label: 'Pesquisa Satisfação',     icone: <ClipboardCheck size={15} />,cor: '#00695c' },
  controle_ponto:      { label: 'Controle de Ponto',       icone: <Fingerprint size={15} />,   cor: '#1565c0' },
  sla_tempo:           { label: 'SLA',                     icone: <Hourglass size={15} />,     cor: '#e65100' },
  assinatura_digital:  { label: 'Assinatura Digital',      icone: <PenTool size={15} />,       cor: '#4527a0' },
  ocorrencia:          { label: 'Ocorrência',              icone: <Camera size={15} />,        cor: '#c62828' },
  manutencao:          { label: 'Manutenção',              icone: <Wrench size={15} />,        cor: '#e65100' },
};

const TIPO_RESPONDENTE: Record<string, string> = {
  morador: 'Morador',
  funcionario: 'Funcionário',
  prestador: 'Prestador',
};

const formatarDataHora = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/* ══════════════════════════════════════
   COMPONENTE: Exibição do valor de um bloco
══════════════════════════════════════ */
const ValorBloco: React.FC<{ bloco: BlocoConfig; valor: any }> = ({ bloco, valor }) => {
  if (valor === undefined || valor === null || valor === '') {
    return <span className={styles.semResposta}>Não respondido</span>;
  }

  if (bloco.tipo === 'avaliacao_estrela') {
    const nota = Number(valor) || 0;
    return (
      <div className={styles.estrelas}>
        {[1,2,3,4,5].map(n => (
          <Star key={n} size={18} fill={nota >= n ? '#fbc02d' : 'none'} stroke={nota >= n ? '#fbc02d' : '#ccc'} />
        ))}
        <span className={styles.estrelasNota}>{nota}/5</span>
      </div>
    );
  }

  if (bloco.tipo === 'avaliacao_escala') {
    const nota = Number(valor);
    const cor = nota <= 3 ? '#e53935' : nota <= 6 ? '#fb8c00' : '#43a047';
    return (
      <div className={styles.escala}>
        <span className={styles.escalaNum} style={{ background: cor }}>{nota}</span>
        <span className={styles.escalaLabel}>/10 — {nota <= 3 ? 'Muito ruim' : nota <= 6 ? 'Regular' : nota <= 8 ? 'Bom' : 'Excelente'}</span>
      </div>
    );
  }

  if (bloco.tipo === 'checklist' && Array.isArray(valor)) {
    const marcados = valor.filter(Boolean).length;
    return (
      <div className={styles.checklistResp}>
        {bloco.opcoes?.map((op, idx) => (
          <div key={idx} className={`${styles.checkItem} ${valor[idx] ? styles.checkItemMarcado : ''}`}>
            <CheckSquare size={14} />
            <span>{op}</span>
          </div>
        ))}
        <span className={styles.checklistResumo}>{marcados}/{bloco.opcoes?.length || 0} marcados</span>
      </div>
    );
  }

  if (bloco.tipo === 'pergunta' && Array.isArray(valor)) {
    return (
      <div className={styles.perguntasResp}>
        {bloco.opcoes?.map((pergunta, idx) => (
          <div key={idx} className={styles.perguntaItem}>
            <span className={styles.perguntaTexto}>{pergunta}</span>
            <span className={styles.perguntaResposta}>{valor[idx] || <em>Sem resposta</em>}</span>
          </div>
        ))}
      </div>
    );
  }

  if (bloco.tipo === 'feedback' && typeof valor === 'object') {
    return (
      <div className={styles.feedbackResp}>
        {valor.whatsapp && <div className={styles.feedbackItem}><Phone size={13} /> {valor.whatsapp}</div>}
        {valor.email && <div className={styles.feedbackItem}><Mail size={13} /> {valor.email}</div>}
      </div>
    );
  }

  if (bloco.tipo === 'urgencia' && typeof valor === 'object') {
    return (
      <div className={styles.urgenciaResp}>
        {valor.tipo && <span className={styles.urgenciaTag}><Siren size={12} /> {valor.tipo}</span>}
        {valor.descricao && <p className={styles.urgenciaDescricao}>{valor.descricao}</p>}
      </div>
    );
  }

  if ((bloco.tipo === 'ocorrencia' || bloco.tipo === 'manutencao') && typeof valor === 'object') {
    return (
      <div className={styles.ocorrenciaResp}>
        {valor.tipo && <span className={styles.ocorrenciaTag}>{valor.tipo}</span>}
        {valor.prioridade && <span className={styles.prioridadeTag} data-prioridade={valor.prioridade}>{valor.prioridade}</span>}
        {valor.local && <div className={styles.ocorrenciaInfo}><MapPin size={12} /> {valor.local}</div>}
        {valor.descricao && <p className={styles.ocorrenciaDescricao}>{valor.descricao}</p>}
        {valor.fotos && valor.fotos.length > 0 && (
          <div className={styles.ocorrenciaFotos}>
            {valor.fotos.map((foto: string, idx: number) => (
              <img key={idx} src={foto} alt={`Foto ${idx+1}`} className={styles.ocorrenciaFoto} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (bloco.tipo === 'agendar_servico' && typeof valor === 'object') {
    return (
      <div className={styles.agendarResp}>
        {valor.tipo && <span className={styles.agendarTag}>{valor.tipo}</span>}
        {valor.data && <div className={styles.agendarInfo}><Clock size={12} /> {valor.data}{valor.hora ? ` às ${valor.hora}` : ''}</div>}
        {valor.observacoes && <p className={styles.agendarObs}>{valor.observacoes}</p>}
      </div>
    );
  }

  if (bloco.tipo === 'pesquisa_satisfacao' && typeof valor === 'object') {
    return (
      <div className={styles.pesquisaResp}>
        {Object.entries(valor).map(([pergunta, nota]: [string, any]) => (
          <div key={pergunta} className={styles.pesquisaItem}>
            <span className={styles.pesquisaPergunta}>{pergunta}</span>
            <div className={styles.estrelas}>
              {[1,2,3,4,5].map(n => (
                <Star key={n} size={14} fill={Number(nota) >= n ? '#fbc02d' : 'none'} stroke={Number(nota) >= n ? '#fbc02d' : '#ccc'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (bloco.tipo === 'assinatura_digital' && typeof valor === 'object') {
    return (
      <div className={styles.assinaturaResp}>
        {valor.imagem && <img src={valor.imagem} alt="Assinatura" className={styles.assinaturaImg} />}
        <div className={styles.assinaturaInfo}>
          <span>{valor.signatario}</span>
          {valor.dataHora && <span className={styles.assinaturaData}>{new Date(valor.dataHora).toLocaleString('pt-BR')}</span>}
        </div>
      </div>
    );
  }

  if (bloco.tipo === 'galeria' && typeof valor === 'object' && valor.fotos) {
    return (
      <div className={styles.galeriaResp}>
        {valor.fotos.map((foto: string, idx: number) => (
          <img key={idx} src={foto} alt={`Foto ${idx+1}`} className={styles.galeriaFoto} />
        ))}
        <span className={styles.galeriaCount}>{valor.fotos.length} foto(s)</span>
      </div>
    );
  }

  return <span className={styles.valorTexto}>{String(valor)}</span>;
};

/* ══════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════ */
const RespostasQRCodePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [qrcodesList, setQrcodesList] = useState<QRCodeFormulario[]>([]);
  const [respostas, setRespostas] = useState<RespostaQRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrcodeSelecionado, setQrcodeSelecionado] = useState<string>(() => searchParams.get('qr') || 'todos');
  const [busca, setBusca] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [detalhe, setDetalhe] = useState<RespostaQRCode | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [qrs, resps] = await Promise.all([
        qrcodesApi.list().catch(() => []),
        qrcodesApi.listRespostas().catch(() => []),
      ]);
      setQrcodesList((qrs as any[]).map((q: any) => ({
        id: q.id,
        nome: q.nome,
        descricao: q.descricao || '',
        logo: q.logo,
        blocos: typeof q.blocos === 'string' ? JSON.parse(q.blocos) : (q.blocos || []),
        respostas: q.respostas || 0,
        ativo: q.ativo !== false,
      })));
      setRespostas((resps as any[]).map((r: any) => ({
        id: r.id,
        qrcodeId: r.qrcode_id,
        qrcodeNome: r.qrcode_nome || '',
        identificacao: typeof r.identificacao === 'string' ? JSON.parse(r.identificacao) : (r.identificacao || {}),
        respostas: typeof r.respostas === 'string' ? JSON.parse(r.respostas) : (r.respostas || {}),
        respondidoPorNome: r.respondido_por_nome || '',
        respondidoPorEmail: r.respondido_por_email || '',
        respondidoEm: r.respondido_em,
        latitude: r.latitude,
        longitude: r.longitude,
        endereco: r.endereco,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  /* ── Filtros ── */
  const respostasFiltradas = useMemo(() => {
    let lista = respostas;

    if (qrcodeSelecionado !== 'todos') {
      lista = lista.filter(r => r.qrcodeId === qrcodeSelecionado);
    }

    if (filtroData) {
      const dataFiltro = new Date(filtroData).toDateString();
      lista = lista.filter(r => new Date(r.respondidoEm).toDateString() === dataFiltro);
    }

    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(r => {
        const texto = [
          r.qrcodeNome,
          r.identificacao?.nome,
          r.identificacao?.bloco,
          r.identificacao?.unidade,
          r.respondidoPorNome,
          r.respondidoPorEmail,
          r.endereco,
        ].filter(Boolean).join(' ').toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }

    return lista;
  }, [respostas, qrcodeSelecionado, filtroData, busca]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const base = qrcodeSelecionado === 'todos' ? respostas : respostas.filter(r => r.qrcodeId === qrcodeSelecionado);
    const hoje = new Date().toDateString();
    const hoje_count = base.filter(r => new Date(r.respondidoEm).toDateString() === hoje).length;
    const ultima = base[0]?.respondidoEm;
    const qrAtivo = qrcodesList.find(q => q.id === qrcodeSelecionado);
    return { total: base.length, hoje: hoje_count, ultima, qrNome: qrAtivo?.nome };
  }, [respostas, qrcodeSelecionado, qrcodesList]);

  /* ── QR Code do detalhe ── */
  const qrDoDetalhe = detalhe ? qrcodesList.find(q => q.id === detalhe.qrcodeId) : null;

  /* ── Resumo textual de uma resposta ── */
  const resumoResposta = (resp: RespostaQRCode, qr?: QRCodeFormulario): string => {
    if (!qr) return '';
    const partes: string[] = [];
    for (const bloco of qr.blocos.slice(0, 3)) {
      const val = resp.respostas[bloco.id];
      if (!val) continue;
      if (bloco.tipo === 'avaliacao_estrela') partes.push(`${bloco.label}: ${val}/5 ★`);
      else if (bloco.tipo === 'avaliacao_escala') partes.push(`${bloco.label}: ${val}/10`);
      else if (bloco.tipo === 'status' || bloco.tipo === 'prioridade') partes.push(`${bloco.label}: ${val}`);
      else if (typeof val === 'string' && val.length > 0) partes.push(`${bloco.label}: ${val.slice(0, 40)}${val.length > 40 ? '...' : ''}`);
    }
    return partes.join(' · ') || 'Formulário preenchido';
  };

  const exportarCsv = () => {
    if (respostasFiltradas.length === 0) return;
    const qr = qrcodesList.find(q => q.id === qrcodeSelecionado);
    const linhas: string[][] = [];
    const cabecalho = ['Data/Hora', 'Respondente', 'Tipo', 'Bloco', 'Unidade', 'Email', 'Localização'];
    if (qr) qr.blocos.forEach(b => cabecalho.push(b.label));
    linhas.push(cabecalho);
    respostasFiltradas.forEach(r => {
      const linha = [
        formatarDataHora(r.respondidoEm),
        r.identificacao?.anonimo ? 'Anônimo' : (r.identificacao?.nome || r.respondidoPorNome || ''),
        TIPO_RESPONDENTE[r.identificacao?.tipo] || r.identificacao?.tipo || '',
        r.identificacao?.bloco || '',
        r.identificacao?.unidade || '',
        r.respondidoPorEmail || '',
        r.endereco || '',
      ];
      if (qr) {
        qr.blocos.forEach(b => {
          const val = r.respostas[b.id];
          linha.push(val !== undefined && val !== null ? String(typeof val === 'object' ? JSON.stringify(val) : val) : '');
        });
      }
      linhas.push(linha);
    });
    const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respostas-qrcode-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className={styles.loadingMsg}>Carregando respostas...</div>;

  return (
    <div id="respostas-qrcode-content">
      <HowItWorks
        titulo="Respostas dos QR Codes"
        descricao="Visualize e gerencie todas as respostas recebidas através dos QR Codes criados."
        passos={[
          'Selecione um QR Code na barra lateral para filtrar as respostas',
          'Cada card exibe o respondente, data/hora e um resumo das respostas',
          'Clique em Ver Detalhes para ver todas as respostas completas do formulário',
          'Use os filtros de data e busca para encontrar respostas específicas',
          'Exporte as respostas para CSV para análise em planilhas',
        ]}
      />

      <PageHeader
        titulo="Respostas dos QR Codes"
        subtitulo={`${respostasFiltradas.length} resposta${respostasFiltradas.length !== 1 ? 's' : ''}`}
        onCompartilhar={() => compartilharConteudo('Respostas QR Code', 'Listagem de respostas')}
        onImprimir={() => imprimirElemento('respostas-qrcode-content')}
        onGerarPdf={() => gerarPdfDeElemento('respostas-qrcode-content', 'respostas-qrcode')}
        acoes={
          <div className={styles.acoesHeader}>
            <button className={styles.btnAtualizar} onClick={carregarDados} title="Atualizar">
              <RefreshCw size={16} />
              <span>Atualizar</span>
            </button>
            {respostasFiltradas.length > 0 && (
              <button className={styles.btnExportar} onClick={exportarCsv}>
                <Download size={16} />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.total}</span>
          <span className={styles.statLabel}>Total de Respostas</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.hoje}</span>
          <span className={styles.statLabel}>Recebidas Hoje</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{qrcodesList.length}</span>
          <span className={styles.statLabel}>QR Codes Ativos</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.ultima ? formatarDataHora(stats.ultima) : '—'}</span>
          <span className={styles.statLabel}>Última Resposta</span>
        </div>
      </div>

      {/* ── Layout principal ── */}
      <div className={styles.layout}>

        {/* ── Sidebar: lista de QR Codes ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <QrCode size={16} />
            <span>QR Codes</span>
          </div>
          <button
            className={`${styles.sidebarItem} ${qrcodeSelecionado === 'todos' ? styles.sidebarItemAtivo : ''}`}
            onClick={() => setQrcodeSelecionado('todos')}
          >
            <span className={styles.sidebarItemNome}>Todos os QR Codes</span>
            <span className={styles.sidebarBadge}>{respostas.length}</span>
          </button>
          {qrcodesList.map(qr => {
            const count = respostas.filter(r => r.qrcodeId === qr.id).length;
            return (
              <button
                key={qr.id}
                className={`${styles.sidebarItem} ${qrcodeSelecionado === qr.id ? styles.sidebarItemAtivo : ''}`}
                onClick={() => setQrcodeSelecionado(qr.id)}
              >
                <div className={styles.sidebarItemInfo}>
                  <span className={styles.sidebarItemNome}>{qr.nome}</span>
                  {qr.descricao && <span className={styles.sidebarItemDesc}>{qr.descricao}</span>}
                </div>
                <span className={styles.sidebarBadge}>{count}</span>
              </button>
            );
          })}
        </aside>

        {/* ── Conteúdo principal ── */}
        <main className={styles.main}>

          {/* ── Filtros ── */}
          <div className={styles.filtrosBar}>
            <div className={styles.buscaWrapper}>
              <Search size={16} className={styles.buscaIcon} />
              <input
                className={styles.buscaInput}
                placeholder="Buscar por nome, bloco, unidade..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && <button className={styles.buscaLimpar} onClick={() => setBusca('')}><X size={14} /></button>}
            </div>

            <button className={`${styles.btnFiltros} ${showFiltros ? styles.btnFiltrosAtivo : ''}`} onClick={() => setShowFiltros(v => !v)}>
              <Filter size={15} />
              Filtros
              <ChevronDown size={14} className={showFiltros ? styles.chevronAberto : ''} />
            </button>

            {qrcodeSelecionado !== 'todos' && (
              <button className={styles.btnLimparFiltro} onClick={() => setQrcodeSelecionado('todos')}>
                <ChevronLeft size={14} />
                Todos
              </button>
            )}
          </div>

          {showFiltros && (
            <div className={styles.filtrosExtras}>
              <div className={styles.filtroGrupo}>
                <label className={styles.filtroLabel}>Filtrar por Data</label>
                <input
                  type="date"
                  className={styles.filtroInput}
                  value={filtroData}
                  onChange={e => setFiltroData(e.target.value)}
                />
              </div>
              {filtroData && (
                <button className={styles.btnLimparFiltro} onClick={() => setFiltroData('')}>
                  <X size={13} /> Limpar data
                </button>
              )}
            </div>
          )}

          {/* ── QR Code selecionado ── */}
          {qrcodeSelecionado !== 'todos' && (() => {
            const qr = qrcodesList.find(q => q.id === qrcodeSelecionado);
            if (!qr) return null;
            return (
              <div className={styles.qrSelecionadoBanner}>
                <div className={styles.qrSelecionadoInfo}>
                  <QrCode size={20} />
                  <div>
                    <strong>{qr.nome}</strong>
                    {qr.descricao && <span>{qr.descricao}</span>}
                  </div>
                </div>
                <div className={styles.qrSelecionadoBlocos}>
                  {qr.blocos.slice(0, 5).map(b => {
                    const info = BLOCOS_INFO[b.tipo];
                    return (
                      <span key={b.id} className={styles.blocoTag} style={{ background: info?.cor + '18', color: info?.cor }}>
                        {info?.icone} {b.label}
                      </span>
                    );
                  })}
                  {qr.blocos.length > 5 && <span className={styles.blocoTag}>+{qr.blocos.length - 5}</span>}
                </div>
              </div>
            );
          })()}

          {/* ── Lista de respostas ── */}
          {respostasFiltradas.length === 0 ? (
            <div className={styles.vazio}>
              <QrCode size={48} strokeWidth={1.2} />
              <strong>Nenhuma resposta encontrada</strong>
              <span>
                {respostas.length === 0
                  ? 'Os QR Codes ainda não receberam respostas. Compartilhe os QR Codes para começar!'
                  : 'Tente ajustar os filtros para encontrar respostas.'}
              </span>
            </div>
          ) : (
            <div className={styles.lista}>
              {respostasFiltradas.map(resp => {
                const qr = qrcodesList.find(q => q.id === resp.qrcodeId);
                const nomePessoa = resp.identificacao?.anonimo
                  ? 'Anônimo'
                  : resp.identificacao?.nome || resp.respondidoPorNome || 'Sem identificação';
                const tipoPessoa = TIPO_RESPONDENTE[resp.identificacao?.tipo] || resp.identificacao?.tipo || '';

                return (
                  <Card key={resp.id} padding="md" hover>
                    <div className={styles.respostaCard}>
                      <div className={styles.respostaCardTop}>
                        <div className={styles.respostaIdent}>
                          <div className={styles.respostaAvatar}>
                            <User size={18} />
                          </div>
                          <div className={styles.respostaIdentInfo}>
                            <strong className={styles.respostaNome}>{nomePessoa}</strong>
                            <div className={styles.respostaMeta}>
                              {tipoPessoa && <span className={styles.respostaTipo}>{tipoPessoa}</span>}
                              {resp.identificacao?.bloco && (
                                <span className={styles.respostaLocal}>
                                  <Building2 size={11} /> {resp.identificacao.bloco}
                                  {resp.identificacao.unidade ? ` · Unid. ${resp.identificacao.unidade}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={styles.respostaDataInfo}>
                          {qrcodeSelecionado === 'todos' && qr && (
                            <span className={styles.respostaQrNome}><QrCode size={11} /> {qr.nome}</span>
                          )}
                          <span className={styles.respostaData}><Clock size={12} /> {formatarDataHora(resp.respondidoEm)}</span>
                          {resp.endereco && (
                            <span className={styles.respostaEndereco}><MapPin size={11} /> {resp.endereco.length > 60 ? resp.endereco.slice(0, 60) + '...' : resp.endereco}</span>
                          )}
                        </div>
                      </div>

                      {/* Resumo das respostas */}
                      {qr && (
                        <div className={styles.respostaBlocosTags}>
                          {qr.blocos.slice(0, 4).map(bloco => {
                            const val = resp.respostas[bloco.id];
                            const info = BLOCOS_INFO[bloco.tipo];
                            if (!val && val !== 0) return null;
                            let resumo = '';
                            if (bloco.tipo === 'avaliacao_estrela') resumo = `${val}/5 ★`;
                            else if (bloco.tipo === 'avaliacao_escala') resumo = `${val}/10`;
                            else if (bloco.tipo === 'status' || bloco.tipo === 'prioridade') resumo = String(val);
                            else if (typeof val === 'string') resumo = val.slice(0, 30);
                            else if (bloco.tipo === 'checklist' && Array.isArray(val)) resumo = `${val.filter(Boolean).length}/${bloco.opcoes?.length || 0}`;
                            else if (typeof val === 'object') resumo = '(preenchido)';
                            if (!resumo) return null;
                            return (
                              <span key={bloco.id} className={styles.respostaBlocoTag} style={{ borderColor: info?.cor + '60', color: info?.cor }}>
                                {info?.icone} {bloco.label}: <strong>{resumo}</strong>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className={styles.respostaActions}>
                        <button className={styles.btnVerDetalhes} onClick={() => setDetalhe(resp)}>
                          <Eye size={14} /> Ver Detalhes
                        </button>
                        {resp.latitude && resp.longitude && (
                          <a
                            href={`https://www.google.com/maps?q=${resp.latitude},${resp.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.btnMapa}
                          >
                            <MapPin size={14} /> Ver no Mapa
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ══════════ MODAL: Detalhes da Resposta ══════════ */}
      <Modal aberto={!!detalhe} onFechar={() => setDetalhe(null)} titulo="Detalhes da Resposta" largura="md">
        {detalhe && (
          <div className={styles.detalheModal}>

            {/* Identificação */}
            <div className={styles.detalheSecao}>
              <h4 className={styles.detalheSecaoTitulo}><User size={16} /> Identificação</h4>
              <div className={styles.detalheGrade}>
                <div className={styles.detalheCampo}>
                  <span className={styles.detalheCampoLabel}>Respondente</span>
                  <span className={styles.detalheCampoValor}>
                    {detalhe.identificacao?.anonimo ? 'Anônimo' : (detalhe.identificacao?.nome || detalhe.respondidoPorNome || '—')}
                  </span>
                </div>
                {detalhe.identificacao?.tipo && (
                  <div className={styles.detalheCampo}>
                    <span className={styles.detalheCampoLabel}>Tipo</span>
                    <span className={styles.detalheCampoValor}>{TIPO_RESPONDENTE[detalhe.identificacao.tipo] || detalhe.identificacao.tipo}</span>
                  </div>
                )}
                {detalhe.identificacao?.bloco && (
                  <div className={styles.detalheCampo}>
                    <span className={styles.detalheCampoLabel}>Bloco</span>
                    <span className={styles.detalheCampoValor}>{detalhe.identificacao.bloco}</span>
                  </div>
                )}
                {detalhe.identificacao?.unidade && (
                  <div className={styles.detalheCampo}>
                    <span className={styles.detalheCampoLabel}>Unidade</span>
                    <span className={styles.detalheCampoValor}>{detalhe.identificacao.unidade}</span>
                  </div>
                )}
                <div className={styles.detalheCampo}>
                  <span className={styles.detalheCampoLabel}>Data/Hora</span>
                  <span className={styles.detalheCampoValor}>{formatarDataHora(detalhe.respondidoEm)}</span>
                </div>
                {detalhe.respondidoPorEmail && (
                  <div className={styles.detalheCampo}>
                    <span className={styles.detalheCampoLabel}>E-mail</span>
                    <span className={styles.detalheCampoValor}>{detalhe.respondidoPorEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Localização */}
            {(detalhe.endereco || detalhe.latitude) && (
              <div className={styles.detalheSecao}>
                <h4 className={styles.detalheSecaoTitulo}><MapPin size={16} /> Localização</h4>
                {detalhe.endereco && <p className={styles.detalheEndereco}>{detalhe.endereco}</p>}
                {detalhe.latitude && detalhe.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${detalhe.latitude},${detalhe.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btnMapaLink}
                  >
                    <MapPin size={13} /> Abrir no Google Maps
                  </a>
                )}
              </div>
            )}

            {/* QR Code */}
            <div className={styles.detalheSecao}>
              <h4 className={styles.detalheSecaoTitulo}><QrCode size={16} /> QR Code: {detalhe.qrcodeNome || qrDoDetalhe?.nome}</h4>
            </div>

            {/* Respostas do formulário */}
            {qrDoDetalhe && qrDoDetalhe.blocos.length > 0 ? (
              <div className={styles.detalheSecao}>
                <h4 className={styles.detalheSecaoTitulo}><Hash size={16} /> Respostas do Formulário</h4>
                <div className={styles.detalheRespostas}>
                  {qrDoDetalhe.blocos.map(bloco => {
                    const info = BLOCOS_INFO[bloco.tipo];
                    return (
                      <div key={bloco.id} className={styles.detalheBloco}>
                        <div className={styles.detalheBlocoHeader} style={{ color: info?.cor }}>
                          {info?.icone}
                          <span>{bloco.label}</span>
                          {bloco.obrigatorio && <span className={styles.detalheObrig}>*</span>}
                        </div>
                        <div className={styles.detalheBlocoValor}>
                          <ValorBloco bloco={bloco} valor={detalhe.respostas[bloco.id]} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.detalheSecao}>
                <p className={styles.semResposta}>Nenhum campo de formulário configurado para este QR Code.</p>
              </div>
            )}

          </div>
        )}
      </Modal>
    </div>
  );
};

export default RespostasQRCodePage;
