import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { enviarImagem } from '../../utils/anexos';
import {
  Plus, QrCode, Search, X, Hash, Trash2, Upload, Eye, Star,
  ChevronRight, ChevronDown, GripVertical, Image, CheckSquare,
  AlertTriangle, MessageCircle, Bell, FileText, BarChart3,
  UserCheck, Building2, Home, Settings, Copy, Download, Mail, Phone, Siren, CalendarPlus, Fingerprint, MapPin, Clock, LogIn, LogOut as LogOutIcon, ClipboardCheck, Hourglass, Play, Square, Flag, PenTool, RotateCcw, Camera, Wrench, Printer, Heart, List,
  Users, Inbox, FileDown, BellRing
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { qrcodes as qrcodesApi } from '../../services/api';
import { safeStorage } from '../../utils/storage';
import styles from './QRCode.module.css';
import ResponderFormulario, { BLOCOS_DISPONIVEIS } from './ResponderFormulario';
import type { BlocoTipo, BlocoConfig, QRCodeFormulario, Identificacao, RespostaBlocos, SolicitacaoQRCode } from './ResponderFormulario';

/* ═══════════════════════════════════════
   TIPOS
═══════════════════════════════════════ */

const FUNCOES_QR: { id: string; label: string; rota: string }[] = [
  { id: 'dashboard', label: 'Dashboard', rota: '/dashboard' },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', rota: '/quadro-atividades' },
  { id: 'ordens', label: 'Ordens de Serviço', rota: '/ordens-servico' },
  { id: 'checklists', label: 'Checklists', rota: '/checklists' },
  { id: 'vistorias', label: 'Vistorias', rota: '/vistorias' },
  { id: 'reportes', label: 'Reportes', rota: '/reportes' },
  { id: 'tarefas', label: 'Tarefas Agendadas', rota: '/tarefas' },
  { id: 'roteiros', label: 'Roteiro de Execução', rota: '/roteiros' },
  { id: 'materiais', label: 'Controle de Estoque', rota: '/materiais' },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', rota: '/leitor-qrcode' },
  { id: 'escalas', label: 'Escalas', rota: '/escalas' },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', rota: '/vencimentos' },
  { id: 'inspecoes', label: 'Inspeções', rota: '/inspecoes' },
  { id: 'comunicados', label: 'Comunicados / Avisos', rota: '/comunicados' },
  { id: 'moradores', label: 'Cadastro de Moradores', rota: '/moradores' },
  { id: 'condominios', label: 'Condomínios', rota: '/condominios' },
  { id: 'usuarios', label: 'Cadastro de Usuários', rota: '/usuarios' },
  { id: 'geolocalizacao', label: 'Geolocalização', rota: '/geolocalizacao' },
  { id: 'relatorios', label: 'Relatórios', rota: '/relatorios' },
  { id: 'configuracoes', label: 'Configurações', rota: '/configuracoes' },
];

/* ═══════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════ */

const BLOCOS_PADRAO = ['Bloco A', 'Bloco B', 'Bloco C', 'Bloco D', 'Torre 1', 'Torre 2', 'Funcionário', 'Prestador'];

const STORAGE_QR_FAVORITOS = 'manutencao-qr-favoritos';
const STORAGE_QR_SOLICITACOES_LAST_SEEN = 'qr-solicitacoes-last-seen';
const DATA_IMAGE_PATTERN = /^data:image\/(\w+);base64,/;

const BLOCO_OPCOES_PADRAO: Partial<Record<BlocoTipo, string[]>> = {
  checklist: ['Item 1'],
  status: ['Aberto', 'Em andamento', 'Resolvido'],
  prioridade: ['Baixa', 'Média', 'Alta', 'Urgente'],
  pergunta: [''],
  urgencia: ['Vazamento de água', 'Vazamento de gás', 'Vidro quebrado', 'Curto-circuito / Problema elétrico', 'Elevador parado', 'Incêndio', 'Inundação', 'Queda de estrutura', 'Outro'],
  agendar_servico: ['Limpeza pós-festa', 'Limpeza pós-mudança', 'Limpeza pós-obra', 'Lavagem de garagem', 'Higienização especial', 'Outro'],
  pesquisa_satisfacao: ['Qualidade da limpeza', 'Pontualidade da equipe', 'Cordialidade dos funcionários', 'Conservação das áreas comuns', 'Atendimento a solicitações'],
  controle_ponto: ['Entrada', 'Saída'],
  sla_tempo: ['Limpeza', 'Manutenção', 'Segurança', 'Jardinagem', 'Outros'],
  assinatura_digital: ['Serviço executado conforme solicitado'],
  ocorrencia: ['Elétrica', 'Hidráulica', 'Estrutural', 'Pintura', 'Limpeza', 'Jardinagem', 'Elevador', 'Portão / Cerca', 'Iluminação', 'Outro'],
  manutencao: ['Vazamento de água', 'Problema elétrico', 'Porta / Fechadura quebrada', 'Vidro trincado / quebrado', 'Piso danificado', 'Infiltração / Mofo', 'Elevador com defeito', 'Ar-condicionado', 'Pintura descascando', 'Entupimento', 'Iluminação queimada', 'Outro'],
};

function getBlocoOpcoesPadrao(tipo: BlocoTipo) {
  const opcoes = BLOCO_OPCOES_PADRAO[tipo];
  return opcoes ? [...opcoes] : undefined;
}

function normalizeSearchText(value: unknown): string {
  const source = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return Array.from(source.toLowerCase().normalize('NFD'))
    .filter(char => char < '\u0300' || char > '\u036f')
    .join('');
}

function getIdentificacaoTipoLabel(tipo?: string) {
  switch (tipo) {
    case 'morador':
      return 'Morador';
    case 'funcionario':
      return 'Funcionário';
    case 'prestador':
      return 'Prestador';
    default:
      return 'Não informado';
  }
}

function getImageFormat(dataUrl: string) {
  const match = DATA_IMAGE_PATTERN.exec(dataUrl);
  const format = match ? match[1].toUpperCase().replace('JPG', 'JPEG') : 'JPEG';
  return format === 'WEBP' ? 'JPEG' : format;
}

function buildQrPrintShell() {
  return `<!DOCTYPE html><html><head><title>QR Codes - Funções</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #222; }
      .titulo { text-align: center; font-size: 18px; font-weight: 700; padding: 14px 0 4px; }
      .subtitulo { text-align: center; font-size: 11px; color: #888; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 4px; }
      .item { border: 1.5px solid #ddd; border-radius: 8px; padding: 8px 4px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .item canvas, .item img { width: 90px !important; height: 90px !important; }
      .item span { font-size: 9px; font-weight: 600; text-align: center; line-height: 1.2; }
      .item small { font-size: 7px; color: #999; word-break: break-all; text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <div class="titulo">QR Codes — Acesso Rápido às Funções</div>
    <div class="subtitulo">Escaneie o QR Code para acessar a função diretamente no celular</div>
    <div class="grid" id="grid"></div>
    </body></html>`;
}




/* ═══════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════ */
const QRCodePage: React.FC = () => {
  const { usuario } = useAuth();
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const navigate = useNavigate();
  const role = usuario?.role || 'funcionario';
  const ehMasterOuAdmin = roleNivel >= 3;
  const ehSupervisor = role === 'supervisor';

  const [qrcodes, setQrcodes] = useState<QRCodeFormulario[]>([]);
  const [supervisorAutorizado, setSupervisorAutorizado] = useState(false);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Painel Solicitações ──
  const [showSolicitacoes, setShowSolicitacoes] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoQRCode[]>([]);
  const [novasSolicitacoes, setNovasSolicitacoes] = useState(0);
  const [piscar, setPiscar] = useState(false);
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState('');
  const [solVisualizando, setSolVisualizando] = useState<SolicitacaoQRCode | null>(null);

  const gerarProtocolo = (sol: SolicitacaoQRCode) => `PROT-${sol.id.slice(0, 8).toUpperCase()}`;

  const solicitacoesFiltradas = React.useMemo(() => {
    if (!buscaSolicitacoes.trim()) return solicitacoes;
    const q = normalizeSearchText(buscaSolicitacoes);
    return solicitacoes.filter(sol => {
      const id = sol.identificacao || {};
      const nome = normalizeSearchText(id.anonimo ? 'anonimo' : (id.nome || sol.respondidoPorNome || ''));
      const protocolo = gerarProtocolo(sol).toLowerCase();
      const qrNome = normalizeSearchText(sol.qrcodeNome || '');
      const bloco = normalizeSearchText(id.bloco || '');
      const unidade = normalizeSearchText(id.unidade || '');
      const tipo = normalizeSearchText(id.tipo || '');
      const respostasTexto = Object.values(sol.respostas || {}).map(normalizeSearchText).join(' ');
      return protocolo.includes(q) || nome.includes(q) || qrNome.includes(q) || bloco.includes(q) || unidade.includes(q) || tipo.includes(q) || respostasTexto.includes(q);
    });
  }, [solicitacoes, buscaSolicitacoes]);

  const carregarSolicitacoes = useCallback(async (qrList?: QRCodeFormulario[]) => {
    try {
      const resps: any[] = await qrcodesApi.listRespostas();
      const base = qrList || qrcodes;
      const mapped: SolicitacaoQRCode[] = resps.map((r: any) => {
        // api.ts aplica toCamel: qrcode_id → qrcodeId, qrcode_nome → qrcodeNome, etc.
        const qrId = r.qrcodeId || r.qrcode_id;
        const qrNome = r.qrcodeNome || r.qrcode_nome;
        const qrObj = base.find(q => q.id === qrId);
        return {
          id: r.id,
          qrcodeId: qrId,
          qrcodeNome: qrNome || qrObj?.nome || 'QR Code',
          blocos: qrObj?.blocos || [],
          identificacao: typeof r.identificacao === 'string' ? JSON.parse(r.identificacao) : (r.identificacao || {}),
          respostas: typeof r.respostas === 'string' ? JSON.parse(r.respostas) : (r.respostas || {}),
          respondidoPorNome: r.respondidoPorNome || r.respondido_por_nome || '',
          respondidoEm: r.respondidoEm || r.respondido_em,
          latitude: r.latitude,
          longitude: r.longitude,
          endereco: r.endereco,
        };
      });
      setSolicitacoes(mapped);
      const lastSeen = Number(safeStorage.getItem(STORAGE_QR_SOLICITACOES_LAST_SEEN) || '0');
      const novas = mapped.filter(r => new Date(r.respondidoEm).getTime() > lastSeen).length;
      setNovasSolicitacoes(novas);
      if (novas > 0) setPiscar(true);
    } catch { /* sem respostas ainda */ }
  }, [qrcodes]);

  const abrirSolicitacoes = () => {
    const abrindo = !showSolicitacoes;
    setShowSolicitacoes(abrindo);
    if (abrindo) {
      safeStorage.setItem(STORAGE_QR_SOLICITACOES_LAST_SEEN, Date.now().toString());
      setNovasSolicitacoes(0);
      setPiscar(false);
    }
  };

  // ── Gerar PDF profissional de uma solicitação ──
  const gerarPdfSolicitacao = useCallback(async (sol: SolicitacaoQRCode) => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = 210;
    const margin = 16;
    let y = 0;

    // ── Cabeçalho laranja ──
    pdf.setFillColor(230, 81, 0);
    pdf.rect(0, 0, W, 32, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SOLICITAÇÃO', margin, 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Manutenção X', margin, 20);
    // ID no canto direito
    pdf.setFontSize(8);
    pdf.text(`ID: ${sol.id?.slice(0, 8).toUpperCase()}`, W - margin, 13, { align: 'right' });
    pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, W - margin, 20, { align: 'right' });
    y = 40;

    // ── Título do QR Code ──
    pdf.setFillColor(255, 243, 224);
    pdf.rect(margin, y, W - margin * 2, 12, 'F');
    pdf.setDrawColor(230, 81, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, y, W - margin * 2, 12, 'S');
    pdf.setTextColor(180, 60, 0);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`QR Code: ${sol.qrcodeNome}`, margin + 4, y + 8);
    y += 20;

    // ── Seção: Identificação ──
    const drawSecao = (titulo: string, cor: [number, number, number]) => {
      pdf.setFillColor(...cor);
      pdf.rect(margin, y, W - margin * 2, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(titulo, margin + 3, y + 5.5);
      y += 12;
      pdf.setTextColor(40, 40, 40);
    };

    const drawCampo = (label: string, valor: string, x: number, largura: number) => {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(x, y, largura, 10, 'F');
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(x, y, largura, 10, 'S');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(120, 120, 120);
      pdf.text(label.toUpperCase(), x + 3, y + 4);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      const val = valor.length > 32 ? valor.slice(0, 32) + '...' : valor;
      pdf.text(val, x + 3, y + 8.5);
    };

    drawSecao('  IDENTIFICAÇÃO DO RESPONDENTE', [50, 50, 50]);
    const id = sol.identificacao || {};
    const nomePessoa = id.anonimo ? 'Anônimo' : (id.nome || sol.respondidoPorNome || 'Não informado');
    const meioCampo = (W - margin * 2) / 2;
    drawCampo('Respondente', nomePessoa, margin, meioCampo - 1);
    drawCampo('Tipo', getIdentificacaoTipoLabel(id.tipo), margin + meioCampo, meioCampo - 1);
    y += 13;
    drawCampo('Bloco', id.bloco || '—', margin, meioCampo - 1);
    drawCampo('Unidade', id.unidade || '—', margin + meioCampo, meioCampo - 1);
    y += 13;
    drawCampo('Data / Hora', new Date(sol.respondidoEm).toLocaleString('pt-BR'), margin, W - margin * 2);
    y += 13;

    // ── Localização (se houver) ──
    if (sol.endereco) {
      drawCampo('Localização', sol.endereco, margin, W - margin * 2);
      y += 13;
    }
    y += 4;

    // ── Seção: Respostas ──
    drawSecao('  RESPOSTAS DO FORMULÁRIO', [230, 81, 0]);

    const TIPO_LABELS: Record<string, string> = {
      titulo: 'Título', subtitulo: 'Sub-título', texto: 'Texto', descricao: 'Descrição',
      galeria: 'Galeria', checklist: 'Checklist', status: 'Status', prioridade: 'Prioridade',
      avaliacao_estrela: 'Avaliação Estrela', avaliacao_escala: 'Avaliação Escala',
      pergunta: 'Pergunta', aviso: 'Aviso', comunicado: 'Comunicado', feedback: 'Feedback',
      urgencia: 'Urgência', agendar_servico: 'Agendar Serviço', pesquisa_satisfacao: 'Pesquisa Satisfação',
      controle_ponto: 'Controle Ponto', sla_tempo: 'SLA', assinatura_digital: 'Assinatura',
      ocorrencia: 'Ocorrência', manutencao: 'Manutenção',
    };

    const formatarValorPdf = (bloco: any, valor: any): string => {
      if (valor === undefined || valor === null || valor === '') return 'Não respondido';
      if (bloco.tipo === 'avaliacao_estrela') return `${valor}/5 estrelas`;
      if (bloco.tipo === 'avaliacao_escala') return `${valor}/10`;
      if (bloco.tipo === 'checklist' && Array.isArray(valor)) {
        return (bloco.opcoes || []).map((op: string, i: number) => `${valor[i] ? '✓' : '○'} ${op}`).join('  |  ');
      }
      if (bloco.tipo === 'pergunta' && Array.isArray(valor)) {
        return (bloco.opcoes || []).map((p: string, i: number) => `${p}: ${valor[i] || '—'}`).join(' | ');
      }
      if (bloco.tipo === 'feedback' && typeof valor === 'object') return `WhatsApp: ${valor.whatsapp || '—'} | E-mail: ${valor.email || '—'}`;
      if (bloco.tipo === 'urgencia' && typeof valor === 'object') return `${valor.tipo || ''} — ${valor.descricao || ''}`;
      if ((bloco.tipo === 'ocorrencia' || bloco.tipo === 'manutencao') && typeof valor === 'object') {
        return `Tipo: ${valor.tipo || '—'} | Prioridade: ${valor.prioridade || '—'} | ${valor.descricao || ''}`;
      }
      if (bloco.tipo === 'agendar_servico' && typeof valor === 'object') return `${valor.tipo || ''} — ${valor.data || ''} ${valor.hora || ''}`;
      if (bloco.tipo === 'assinatura_digital' && typeof valor === 'object') return `Assinado por: ${valor.signatario || '—'}`;
      if (typeof valor === 'object') return JSON.stringify(valor).slice(0, 100);
      return String(valor);
    };

    const blocos: any[] = sol.blocos || [];
    blocos.forEach((bloco: any, idx: number) => {
      if (y > 260) { pdf.addPage(); y = 16; }
      const val = sol.respostas[bloco.id];
      const par = idx % 2 === 0;

      // ── Galeria de fotos ──
      if (bloco.tipo === 'galeria' && Array.isArray(val) && val.length > 0) {
        const fotoAltura = 36;
        const fotosNaLinha = 3;
        const fotoLarg = (W - margin * 2 - (fotosNaLinha - 1) * 3) / fotosNaLinha;
        const linhasNecessarias = Math.ceil(val.length / fotosNaLinha);
        const alturaBloco = 10 + linhasNecessarias * (fotoAltura + 3) + 4;
        if (y + alturaBloco > 272) { pdf.addPage(); y = 16; }
        pdf.setFillColor(par ? 255 : 250, par ? 255 : 250, par ? 255 : 250);
        pdf.rect(margin, y, W - margin * 2, alturaBloco, 'F');
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, y + alturaBloco, W - margin, y + alturaBloco);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(150, 80, 0);
        pdf.text(`${TIPO_LABELS[bloco.tipo] || bloco.tipo} — ${bloco.label}`, margin + 3, y + 4.5);
        let imgY = y + 8;
        val.forEach((foto: string, fi: number) => {
          try {
            const col = fi % fotosNaLinha;
            const row = Math.floor(fi / fotosNaLinha);
            const imgX = margin + col * (fotoLarg + 3);
            const imgYpos = imgY + row * (fotoAltura + 3);
            pdf.addImage(foto, getImageFormat(foto), imgX, imgYpos, fotoLarg, fotoAltura);
          } catch { /* ignora foto inválida */ }
        });
        y += alturaBloco + 2;
        return;
      }

      // ── Assinatura digital ──
      if (bloco.tipo === 'assinatura_digital' && val?.imagem) {
        const alturaBloco = 46;
        if (y + alturaBloco > 272) { pdf.addPage(); y = 16; }
        pdf.setFillColor(par ? 255 : 250, par ? 255 : 250, par ? 255 : 250);
        pdf.rect(margin, y, W - margin * 2, alturaBloco, 'F');
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, y + alturaBloco, W - margin, y + alturaBloco);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(150, 80, 0);
        pdf.text(`Assinatura — ${bloco.label}`, margin + 3, y + 4.5);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Assinado por: ${val.signatario || '—'}`, margin + 3, y + 10);
        try {
          pdf.addImage(val.imagem, 'PNG', margin + 3, y + 13, 60, 28);
        } catch { /* ignora assinatura inválida */ }
        y += alturaBloco + 2;
        return;
      }

      // ── Fotos em ocorrência / manutenção ──
      if ((bloco.tipo === 'ocorrencia' || bloco.tipo === 'manutencao') && val?.fotos?.length > 0) {
        const textoValor = formatarValorPdf(bloco, val);
        const fotoAltura = 32;
        const fotosNaLinha = 3;
        const fotoLarg = (W - margin * 2 - (fotosNaLinha - 1) * 3) / fotosNaLinha;
        const linhasNecessarias = Math.ceil(val.fotos.length / fotosNaLinha);
        const alturaBloco = 14 + linhasNecessarias * (fotoAltura + 3) + 4;
        if (y + alturaBloco > 272) { pdf.addPage(); y = 16; }
        pdf.setFillColor(par ? 255 : 250, par ? 255 : 250, par ? 255 : 250);
        pdf.rect(margin, y, W - margin * 2, alturaBloco, 'F');
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, y + alturaBloco, W - margin, y + alturaBloco);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(150, 80, 0);
        pdf.text(`${TIPO_LABELS[bloco.tipo] || bloco.tipo} — ${bloco.label}`, margin + 3, y + 4.5);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);
        const tl = pdf.splitTextToSize(textoValor, W - margin * 2 - 6);
        pdf.text(tl[0], margin + 3, y + 9.5);
        let imgY = y + 13;
        val.fotos.forEach((foto: string, fi: number) => {
          try {
            const col = fi % fotosNaLinha;
            const row = Math.floor(fi / fotosNaLinha);
            const imgX = margin + col * (fotoLarg + 3);
            pdf.addImage(foto, getImageFormat(foto), imgX, imgY + row * (fotoAltura + 3), fotoLarg, fotoAltura);
          } catch { /* ignora */ }
        });
        y += alturaBloco + 2;
        return;
      }

      // ── Blocos de texto normal ──
      pdf.setFillColor(par ? 255 : 250, par ? 255 : 250, par ? 255 : 250);
      pdf.rect(margin, y, W - margin * 2, 11, 'F');
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, y + 11, W - margin, y + 11);
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(150, 80, 0);
      pdf.text(`${TIPO_LABELS[bloco.tipo] || bloco.tipo} — ${bloco.label}`, margin + 3, y + 4.5);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      const valorStr = formatarValorPdf(bloco, val);
      const linhas = pdf.splitTextToSize(valorStr, W - margin * 2 - 6);
      pdf.text(linhas.length > 1 ? linhas[0] + '...' : valorStr, margin + 3, y + 9);
      y += 12;
    });

    if (blocos.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Nenhuma resposta registrada.', margin + 3, y + 8);
      y += 14;
    }

    // ── Rodapé ──
    const totalPags = (pdf as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
      pdf.setPage(p);
      const rodapeY = 287;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(0, rodapeY - 6, W, 10, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.line(0, rodapeY - 6, W, rodapeY - 6);
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(130, 130, 130);
      pdf.text('Manutenção X', margin, rodapeY);
      pdf.text(`Página ${p} / ${totalPags}`, W - margin, rodapeY, { align: 'right' });
    }

    const nomeArquivo = `solicitacao-${sol.qrcodeNome.split(/\s+/).join('-').toLowerCase()}-${sol.id?.slice(0, 6)}.pdf`;
    pdf.save(nomeArquivo);
  }, []);

  useEffect(() => {
    Promise.all([
      qrcodesApi.list().catch(() => []),
      qrcodesApi.getSupervisorPerm().catch(() => ({ autorizado: false })),
    ]).then(([qrs, perm]: any) => {
      const qrList = qrs.map((q: any) => ({
        id: q.id,
        nome: q.nome,
        descricao: q.descricao || '',
        logo: q.logo,
        blocos: typeof q.blocos === 'string' ? JSON.parse(q.blocos) : (q.blocos || []),
        dispensarIdentificacao: q.dispensarIdentificacao,
        blocosCadastrados: q.blocosCadastrados || [],
        criadoPor: q.criadoPor || 'Sistema',
        criadoEm: q.criadoEm ? new Date(q.criadoEm).getTime() : Date.now(),
        respostas: q.respostas || 0,
        ativo: q.ativo !== false,
      }));
      setQrcodes(qrList);
      setSupervisorAutorizado(perm.autorizado);
      carregarSolicitacoes(qrList);
    }).finally(() => setLoading(false));

    // Polling a cada 30 segundos para detectar novas solicitações
    const intervalo = setInterval(() => carregarSolicitacoes(), 30000);
    return () => clearInterval(intervalo);
  }, []);

  // Modal Criar QR Code
  const [showCriar, setShowCriar] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLogo, setFormLogo] = useState<string | null>(null);
  const [formBlocos, setFormBlocos] = useState<BlocoConfig[]>([]);
  const [formDispensarId, setFormDispensarId] = useState(false);
  const [formBlocosCad, setFormBlocosCad] = useState<string[]>(BLOCOS_PADRAO);
  const [novoBlocoNome, setNovoBlocoNome] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrFuncoesRef = useRef<HTMLDivElement>(null);
  const [showFuncoesQR, setShowFuncoesQR] = useState(false);
  const [toast, setToast] = useState<{ msg: string; cor: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Favoritos (persistência em localStorage)
  const [favoritos, setFavoritos] = useState<BlocoTipo[]>(() => {
    try {
      const value = safeStorage.getItem(STORAGE_QR_FAVORITOS);
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorito = useCallback((tipo: BlocoTipo) => {
    setFavoritos(prev => {
      const next = prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo];
      safeStorage.setItem(STORAGE_QR_FAVORITOS, JSON.stringify(next));
      return next;
    });
  }, []);

  const mostrarToast = useCallback((msg: string, cor: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, cor });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Modal Preview / Visualizar QR
  const [previewQR, setPreviewQR] = useState<QRCodeFormulario | null>(null);

  // Modal Responder QR Code (simula leitura)
  const [responderQR, setResponderQR] = useState<QRCodeFormulario | null>(null);

  // Permissão: supervisor pode criar?
  const podeCriarQR = ehMasterOuAdmin || (ehSupervisor && supervisorAutorizado);

  const imprimirQRFuncoes = useCallback(() => {
    const el = qrFuncoesRef.current;
    if (!el) return;
    const win = globalThis.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(buildQrPrintShell());
    win.document.close();
    const grid = win.document.getElementById('grid');
    if (grid) {
      el.querySelectorAll('[data-qr-item]').forEach(item => {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('canvas').forEach(c => {
          const img = win.document.createElement('img');
          try { img.src = (c as HTMLCanvasElement).toDataURL('image/png'); } catch { /* tainted */ }
          c.replaceWith(img);
        });
        grid.append(win.document.adoptNode(clone));
      });
    }
    setTimeout(() => { win.print(); }, 400);
  }, []);

  const toggleSupervisorPerm = async () => {
    const novo = !supervisorAutorizado;
    setSupervisorAutorizado(novo);
    try { await qrcodesApi.setSupervisorPerm(novo); } catch {
      setSupervisorAutorizado(!novo);
      alert('Erro ao salvar permissão. Tente novamente.');
    }
  };

  /* ── Filtro ── */
  const filtrados = useMemo(() => {
    if (!busca.trim()) return qrcodes;
    const termos = busca.toLowerCase().split(/\s+/);
    return qrcodes.filter(q => {
      const texto = `${q.nome} ${q.descricao} ${q.id}`.toLowerCase();
      return termos.every(t => texto.includes(t));
    });
  }, [qrcodes, busca]);

  /* ── Logo upload ── */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setFormLogo(await enviarImagem(file));
    } catch (err: any) {
      alert(err?.message || 'Não foi possível enviar a imagem.');
    }
  };

  /* ── Adicionar bloco ao formulário ── */
  const adicionarBloco = (tipo: BlocoTipo) => {
    const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === tipo);
    const novo: BlocoConfig = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      label: info?.label || tipo,
      obrigatorio: false,
      opcoes: getBlocoOpcoesPadrao(tipo),
      maxFotos: tipo === 'galeria' ? 5 : undefined,
      maxEstrelas: tipo === 'avaliacao_estrela' ? 5 : undefined,
      escalaMax: tipo === 'avaliacao_escala' ? 10 : undefined,
    };
    setFormBlocos(prev => [...prev, novo]);
    mostrarToast(`✓ s${info?.label || tipo}s adicionado`, info?.cor || '#4caf50');
  };

  const removerBloco = (id: string) => {
    setFormBlocos(prev => prev.filter(b => b.id !== id));
  };

  const atualizarBloco = (id: string, campo: string, valor: any) => {
    setFormBlocos(prev => prev.map(b => b.id === id ? { ...b, [campo]: valor } : b));
  };

  const adicionarOpcao = (blocoId: string) => {
    setFormBlocos(prev => prev.map(b =>
      b.id === blocoId ? { ...b, opcoes: [...(b.opcoes || []), ''] } : b
    ));
  };

  const atualizarOpcao = (blocoId: string, idx: number, valor: string) => {
    setFormBlocos(prev => prev.map(b =>
      b.id === blocoId ? { ...b, opcoes: b.opcoes?.map((o, i) => i === idx ? valor : o) } : b
    ));
  };

  const removerOpcao = (blocoId: string, idx: number) => {
    setFormBlocos(prev => prev.map(b =>
      b.id === blocoId ? { ...b, opcoes: b.opcoes?.filter((_, i) => i !== idx) } : b
    ));
  };

  /* ── Criar QR Code ── */
  const criarQRCode = async () => {
    if (!tentarAcao()) return;
    if (!formNome.trim()) { mostrarToast('Preencha o nome do formulário', '#d32f2f'); return; }
    if (formBlocos.length === 0) { mostrarToast('Adicione pelo menos um bloco', '#d32f2f'); return; }
    let novo: QRCodeFormulario;
    try {
      const created = await qrcodesApi.create({
        nome: formNome.trim(),
        descricao: formDesc.trim(),
        logo: formLogo,
        blocos: formBlocos,
        dispensarIdentificacao: formDispensarId,
        blocosCadastrados: formBlocosCad.filter(b => b.trim()),
      });
      novo = {
        id: created.id,
        nome: created.nome,
        descricao: created.descricao || '',
        logo: created.logo,
        blocos: typeof created.blocos === 'string' ? JSON.parse(created.blocos) : (created.blocos || []),
        dispensarIdentificacao: created.dispensarIdentificacao,
        blocosCadastrados: created.blocosCadastrados || [],
        criadoPor: usuario?.nome || 'Sistema',
        criadoEm: created.criadoEm ? new Date(created.criadoEm).getTime() : Date.now(),
        respostas: 0,
        ativo: true,
      };
    } catch {
      novo = {
        id: `qr-${Date.now()}`,
        nome: formNome.trim(),
        descricao: formDesc.trim(),
        logo: formLogo,
        blocos: formBlocos,
        dispensarIdentificacao: formDispensarId,
        blocosCadastrados: formBlocosCad.filter(b => b.trim()),
        criadoPor: usuario?.nome || 'Sistema',
        criadoEm: Date.now(),
        respostas: 0,
        ativo: true,
      };
    }
    setQrcodes(prev => [novo, ...prev]);
    resetForm();
    setShowCriar(false);
    mostrarToast(`✓ QR Code s${novo.nome}s criado!`, '#2e7d32');
  };

  const resetForm = () => {
    setFormNome(''); setFormDesc(''); setFormLogo(null);
    setFormBlocos([]); setFormDispensarId(false);
    setFormBlocosCad(BLOCOS_PADRAO); setNovoBlocoNome('');
  };

  const toggleAtivoQR = async (id: string) => {
    if (!tentarAcao()) return;
    const qr = qrcodes.find(q => q.id === id);
    if (!qr) return;
    try {
      await qrcodesApi.update(id, { ...qr, blocos: qr.blocos, ativo: !qr.ativo });
      setQrcodes(prev => prev.map(q => q.id === id ? { ...q, ativo: !q.ativo } : q));
    } catch {}
  };

  const excluirQR = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await qrcodesApi.remove(id);
      setQrcodes(prev => prev.filter(q => q.id !== id));
    } catch {}
  };

  /* ── Abrir responder ── */
  const abrirResponder = (qr: QRCodeFormulario) => {
    setResponderQR(qr);
  };

  const enviarRespostaQR = async (identificacao: Identificacao, respostas: RespostaBlocos) => {
    if (!responderQR) return;
    try {
      await qrcodesApi.addResposta({
        qrcodeId: responderQR.id,
        qrcodeNome: responderQR.nome,
        identificacao,
        respostas,
      });
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg === 'Sessão expirada' || msg.toLowerCase().includes('sess') || err?.status === 401) {
        throw new Error('Sua sessão expirou. Faça logout e login novamente para continuar.');
      }
      throw new Error(msg || 'Não foi possível salvar a resposta. Verifique sua conexão e tente novamente.');
    }
    setQrcodes(prev => prev.map(q => q.id === responderQR.id ? { ...q, respostas: q.respostas + 1 } : q));
    await carregarSolicitacoes();
  };

  /* ── Download QR code como imagem ── */
  const downloadQR = (qrId: string) => {
    const canvas = document.querySelector(`#qr-canvas-${qrId} canvas`) as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qrcode-${qrId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  /* ── Render bloco no builder ── */
  const renderBlocoBuilder = (bloco: BlocoConfig) => {
    const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === bloco.tipo);
    return (
      <div key={bloco.id} className={styles.blocoBuilder}>
        <div className={styles.blocoBuilderHeader}>
          <GripVertical size={16} className={styles.blocoGrip} />
          <div className={styles.blocoIcone} style={{ background: info?.cor + '18', color: info?.cor }}>
            {info?.icone}
          </div>
          <input
            className={styles.blocoLabelInput}
            value={bloco.label}
            onChange={e => atualizarBloco(bloco.id, 'label', e.target.value)}
            placeholder="Nome do campo"
          />
          <label className={styles.blocoObrigatorio}>
            <input type="checkbox" checked={bloco.obrigatorio} onChange={e => atualizarBloco(bloco.id, 'obrigatorio', e.target.checked)} />
            <span>Obrigatório</span>
          </label>
          <button className={styles.blocoRemover} onClick={() => removerBloco(bloco.id)}>
            <Trash2 size={14} />
          </button>
        </div>

        {/* Opções para checklist, status, prioridade, pergunta */}
        {bloco.opcoes && (
          <div className={styles.blocoOpcoes}>
            {bloco.opcoes.map((op, idx) => (
              <div key={`${bloco.id}-opcao-${op}-${idx}`} className={styles.opcaoRow}>
                <input
                  className={styles.opcaoInput}
                  value={op}
                  onChange={e => atualizarOpcao(bloco.id, idx, e.target.value)}
                  placeholder={bloco.tipo === 'pergunta' ? `Pergunta ${idx + 1}` : `Opção ${idx + 1}`}
                />
                {bloco.opcoes!.length > 1 && (
                  <button className={styles.opcaoRemover} onClick={() => removerOpcao(bloco.id, idx)}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button className={styles.opcaoAdd} onClick={() => adicionarOpcao(bloco.id)}>
              <Plus size={14} /> Adicionar {bloco.tipo === 'pergunta' ? 'Pergunta' : 'Opção'}
            </button>
          </div>
        )}

        {/* Config galeria */}
        {bloco.tipo === 'galeria' && (
          <div className={styles.blocoConfig}>
            <label htmlFor={`max-fotos-${bloco.id}`}>Máx. fotos:</label>
            <input id={`max-fotos-${bloco.id}`} type="number" min={1} max={20} value={bloco.maxFotos || 5} onChange={e => atualizarBloco(bloco.id, 'maxFotos', Number(e.target.value))} className={styles.configInput} />
          </div>
        )}
      </div>
    );
  };


  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  return (
    <div id="qrcode-content">
      <HowItWorks
        titulo="Criar QR Code"
        descricao="Monte formulário personalizados e gere QR Codes para moradores, funcionários e prestadores responderem."
        passos={[
          'Crie um formulário adicionando blocos: título, fotos, checklist, avaliações, etc.',
          'Opcionalmente importe a logo da empresa para aparecer no QR Code',
          'Defina se deseja dispensar a identificação do respondente',
          'Gere o QR Code e compartilhe — qualquer pessoa pode escanear e responder',
          'Acompanhe as respostas recebidas em cada QR Code',
        ]}
      />

      <PageHeader
        titulo="Criar QR Code"
        subtitulo={`${filtrados.length} formulários`}
        onCompartilhar={() => compartilharConteudo('QR Codes', 'Listagem de QR Codes')}
        onImprimir={() => imprimirElemento('qrcode-content')}
        onGerarPdf={() => gerarPdfDeElemento('qrcode-content', 'qrcodes')}
        acoes={
          podeCriarQR ? (
            <button className={styles.addBtn} onClick={() => { resetForm(); setShowCriar(true); }}>
              <Plus size={18} /> <span>Novo QR Code</span>
            </button>
          ) : ehSupervisor ? (
            <div className={styles.semPermissao}>
              <AlertTriangle size={16} />
              <span>Aguardando autorização do administrador</span>
            </div>
          ) : undefined
        }
      />

      {/* Controle de permissão do supervisor (visível só para admin/master) */}
      {ehMasterOuAdmin && (
        <div className={styles.permCard}>
          <div className={styles.permInfo}>
            <Settings size={18} />
            <div>
              <strong>Permissão do Supervisor</strong>
              <span>Autorizar supervisores a criar QR Codes</span>
            </div>
          </div>
          <button className={`${styles.permToggle} ${supervisorAutorizado ? styles.permToggleOn : ''}`} onClick={toggleSupervisorPerm}>
            <span className={styles.permToggleDot} />
            <span>{supervisorAutorizado ? 'Autorizado' : 'Bloqueado'}</span>
          </button>
        </div>
      )}

      {/* QR Codes das Funções */}
      {ehMasterOuAdmin && (
        <div className={styles.funcQrPanel}>
          <button className={styles.funcQrToggle} onClick={() => setShowFuncoesQR(v => !v)}>
            <div className={styles.funcQrToggleLeft}>
              <QrCode size={18} />
              <div>
                <strong>QR Codes das Funções</strong>
                <span>{FUNCOES_QR.length} funções disponíveis — escaneie para ir direto à página</span>
              </div>
            </div>
            <div className={styles.funcQrToggleRight}>
              {showFuncoesQR && (
                <button className={styles.funcQrPrintBtn} onClick={e => { e.stopPropagation(); imprimirQRFuncoes(); }}>
                  <Printer size={15} /> Imprimir A4
                </button>
              )}
              {showFuncoesQR ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </div>
          </button>
          {showFuncoesQR && (
            <div className={styles.funcQrGrid} ref={qrFuncoesRef}>
              {FUNCOES_QR.map(f => (
                <div key={f.id} className={styles.funcQrItem} data-qr-item>
                  <QRCodeCanvas value={`${globalThis.location.origin}${f.rota}`} size={90} level="M" marginSize={0} />
                  <span className={styles.funcQrLabel}>{f.label}</span>
                  <small className={styles.funcQrUrl}>{f.rota}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PAINEL SOLICITAÇÕES ═══ */}
      <div className={styles.solicitacoesPanel}>
        <button
          className={`${styles.solicitacoesHeader} ${piscar ? styles.solicitacoesPiscar : ''}`}
          onClick={abrirSolicitacoes}
        >
          <div className={styles.solicitacoesHeaderLeft}>
            {novasSolicitacoes > 0 ? <BellRing size={18} className={styles.solicitacoesBellIcon} /> : <Inbox size={18} />}
            <span className={styles.solicitacoesTitulo}>Solicitações dos Moradores e Funcionários</span>
            {novasSolicitacoes > 0 && (
              <span className={styles.solicitacoesNovaBadge}>{novasSolicitacoes} nova{novasSolicitacoes > 1 ? 's' : ''}</span>
            )}
            <span className={styles.solicitacoesTotalBadge}>{solicitacoes.length} total</span>
          </div>
          <div className={styles.solicitacoesHeaderRight}>
            <Users size={15} />
            <span className={styles.solicitacoesHeaderSub}>Clique para {showSolicitacoes ? 'fechar' : 'expandir'}</span>
            {showSolicitacoes ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
        </button>

        {showSolicitacoes && (
          <div className={styles.solicitacoesBody}>
            {/* Busca inteligente */}
            <div className={styles.solicitacoesBusca}>
              <Search size={15} className={styles.solicitacoesBuscaIcon} />
              <input
                className={styles.solicitacoesBuscaInput}
                placeholder="Buscar por protocolo, nome, bloco, unidade ou resposta..."
                value={buscaSolicitacoes}
                onChange={e => setBuscaSolicitacoes(e.target.value)}
              />
              {buscaSolicitacoes && (
                <button className={styles.solicitacoesBuscaLimpar} onClick={() => setBuscaSolicitacoes('')}><X size={13} /></button>
              )}
            </div>

            {solicitacoes.length === 0 ? (
              <div className={styles.solicitacoesVazio}>
                <Inbox size={36} strokeWidth={1.2} />
                <span>Nenhuma solicitação recebida ainda.</span>
                <small>As respostas dos QR Codes aparecerão aqui.</small>
              </div>
            ) : solicitacoesFiltradas.length === 0 ? (
              <div className={styles.solicitacoesVazio}>
                <Search size={28} strokeWidth={1.2} />
                <span>Nenhum resultado para "{buscaSolicitacoes}"</span>
                <small>Tente buscar por protocolo, nome ou texto da resposta.</small>
              </div>
            ) : (
              <div className={styles.solicitacoesList}>
                {solicitacoesFiltradas.map(sol => {
                  const id = sol.identificacao || {};
                  const nomePessoa = id.anonimo ? 'Anônimo' : (id.nome || sol.respondidoPorNome || 'Não identificado');
                  const tipoPessoa = getIdentificacaoTipoLabel(id.tipo);
                  const isNova = new Date(sol.respondidoEm).getTime() > Number(safeStorage.getItem(STORAGE_QR_SOLICITACOES_LAST_SEEN) || '0') + 1000;
                  const protocolo = gerarProtocolo(sol);
                  const resumo: string[] = [];
                  (sol.blocos || []).slice(0, 3).forEach((b: any) => {
                    const v = sol.respostas[b.id];
                    if (!v && v !== 0) return;
                    if (b.tipo === 'avaliacao_estrela') resumo.push(`${b.label}: ${v}/5 ★`);
                    else if (b.tipo === 'avaliacao_escala') resumo.push(`${b.label}: ${v}/10`);
                    else if (b.tipo === 'status' || b.tipo === 'prioridade') resumo.push(`${b.label}: ${v}`);
                    else if (typeof v === 'string' && v.length > 0) resumo.push(`${b.label}: ${v.slice(0, 40)}`);
                  });

                  return (
                    <div key={sol.id} className={`${styles.solicitacaoCard} ${isNova ? styles.solicitacaoCardNova : ''}`}>
                      <div className={styles.solicitacaoProtocolo}>
                        <Hash size={11} />
                        <span>{protocolo}</span>
                        <span className={styles.solicitacaoProtocoloSep}>|</span>
                        <span className={styles.solicitacaoProtocoloNome}>{nomePessoa}</span>
                        {isNova && <span className={styles.solicitacaoNovaBadge}>Nova</span>}
                      </div>

                      <div className={styles.solicitacaoCardHeader}>
                        <div className={styles.solicitacaoIdent}>
                          <div className={styles.solicitacaoAvatar}><Users size={15} /></div>
                          <div>
                            <strong>{nomePessoa}</strong>
                            <div className={styles.solicitacaoMeta}>
                              {tipoPessoa && <span className={styles.solicitacaoTipoTag}>{tipoPessoa}</span>}
                              {id.bloco && <span className={styles.solicitacaoLocal}><Building2 size={10} /> {id.bloco}{id.unidade ? ` · Unid. ${id.unidade}` : ''}</span>}
                            </div>
                          </div>
                        </div>
                        <div className={styles.solicitacaoInfo}>
                          <span className={styles.solicitacaoQrNome}><QrCode size={11} /> {sol.qrcodeNome}</span>
                          <span className={styles.solicitacaoData}><Clock size={11} /> {new Date(sol.respondidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {resumo.length > 0 && (
                        <div className={styles.solicitacaoResumo}>
                          {resumo.map(r => <span key={`${sol.id}-${r}`} className={styles.solicitacaoResumoItem}>{r}</span>)}
                        </div>
                      )}

                      {sol.endereco && (
                        <div className={styles.solicitacaoEndereco}><MapPin size={11} /> {sol.endereco.length > 80 ? sol.endereco.slice(0, 80) + '...' : sol.endereco}</div>
                      )}

                      <div className={styles.solicitacaoActions}>
                        <button
                          className={styles.solicitacaoBtnVisualizar}
                          onClick={() => setSolVisualizando(sol)}
                          title="Visualizar resposta completa"
                        >
                          <Eye size={14} /> Visualizar
                        </button>
                        <button
                          className={styles.solicitacaoBtnPdf}
                          onClick={() => gerarPdfSolicitacao(sol)}
                          title="Gerar PDF desta solicitação"
                        >
                          <FileDown size={14} /> Gerar PDF
                        </button>
                        {sol.latitude && sol.longitude && (
                          <a href={`https://www.google.com/maps?q=${sol.latitude},${sol.longitude}`} target="_blank" rel="noopener noreferrer" className={styles.solicitacaoBtnMapa}>
                            <MapPin size={13} /> Mapa
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MODAL VISUALIZAR RESPOSTA ═══ */}
      {solVisualizando && (() => {
        const sol = solVisualizando;
        const id = sol.identificacao || {};
        const nomePessoa = id.anonimo ? 'Anônimo' : (id.nome || sol.respondidoPorNome || 'Não identificado');
        const tipoPessoa = id.anonimo ? 'Anônimo' : getIdentificacaoTipoLabel(id.tipo);
        const TIPO_LABELS_MODAL: Record<string, string> = {
          titulo: 'Título', subtitulo: 'Sub-título', texto: 'Texto', descricao: 'Descrição',
          galeria: 'Galeria de Fotos', checklist: 'Checklist', status: 'Status', prioridade: 'Prioridade',
          avaliacao_estrela: 'Avaliação Estrela', avaliacao_escala: 'Avaliação Escala',
          pergunta: 'Pergunta', aviso: 'Aviso', comunicado: 'Comunicado', feedback: 'Feedback',
          urgencia: 'Urgência', agendar_servico: 'Agendar Serviço', pesquisa_satisfacao: 'Pesquisa de Satisfação',
          controle_ponto: 'Controle de Ponto', sla_tempo: 'SLA', assinatura_digital: 'Assinatura Digital',
          ocorrencia: 'Ocorrência', manutencao: 'Manutenção',
        };
        return (
          <div
            className={styles.solModalOverlay}
            onMouseDown={event => {
              if (event.target === event.currentTarget) {
                setSolVisualizando(null);
              }
            }}
          >
            <div
              className={styles.solModal}
              role="dialog"
              aria-modal="true"
              aria-label="Visualizar resposta"
            >
              <div className={styles.solModalHeader}>
                <div className={styles.solModalHeaderLeft}>
                  <Eye size={18} />
                  <div>
                    <strong>Visualizar Resposta</strong>
                    <span>{gerarProtocolo(sol)}</span>
                  </div>
                </div>
                <button className={styles.solModalFechar} onClick={() => setSolVisualizando(null)}><X size={18} /></button>
              </div>

              <div className={styles.solModalContent}>
                {/* Identificação */}
                <div className={styles.solModalSecao}>
                  <div className={styles.solModalSecaoTitulo}><Users size={13} /> Identificação</div>
                  <div className={styles.solModalGrid}>
                    <div className={styles.solModalCampo}><span>Respondente</span><strong>{nomePessoa}</strong></div>
                    <div className={styles.solModalCampo}><span>Tipo</span><strong>{tipoPessoa}</strong></div>
                    {id.bloco && <div className={styles.solModalCampo}><span>Bloco</span><strong>{id.bloco}</strong></div>}
                    {id.unidade && <div className={styles.solModalCampo}><span>Unidade</span><strong>{id.unidade}</strong></div>}
                    <div className={styles.solModalCampo}><span>QR Code</span><strong>{sol.qrcodeNome}</strong></div>
                    <div className={styles.solModalCampo}><span>Data / Hora</span><strong>{new Date(sol.respondidoEm).toLocaleString('pt-BR')}</strong></div>
                    {sol.endereco && <div className={`${styles.solModalCampo} ${styles.solModalCampoFull}`}><span>Localização</span><strong>{sol.endereco}</strong></div>}
                  </div>
                </div>

                {/* Respostas */}
                {(sol.blocos || []).length > 0 && (
                  <div className={styles.solModalSecao}>
                    <div className={styles.solModalSecaoTitulo}><List size={13} /> Respostas do Formulário</div>
                    <div className={styles.solModalRespostas}>
                      {(sol.blocos || []).map((bloco: any) => {
                        const val = sol.respostas[bloco.id];
                        const tipoLabel = TIPO_LABELS_MODAL[bloco.tipo] || bloco.tipo;

                        // Galeria de fotos
                        if (bloco.tipo === 'galeria') {
                          const fotos: string[] = Array.isArray(val) ? val : [];
                          return (
                            <div key={bloco.id} className={styles.solModalRespItem}>
                              <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                              {fotos.length > 0 ? (
                                <div className={styles.solModalFotoGrid}>
                                  {fotos.map((foto, fi) => (
                                    <button
                                      key={`${bloco.id}-${foto}`}
                                      type="button"
                                      className={styles.solModalFotoButton}
                                      onClick={() => globalThis.open(foto, '_blank', 'noopener,noreferrer')}
                                      title="Clique para ampliar"
                                    >
                                      <img src={foto} alt={`Foto ${fi + 1}`} className={styles.solModalFoto} />
                                    </button>
                                  ))}
                                </div>
                              ) : <span className={styles.solModalRespVazio}>Nenhuma foto anexada</span>}
                            </div>
                          );
                        }

                        // Assinatura digital
                        if (bloco.tipo === 'assinatura_digital') {
                          return (
                            <div key={bloco.id} className={styles.solModalRespItem}>
                              <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                              {val?.imagem ? (
                                <div className={styles.solModalAssinatura}>
                                  <img src={val.imagem} alt="Assinatura" className={styles.solModalAssinaturaImg} />
                                  <span>Assinado por: <strong>{val.signatario || '—'}</strong></span>
                                </div>
                              ) : <span className={styles.solModalRespVazio}>Não assinado</span>}
                            </div>
                          );
                        }

                        // Ocorrência / Manutenção com fotos
                        if ((bloco.tipo === 'ocorrencia' || bloco.tipo === 'manutencao') && val) {
                          const fotos: string[] = val.fotos || [];
                          return (
                            <div key={bloco.id} className={styles.solModalRespItem}>
                              <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                              <div className={styles.solModalRespTexto}>
                                {val.tipo && <div><strong>Tipo:</strong> {val.tipo}</div>}
                                {val.prioridade && <div><strong>Prioridade:</strong> {val.prioridade}</div>}
                                {val.descricao && <div><strong>Descrição:</strong> {val.descricao}</div>}
                              </div>
                              {fotos.length > 0 && (
                                <div className={styles.solModalFotoGrid}>
                                  {fotos.map((foto, fi) => (
                                    <button
                                      key={`${bloco.id}-${foto}`}
                                      type="button"
                                      className={styles.solModalFotoButton}
                                      onClick={() => globalThis.open(foto, '_blank', 'noopener,noreferrer')}
                                      title="Clique para ampliar"
                                    >
                                      <img src={foto} alt={`Foto ${fi + 1}`} className={styles.solModalFoto} />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Checklist
                        if (bloco.tipo === 'checklist' && Array.isArray(val)) {
                          return (
                            <div key={bloco.id} className={styles.solModalRespItem}>
                              <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                              <div className={styles.solModalChecklist}>
                                {(bloco.opcoes || []).map((op: string, i: number) => (
                                  <span key={`${bloco.id}-${op}`} className={`${styles.solModalCheckItem} ${val[i] ? styles.solModalCheckOn : ''}`}>
                                    {val[i] ? '✓' : '○'} {op}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // Avaliação estrela
                        if (bloco.tipo === 'avaliacao_estrela' && val != null) {
                          return (
                            <div key={bloco.id} className={styles.solModalRespItem}>
                              <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                              <div className={styles.solModalEstrelas}>
                                {Array.from({ length: bloco.maxEstrelas || 5 }, (_, i) => (
                                  <Star key={i} size={18} fill={i < val ? '#f59e0b' : 'none'} color={i < val ? '#f59e0b' : '#ccc'} />
                                ))}
                                <span>{val}/{bloco.maxEstrelas || 5}</span>
                              </div>
                            </div>
                          );
                        }

                        // Default: texto simples
                        let textoVal: string | null = null;
                        if (val != null) {
                          textoVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        }
                        return (
                          <div key={bloco.id} className={styles.solModalRespItem}>
                            <div className={styles.solModalRespLabel}><span className={styles.solModalRespTipo}>{tipoLabel}</span> {bloco.label}</div>
                            {textoVal ? <div className={styles.solModalRespTextoSimples}>{textoVal}</div> : <span className={styles.solModalRespVazio}>Não respondido</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.solModalFooter}>
                <button className={styles.solModalBtnPdf} onClick={() => { gerarPdfSolicitacao(sol); setSolVisualizando(null); }}>
                  <FileDown size={15} /> Gerar PDF
                </button>
                <button className={styles.solModalBtnFechar} onClick={() => setSolVisualizando(null)}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Busca */}
      <div className={styles.buscaArea}>
        <Search size={18} className={styles.buscaIcon} />
        <input className={styles.buscaInput} placeholder="Buscar QR Codes..." value={busca} onChange={e => setBusca(e.target.value)} />
        {busca && <button className={styles.buscaLimpar} onClick={() => setBusca('')}><X size={16} /></button>}
      </div>

      {/* Lista de QR Codes */}
      <div className={styles.list}>
        {filtrados.length === 0 ? (
          <div className={styles.vazio}>
            <QrCode size={44} strokeWidth={1.2} />
            <span>{qrcodes.length === 0 ? 'Nenhum QR Code criado ainda' : 'Nenhum resultado encontrado'}</span>
          </div>
        ) : filtrados.map(qr => (
          <Card key={qr.id} padding="md" hover>
            <div className={styles.qrCard}>
              <div className={styles.qrCardTop}>
                <div className={styles.qrCardInfo}>
                  <div className={styles.qrCardHeader}>
                    <span className={styles.qrId}><Hash size={12} />{qr.id}</span>
                    <StatusBadge texto={qr.ativo ? 'Ativo' : 'Inativo'} variante={qr.ativo ? 'sucesso' : 'neutro'} />
                  </div>
                  <h4 className={styles.qrNome}>{qr.nome}</h4>
                  {qr.descricao && <p className={styles.qrDesc}>{qr.descricao}</p>}
                  <div className={styles.qrMeta}>
                    <span>{qr.blocos.length} blocos</span>
                    <span>•</span>
                    <span>{qr.respostas} respostas</span>
                    <span>•</span>
                    <span>Por {qr.criadoPor}</span>
                  </div>
                  <div className={styles.qrTags}>
                    {qr.blocos.slice(0, 4).map(b => {
                      const info = BLOCOS_DISPONIVEIS.find(bd => bd.tipo === b.tipo);
                      return <span key={b.id} className={styles.qrTag} style={{ background: info?.cor + '15', color: info?.cor }}>{b.label}</span>;
                    })}
                    {qr.blocos.length > 4 && <span className={styles.qrTag}>+{qr.blocos.length - 4}</span>}
                  </div>
                </div>
                <div className={styles.qrCardPreview} id={`qr-canvas-${qr.id}`}>
                  <QRCodeCanvas
                    value={`${window.location.origin}/qrcode/responder/${qr.id}`}
                    size={110}
                    level="H"
                    imageSettings={qr.logo ? { src: qr.logo, height: 24, width: 24, excavate: true } : undefined}
                  />
                </div>
              </div>
              <div className={styles.qrCardActions}>
                <button className={styles.btnResponder} onClick={() => abrirResponder(qr)}>
                  <Eye size={14} /> Responder
                </button>
                <button className={styles.btnRespostas} onClick={() => navigate(`/respostas-qrcode?qr=${qr.id}`)}>
                  <List size={14} /> Ver Respostas {qr.respostas > 0 && <span className={styles.respostasBadge}>{qr.respostas}</span>}
                </button>
                <button className={styles.btnPreview} onClick={() => setPreviewQR(qr)}>
                  <QrCode size={14} /> Ver QR Code
                </button>
                <button className={styles.btnDownload} onClick={() => downloadQR(qr.id)}>
                  <Download size={14} /> Baixar
                </button>
                {podeCriarQR && (
                  <>
                    <button className={styles.btnToggle} onClick={() => toggleAtivoQR(qr.id)}>
                      {qr.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className={styles.btnExcluir} onClick={() => excluirQR(qr.id)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══ MODAL: Criar QR Code ═══ */}
      <Modal aberto={showCriar} onFechar={() => setShowCriar(false)} titulo="Criar QR Code" largura="lg">
        <div className={styles.criarForm}>
          {/* Informações básicas */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Informações</h4>
            <div className={styles.formGrid}>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Nome do Formulário *</label>
                <input className={styles.formInput} placeholder="Ex: Pesquisa de Satisfação" value={formNome} onChange={e => setFormNome(e.target.value)} />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Descrição</label>
                <input className={styles.formInput} placeholder="Descrição breve..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Logo da Empresa</h4>
            <div className={styles.logoArea}>
              {formLogo ? (
                <div className={styles.logoPreview}>
                  <img src={formLogo} alt="Logo" />
                  <button className={styles.logoRemover} onClick={() => setFormLogo(null)}><X size={14} /></button>
                </div>
              ) : (
                <button className={styles.logoUploadBtn} onClick={() => logoInputRef.current?.click()}>
                  <Upload size={20} />
                  <span>Importar Logo</span>
                  <small>Insira sua logo para personalizar o QR Code</small>
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Identificação */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Identificação do Respondente</h4>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={formDispensarId} onChange={e => setFormDispensarId(e.target.checked)} />
              <span>Dispensar identificação do usuário</span>
            </label>
            <p className={styles.formHint}>Se desmarcado, o respondente deverá se identificar (morador/funcionário/prestador, bloco, unidade) antes de acessar o formulário.</p>
          </div>

          {/* Blocos cadastrados */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Blocos do Condomínio</h4>
            <p className={styles.formHint} style={{ background: '#fff3e0', padding: '10px 14px', borderRadius: 'var(--raio-borda-sm)', border: '1px solid #ffe0b2', color: '#e65100' }}>
              <strong>Atenção:</strong> Só é necessário cadastrar os blocos caso exija a identificação do usuário. Se a identificação estiver dispensada, não precisa cadastrar os blocos.
            </p>
            <div className={styles.blocosTagList}>
              {formBlocosCad.map((b, i) => (
                <span key={i} className={styles.blocoTag}>
                  {b}
                  <button onClick={() => setFormBlocosCad(prev => prev.filter((_, j) => j !== i))}><X size={10} /></button>
                </span>
              ))}
              <div className={styles.blocosAddRow}>
                <input className={styles.formInputSm} placeholder="Novo bloco..." value={novoBlocoNome} onChange={e => setNovoBlocoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && novoBlocoNome.trim()) { setFormBlocosCad(prev => [...prev, novoBlocoNome.trim()]); setNovoBlocoNome(''); } }} />
                <button className={styles.blocosAddBtn} onClick={() => { if (novoBlocoNome.trim()) { setFormBlocosCad(prev => [...prev, novoBlocoNome.trim()]); setNovoBlocoNome(''); } }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Criar QR Code */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Criar QR Code</h4>
            <p className={styles.formHint}>Adicione os campos que deseja no formulário. O respondente preencherá nessa ordem.</p>

            {/* Favoritos */}
            {favoritos.length > 0 && (
              <div className={styles.favSection}>
                <h5 className={styles.favTitulo}><Heart size={14} /> Favoritos</h5>
                <div className={styles.favGrid}>
                  {favoritos.map(tipo => {
                    const bd = BLOCOS_DISPONIVEIS.find(b => b.tipo === tipo);
                    if (!bd) return null;
                    return (
                      <button key={bd.tipo} className={styles.blocoAddCard} onClick={() => adicionarBloco(bd.tipo)}>
                        <button
                          type="button"
                          className={`${styles.favBtn} ${styles.favBtnAtivo}`}
                          onClick={e => { e.stopPropagation(); toggleFavorito(bd.tipo); }}
                          title="Remover do favoritos"
                        >
                          <Heart size={12} />
                        </button>
                        <span className={styles.blocoAddIcon} style={{ background: bd.cor + '18', color: bd.cor }}>{bd.icone}</span>
                        <span>{bd.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.blocosGrid}>
              {BLOCOS_DISPONIVEIS.map(bd => (
                <button key={bd.tipo} className={styles.blocoAddCard} onClick={() => adicionarBloco(bd.tipo)}>
                  <button
                    type="button"
                    className={`${styles.favBtn} ${favoritos.includes(bd.tipo) ? styles.favBtnAtivo : ''}`}
                    onClick={e => { e.stopPropagation(); toggleFavorito(bd.tipo); }}
                    title={favoritos.includes(bd.tipo) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart size={12} />
                  </button>
                  <span className={styles.blocoAddIcon} style={{ background: bd.cor + '18', color: bd.cor }}>{bd.icone}</span>
                  <span>{bd.label}</span>
                </button>
              ))}
            </div>

            {formBlocos.length > 0 && (
              <div className={styles.blocosBuildList}>
                <h5 className={styles.blocosSubtitle}>{formBlocos.length} blocos adicionados</h5>
                {formBlocos.map(renderBlocoBuilder)}
              </div>
            )}
          </div>

          {/* Botão criar */}
          <button className={styles.formSubmit} onClick={criarQRCode} disabled={!formNome.trim() || formBlocos.length === 0}>
            <QrCode size={18} /> Gerar QR Code
          </button>
        </div>
      </Modal>

      {/* ═══ MODAL: Preview QR Code ═══ */}
      <Modal aberto={!!previewQR} onFechar={() => setPreviewQR(null)} titulo="QR Code" largura="sm">
        {previewQR && (
          <div className={styles.previewModal}>
            <div className={styles.previewQR}>
              <QRCodeCanvas
                value={`${window.location.origin}/qrcode/responder/${previewQR.id}`}
                size={240}
                level="H"
                imageSettings={previewQR.logo ? { src: previewQR.logo, height: 40, width: 40, excavate: true } : undefined}
              />
            </div>
            <h4 className={styles.previewNome}>{previewQR.nome}</h4>
            {previewQR.descricao && <p className={styles.previewDesc}>{previewQR.descricao}</p>}
            <div className={styles.previewUrl}>
              <code>{`${window.location.origin}/qrcode/responder/${previewQR.id}`}</code>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/qrcode/responder/${previewQR.id}`)}><Copy size={14} /></button>
            </div>
            <div className={styles.previewActions}>
              <button className={styles.btnResponder} onClick={() => { setPreviewQR(null); abrirResponder(previewQR); }}>
                <Eye size={14} /> Testar Resposta
              </button>
              <button className={styles.btnDownload} onClick={() => {
                const canvas = document.querySelector(`.${styles.previewQR} canvas`) as HTMLCanvasElement;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `qrcode-${previewQR.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}>
                <Download size={14} /> Baixar PNG
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ MODAL: Responder QR Code ═══ */}
      <Modal aberto={!!responderQR} onFechar={() => setResponderQR(null)} titulo={responderQR?.nome || 'Formulário'} largura="md">
        {responderQR && (
          <ResponderFormulario
            key={responderQR.id}
            formulario={responderQR}
            onEnviar={enviarRespostaQR}
            onFechar={() => setResponderQR(null)}
          />
        )}
      </Modal>
      {/* Toast de feedback */}
      {toast && (
        <div className={styles.toast} style={{ borderLeftColor: toast.cor }}>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default QRCodePage;
