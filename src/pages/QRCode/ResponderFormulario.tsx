import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Upload, Star, ChevronRight, Image, CheckSquare, AlertTriangle, MessageCircle, Bell, FileText, BarChart3, UserCheck, Building2, Home, Mail, Phone, Siren, CalendarPlus, Fingerprint, MapPin, Clock, LogIn, LogOut as LogOutIcon, ClipboardCheck, Hourglass, Play, Square, Flag, PenTool, RotateCcw, Camera, Wrench } from 'lucide-react';
import { qrcodes as qrcodesApi } from '../../services/api';
import { safeStorage } from '../../utils/storage';
import { enviarImagemPublica } from '../../utils/anexos';
import styles from './QRCode.module.css';

/* ═══════════════════════════════════════
   TIPOS
═══════════════════════════════════════ */
export type BlocoTipo =
  | 'titulo' | 'subtitulo' | 'texto' | 'galeria' | 'descricao'
  | 'checklist' | 'status' | 'prioridade' | 'avaliacao_estrela'
  | 'avaliacao_escala' | 'pergunta' | 'aviso' | 'comunicado' | 'feedback' | 'urgencia' | 'agendar_servico' | 'pesquisa_satisfacao' | 'controle_ponto' | 'sla_tempo' | 'assinatura_digital' | 'ocorrencia' | 'manutencao';

export interface BlocoConfig {
  id: string;
  tipo: BlocoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes?: string[]; // para checklist, status, prioridade, pergunta
  maxFotos?: number; // para galeria
  maxEstrelas?: number; // para avaliação estrela (1-5)
  escalaMax?: number; // para avaliação escala (0-10)
}

export interface QRCodeFormulario {
  id: string;
  nome: string;
  descricao: string;
  logo: string | null;
  blocos: BlocoConfig[];
  dispensarIdentificacao: boolean;
  blocosCadastrados: string[];
  criadoPor: string;
  criadoEm: number;
  respostas: number;
  ativo: boolean;
}

export interface Identificacao {
  tipo: 'morador' | 'funcionario' | 'prestador' | '';
  nome: string;
  bloco: string;
  unidade: string;
  anonimo: boolean;
}

export interface RespostaBlocos {
  [blocoId: string]: any;
}

export interface SolicitacaoQRCode {
  id: string;
  qrcodeId: string;
  qrcodeNome: string;
  blocos: BlocoConfig[];
  identificacao: Partial<Identificacao> & Record<string, any>;
  respostas: Record<string, any>;
  respondidoPorNome: string;
  respondidoEm: string;
  latitude?: number;
  longitude?: number;
  endereco?: string;
}

/* ═══════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════ */
export const BLOCOS_DISPONIVEIS: { tipo: BlocoTipo; label: string; icone: React.ReactNode; cor: string }[] = [
  { tipo: 'titulo', label: 'Título', icone: <FileText size={18} />, cor: '#1565c0' },
  { tipo: 'subtitulo', label: 'Sub-título', icone: <FileText size={18} />, cor: '#1976d2' },
  { tipo: 'texto', label: 'Texto', icone: <FileText size={18} />, cor: '#2196f3' },
  { tipo: 'galeria', label: 'Galeria de Fotos', icone: <Image size={18} />, cor: '#7b1fa2' },
  { tipo: 'descricao', label: 'Descrição', icone: <FileText size={18} />, cor: '#00838f' },
  { tipo: 'checklist', label: 'Checklist', icone: <CheckSquare size={18} />, cor: '#2e7d32' },
  { tipo: 'status', label: 'Status', icone: <BarChart3 size={18} />, cor: '#f57c00' },
  { tipo: 'prioridade', label: 'Prioridade', icone: <AlertTriangle size={18} />, cor: '#d32f2f' },
  { tipo: 'avaliacao_estrela', label: 'Avaliação Estrela (1-5)', icone: <Star size={18} />, cor: '#fbc02d' },
  { tipo: 'avaliacao_escala', label: 'Avaliação Escala (0-10)', icone: <BarChart3 size={18} />, cor: '#e65100' },
  { tipo: 'pergunta', label: 'Perguntas e Respostas', icone: <MessageCircle size={18} />, cor: '#5c6bc0' },
  { tipo: 'aviso', label: 'Avisos', icone: <AlertTriangle size={18} />, cor: '#ff6f00' },
  { tipo: 'comunicado', label: 'Comunicados', icone: <Bell size={18} />, cor: '#00695c' },
  { tipo: 'feedback', label: 'Feedback', icone: <Mail size={18} />, cor: '#0277bd' },
  { tipo: 'urgencia', label: 'Reportar Urgências', icone: <Siren size={18} />, cor: '#b71c1c' },
  { tipo: 'agendar_servico', label: 'Agendar Serviço Extra', icone: <CalendarPlus size={18} />, cor: '#4a148c' },
  { tipo: 'pesquisa_satisfacao', label: 'Pesquisa de Satisfação', icone: <ClipboardCheck size={18} />, cor: '#00695c' },
  { tipo: 'controle_ponto', label: 'Controle de Ponto', icone: <Fingerprint size={18} />, cor: '#1565c0' },
  { tipo: 'sla_tempo', label: 'SLA — Tempo de Resposta', icone: <Hourglass size={18} />, cor: '#e65100' },
  { tipo: 'assinatura_digital', label: 'Assinatura Digital', icone: <PenTool size={18} />, cor: '#4527a0' },
  { tipo: 'ocorrencia', label: 'Informar Ocorrência', icone: <Camera size={18} />, cor: '#c62828' },
  { tipo: 'manutencao', label: 'Problema de Manutenção', icone: <Wrench size={18} />, cor: '#e65100' },
];

const STORAGE_PONTO_ATIVO = 'manutencao-ponto-ativo';

interface RegistroPonto {
  funcionario: { nome: string; email: string; cargo?: string; perfil: string };
  tipo: 'entrada' | 'saida';
  dataHora: string;
  geolocalizacao: { latitude: number; longitude: number } | null;
  endereco: string | null;
  permanencia?: string;
}



function formatarDuracao(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

const PERFIL_LABELS: Record<string, string> = { master: 'Master', administrador: 'Administrador', supervisor: 'Supervisor', funcionario: 'Funcionário' };

/* ── Componente Controle de Ponto ── */
const ControlePontoBloco: React.FC<{
  blocoId: string;
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, valor, setRespostas }) => {
  const { usuario } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [pontoAtivo, setPontoAtivo] = useState<{ entrada: string; lat?: number; lon?: number } | null>(() => {
    try {
      const value = safeStorage.getItem(STORAGE_PONTO_ATIVO);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  });
  const [timer, setTimer] = useState('00:00:00');
  const [geo, setGeo] = useState<{ lat: number; lon: number; endereco: string | null } | null>(null);
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  useEffect(() => {
    qrcodesApi.listPonto().then((data: any[]) => {
      setRegistros(data.map((r: any) => ({
        funcionario: { nome: r.funcionarioNome, email: r.funcionarioEmail, cargo: r.funcionarioCargo, perfil: '' },
        tipo: r.tipo,
        dataHora: r.dataHora,
        geolocalizacao: r.latitude ? { latitude: r.latitude, longitude: r.longitude } : null,
        endereco: r.endereco,
        permanencia: r.permanencia,
      })));
    }).catch(() => {});
  }, []);

  // Timer
  useEffect(() => {
    if (!pontoAtivo) { setTimer('00:00:00'); return; }
    const atualizar = () => {
      const diff = Date.now() - new Date(pontoAtivo.entrada).getTime();
      setTimer(formatarDuracao(diff));
    };
    atualizar();
    timerRef.current = globalThis.setInterval(atualizar, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pontoAtivo]);

  const capturarGeo = useCallback(async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      );
      let endereco: string | null = null;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (resp.ok) { const d = await resp.json(); endereco = d.display_name || null; }
      } catch {}
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, endereco };
    } catch { return null; }
  }, []);

  const registrarEntrada = async () => {
    setCarregando(true);
    const geoData = await capturarGeo();
    setGeo(geoData);
    const agora = new Date().toISOString();
    const ativo = { entrada: agora, lat: geoData?.lat, lon: geoData?.lon };
    setPontoAtivo(ativo);
    safeStorage.setItem(STORAGE_PONTO_ATIVO, JSON.stringify(ativo));

    const reg: RegistroPonto = {
      funcionario: {
        nome: usuario?.nome || 'Desconhecido',
        email: usuario?.email || '',
        cargo: usuario?.cargo,
        perfil: PERFIL_LABELS[usuario?.role || 'funcionario'] || '',
      },
      tipo: 'entrada',
      dataHora: agora,
      geolocalizacao: geoData ? { latitude: geoData.lat, longitude: geoData.lon } : null,
      endereco: geoData?.endereco || null,
    };
    try {
      await qrcodesApi.addPonto({
        tipo: 'entrada',
        funcionarioNome: reg.funcionario.nome,
        funcionarioEmail: reg.funcionario.email,
        funcionarioCargo: reg.funcionario.cargo,
        latitude: geoData?.lat,
        longitude: geoData?.lon,
        endereco: geoData?.endereco,
      });
    } catch {}
    setRegistros(prev => [reg, ...prev]);
    setRespostas(prev => ({ ...prev, [blocoId]: { ...reg, tipo: 'entrada' } }));
    setCarregando(false);
  };

  const registrarSaida = async () => {
    setCarregando(true);
    const geoData = await capturarGeo();
    setGeo(geoData);
    const agora = new Date().toISOString();
    const permanencia = pontoAtivo ? formatarDuracao(Date.now() - new Date(pontoAtivo.entrada).getTime()) : '—';

    const reg: RegistroPonto = {
      funcionario: {
        nome: usuario?.nome || 'Desconhecido',
        email: usuario?.email || '',
        cargo: usuario?.cargo,
        perfil: PERFIL_LABELS[usuario?.role || 'funcionario'] || '',
      },
      tipo: 'saida',
      dataHora: agora,
      geolocalizacao: geoData ? { latitude: geoData.lat, longitude: geoData.lon } : null,
      endereco: geoData?.endereco || null,
      permanencia,
    };
    try {
      await qrcodesApi.addPonto({
        tipo: 'saida',
        funcionarioNome: reg.funcionario.nome,
        funcionarioEmail: reg.funcionario.email,
        funcionarioCargo: reg.funcionario.cargo,
        latitude: geoData?.lat,
        longitude: geoData?.lon,
        endereco: geoData?.endereco,
        permanencia,
      });
    } catch {}
    setRegistros(prev => [reg, ...prev]);
    setRespostas(prev => ({ ...prev, [blocoId]: { ...reg, tipo: 'saida', permanencia } }));
    setPontoAtivo(null);
    safeStorage.removeItem(STORAGE_PONTO_ATIVO);
    setCarregando(false);
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={styles.pontoFields}>
      <div className={styles.pontoBanner}>
        <Fingerprint size={20} />
        <span>Registre entrada ou saída — o sistema captura localização e tempo automaticamente</span>
      </div>

      {/* Dados do funcionário */}
      <div className={styles.pontoDadosFuncionario}>
        <UserCheck size={16} />
        <div>
          <strong>{usuario?.nome || 'Funcionário'}</strong>
          <span>{usuario?.email}{usuario?.cargo ? ` · ${usuario.cargo}` : ''} · {PERFIL_LABELS[usuario?.role || 'funcionario']}</span>
        </div>
      </div>

      {/* Timer */}
      {pontoAtivo && (
        <div className={styles.pontoTimer}>
          <Clock size={18} />
          <span className={styles.pontoTimerValor}>{timer}</span>
          <span className={styles.pontoTimerLabel}>em serviço</span>
        </div>
      )}

      {/* Botões */}
      <div className={styles.pontoBotoes}>
        <button
          className={`${styles.pontoBtnEntrada} ${pontoAtivo ? styles.pontoBtnDesabilitado : ''}`}
          onClick={registrarEntrada}
          disabled={!!pontoAtivo || carregando}
        >
          <LogIn size={18} />
          {carregando && !pontoAtivo ? 'Registrando...' : 'Registrar Entrada'}
        </button>
        <button
          className={`${styles.pontoBtnSaida} ${pontoAtivo ? '' : styles.pontoBtnDesabilitado}`}
          onClick={registrarSaida}
          disabled={!pontoAtivo || carregando}
        >
          <LogOutIcon size={18} />
          {carregando && pontoAtivo ? 'Registrando...' : 'Registrar Saída'}
        </button>
      </div>

      {/* Localização atual */}
      {geo && (
        <div className={styles.pontoGeo}>
          <MapPin size={14} />
          <span>{geo.endereco || `${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}`}</span>
        </div>
      )}

      {/* Histórico recente */}
      {registros.length > 0 && (
        <div className={styles.pontoHistorico}>
          <h5>Registros Recentes</h5>
          {registros.slice(0, 6).map((r) => (
            <div key={`${r.tipo}-${r.dataHora}-${r.funcionario.email}`} className={`${styles.pontoRegistro} ${r.tipo === 'entrada' ? styles.pontoRegEntrada : styles.pontoRegSaida}`}>
              <div className={styles.pontoRegIcone}>
                {r.tipo === 'entrada' ? <LogIn size={14} /> : <LogOutIcon size={14} />}
              </div>
              <div className={styles.pontoRegInfo}>
                <strong>{r.tipo === 'entrada' ? 'Entrada' : 'Saída'}</strong>
                <span>{r.funcionario.nome} · {formatarDataHora(r.dataHora)}</span>
                {r.endereco && <span className={styles.pontoRegEndereco}><MapPin size={10} /> {r.endereco.length > 60 ? r.endereco.slice(0, 60) + '...' : r.endereco}</span>}
                {r.permanencia && <span className={styles.pontoRegPermanencia}><Clock size={10} /> Permanência: {r.permanencia}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   SLA — TEMPO DE RESPOSTA
═══════════════════════════════════════ */
interface SlaRegistro {
  id: string;
  blocoId: string;
  categoria: string;
  descricao: string;
  abertura: string;
  inicioAtendimento?: string;
  encerramento?: string;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
}

const formatarTempoSla = (ms: number): string => {
  const seg = Math.floor(ms / 1000);
  const min = Math.floor(seg / 60);
  const hrs = Math.floor(min / 60);
  const dias = Math.floor(hrs / 24);
  if (dias > 0) return `${dias}d ${hrs % 24}h ${min % 60}m`;
  if (hrs > 0) return `${hrs}h ${min % 60}m ${seg % 60}s`;
  if (min > 0) return `${min}m ${seg % 60}s`;
  return `${seg}s`;
};

const SlaTempoBloco: React.FC<{
  blocoId: string;
  bloco: { opcoes?: string[] };
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, bloco, valor, setRespostas }) => {
  const [registros, setRegistros] = useState<SlaRegistro[]>([]);
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    qrcodesApi.listSla().then((data: any[]) => {
      setRegistros(data.filter((r: any) => r.blocoId === blocoId).slice(-10));
    }).catch(() => {});
  }, [blocoId]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const abrirChamado = async () => {
    if (!categoria) return;
    try {
      const novo = await qrcodesApi.createSla({ blocoId, categoria, descricao, status: 'aberto' });
      const updated = [novo, ...registros].slice(-10);
      setRegistros(updated);
      setCategoria('');
      setDescricao('');
      setRespostas(prev => ({ ...prev, [blocoId]: updated }));
    } catch {}
  };

  const mudarStatus = async (id: string, novoStatus: 'em_atendimento' | 'resolvido') => {
    try {
      const updated = await qrcodesApi.updateSla(id, novoStatus);
      setRegistros(prev => prev.map(r => r.id === id ? {
        ...r,
        status: novoStatus,
        inicioAtendimento: novoStatus === 'em_atendimento' ? (updated.inicioAtendimento || new Date().toISOString()) : r.inicioAtendimento,
        encerramento: novoStatus === 'resolvido' ? (updated.encerramento || new Date().toISOString()) : r.encerramento,
      } : r));
      setRespostas(prev => ({ ...prev, [blocoId]: registros }));
    } catch {}
  };

  const tempoDecorrido = (desde: string): string => formatarTempoSla(agora - new Date(desde).getTime());

  const statusLabel: Record<string, string> = { aberto: 'Aberto', em_atendimento: 'Em Atendimento', resolvido: 'Resolvido' };
  const statusCor: Record<string, string> = { aberto: '#e53935', em_atendimento: '#fb8c00', resolvido: '#43a047' };

  return (
    <div className={styles.slaFields}>
      <div className={styles.slaBanner}>
        <Hourglass size={18} />
        <span>SLA — Tempo de Resposta</span>
      </div>

      <div className={styles.slaNovoChamado}>
        <label className={styles.slaLabel} htmlFor={`sla-categoria-${blocoId}`}>Categoria</label>
        <div className={styles.slaOpcoes}>
          {(bloco.opcoes || []).map(op => (
            <button
              key={op}
              type="button"
              className={categoria === op ? styles.slaItemAtivo : styles.slaItem}
              onClick={() => setCategoria(op)}
            >
              {op}
            </button>
          ))}
        </div>

        <label className={styles.slaLabel} htmlFor={`sla-descricao-${blocoId}`}>Descrição da ocorrência</label>
        <textarea
          id={`sla-descricao-${blocoId}`}
          className={styles.slaTextarea}
          rows={3}
          placeholder="Descreva brevemente a ocorrência..."
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
        />

        <button type="button" className={styles.slaBtnAbrir} onClick={abrirChamado} disabled={!categoria}>
          <Flag size={16} /> Abrir Chamado
        </button>
      </div>

      {registros.length > 0 && (
        <div className={styles.slaHistorico}>
          <h4 className={styles.slaHistoricoTitulo}>Chamados Recentes</h4>
          {registros.slice().reverse().map(reg => (
            <div key={reg.id} className={styles.slaRegistro}>
              <div className={styles.slaRegHeader}>
                <span className={styles.slaRegCategoria}>{reg.categoria}</span>
                <span className={styles.slaRegStatus} style={{ background: statusCor[reg.status] }}>
                  {statusLabel[reg.status]}
                </span>
              </div>
              {reg.descricao && <p className={styles.slaRegDescricao}>{reg.descricao}</p>}
              <div className={styles.slaRegTempos}>
                <div className={styles.slaRegTempo}>
                  <Clock size={14} />
                  <span>Aberto: {new Date(reg.abertura).toLocaleString('pt-BR')}</span>
                </div>
                {reg.status === 'aberto' && (
                  <div className={styles.slaRegTimer}>
                    <Hourglass size={14} className={styles.slaTimerPulse} />
                    <span>Aguardando há <strong>{tempoDecorrido(reg.abertura)}</strong></span>
                  </div>
                )}
                {reg.inicioAtendimento && (
                  <div className={styles.slaRegTempo}>
                    <Play size={14} />
                    <span>Atendimento: {new Date(reg.inicioAtendimento).toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {reg.status === 'em_atendimento' && reg.inicioAtendimento && (
                  <div className={styles.slaRegTimer}>
                    <Hourglass size={14} className={styles.slaTimerPulse} />
                    <span>Em atendimento há <strong>{tempoDecorrido(reg.inicioAtendimento)}</strong></span>
                  </div>
                )}
                {reg.encerramento && (
                  <div className={styles.slaRegTempo}>
                    <Square size={14} />
                    <span>Encerrado: {new Date(reg.encerramento).toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {reg.encerramento && (
                  <div className={styles.slaRegTempoTotal}>
                    Tempo total: <strong>{formatarTempoSla(new Date(reg.encerramento).getTime() - new Date(reg.abertura).getTime())}</strong>
                  </div>
                )}
              </div>
              <div className={styles.slaRegAcoes}>
                {reg.status === 'aberto' && (
                  <button type="button" className={styles.slaBtnAtender} onClick={() => mudarStatus(reg.id, 'em_atendimento')}>
                    <Play size={14} /> Iniciar Atendimento
                  </button>
                )}
                {reg.status === 'em_atendimento' && (
                  <button type="button" className={styles.slaBtnResolver} onClick={() => mudarStatus(reg.id, 'resolvido')}>
                    <Square size={14} /> Marcar Resolvido
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   ASSINATURA DIGITAL
═══════════════════════════════════════ */
const AssinaturaDigitalBloco: React.FC<{
  blocoId: string;
  bloco: { opcoes?: string[] };
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, bloco, valor, setRespostas }) => {
  const { usuario } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [concordo, setConcordo] = useState(false);
  const [dataHora, setDataHora] = useState('');

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { willReadFrequently: true });
  }, []);

  const limparCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // linha guia
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    setAssinado(false);
    setConfirmado(false);
    setRespostas(prev => ({ ...prev, [blocoId]: undefined }));
  }, [blocoId, getCtx, setRespostas]);

  useEffect(() => {
    limparCanvas();
  }, [limparCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const iniciarDesenho = (e: React.MouseEvent | React.TouchEvent) => {
    if (confirmado) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
    setAssinado(true);
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    if (!desenhando || confirmado) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const pararDesenho = () => setDesenhando(false);

  const confirmarAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas || !assinado || !concordo) return;
    const agora = new Date();
    setDataHora(agora.toLocaleString('pt-BR'));
    const imgData = canvas.toDataURL('image/png');
    setConfirmado(true);
    setRespostas(prev => ({
      ...prev,
      [blocoId]: {
        imagem: imgData,
        signatario: usuario?.nome || 'Não identificado',
        email: usuario?.email || '',
        dataHora: agora.toISOString(),
        termoAceito: (bloco.opcoes || ['Serviço executado conforme solicitado'])[0],
      },
    }));
  };

  const termoTexto = (bloco.opcoes || ['Serviço executado conforme solicitado'])[0];

  return (
    <div className={styles.assinaturaFields}>
      <div className={styles.assinaturaBanner}>
        <PenTool size={18} />
        <span>Assinatura Digital</span>
      </div>

      <div className={styles.assinaturaInfo}>
        <div className={styles.assinaturaInfoItem}>
          <UserCheck size={14} />
          <span>{usuario?.nome || 'Não identificado'}</span>
        </div>
        {usuario?.email && (
          <div className={styles.assinaturaInfoItem}>
            <Mail size={14} />
            <span>{usuario.email}</span>
          </div>
        )}
        <div className={styles.assinaturaInfoItem}>
          <Clock size={14} />
          <span>{dataHora || new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <div className={styles.assinaturaCanvasWrapper}>
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          className={`${styles.assinaturaCanvas} ${confirmado ? styles.assinaturaCanvasConfirmado : ''}`}
          onMouseDown={iniciarDesenho}
          onMouseMove={desenhar}
          onMouseUp={pararDesenho}
          onMouseLeave={pararDesenho}
          onTouchStart={iniciarDesenho}
          onTouchMove={desenhar}
          onTouchEnd={pararDesenho}
        />
        {!confirmado && (
          <button type="button" className={styles.assinaturaBtnLimpar} onClick={limparCanvas} title="Limpar assinatura">
            <RotateCcw size={16} />
          </button>
        )}
        {!assinado && !confirmado && (
          <span className={styles.assinaturaPlaceholder}>Assine aqui</span>
        )}
      </div>

      <label className={styles.assinaturaCheckbox}>
        <input type="checkbox" checked={concordo} onChange={e => setConcordo(e.target.checked)} disabled={confirmado} />
        <span>{termoTexto}</span>
      </label>

      {confirmado ? (
        <div className={styles.assinaturaConfirmada}>
          <CheckSquare size={18} />
          <div>
            <strong>Assinatura registrada</strong>
            <span>por {usuario?.nome || 'Não identificado'} em {dataHora}</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.assinaturaBtnConfirmar}
          onClick={confirmarAssinatura}
          disabled={!assinado || !concordo}
        >
          <PenTool size={16} /> Confirmar Assinatura
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   FORMULÁRIO DE RESPOSTA
   (usado no modal interno e na página pública /qrcode/responder/:id)
═══════════════════════════════════════ */
interface ResponderFormularioProps {
  formulario: QRCodeFormulario;
  onEnviar: (identificacao: Identificacao, respostas: RespostaBlocos) => Promise<void>;
  onFechar?: () => void;
}

const ResponderFormulario: React.FC<ResponderFormularioProps> = ({ formulario, onEnviar, onFechar }) => {
  const { usuario } = useAuth();
  const [etapaResposta, setEtapaResposta] = useState<'identificacao' | 'formulario' | 'enviado'>(formulario.dispensarIdentificacao ? 'formulario' : 'identificacao');
  const [identificacao, setIdentificacao] = useState<Identificacao>({ tipo: '', nome: '', bloco: '', unidade: '', anonimo: false });
  const [respostas, setRespostas] = useState<RespostaBlocos>({});
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const avancarIdentificacao = () => {
    if (!identificacao.anonimo && (!identificacao.tipo || !identificacao.nome || !identificacao.bloco || !identificacao.unidade)) return;
    setEtapaResposta('formulario');
  };

  const enviarRespostas = async () => {
    setEnviandoResposta(true);
    setErroEnvio(null);
    try {
      await onEnviar(identificacao, respostas);
      setEtapaResposta('enviado');
    } catch (err: any) {
      setErroEnvio(err?.message || 'Não foi possível salvar a resposta. Verifique sua conexão e tente novamente.');
    } finally {
      setEnviandoResposta(false);
    }
  };

  const renderBlocoResposta = (bloco: BlocoConfig) => {
    const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === bloco.tipo);
    const valor = respostas[bloco.id];

    return (
      <div key={bloco.id} className={styles.blocoResposta}>
        <div className={styles.blocoRespostaHeader}>
          <span className={styles.blocoRespostaIcone} style={{ color: info?.cor }}>{info?.icone}</span>
          <span className={styles.blocoRespostaLabel}>{bloco.label}</span>
          {bloco.obrigatorio && <span className={styles.blocoReq}>*</span>}
        </div>

        {(bloco.tipo === 'titulo' || bloco.tipo === 'subtitulo' || bloco.tipo === 'texto' || bloco.tipo === 'descricao') && (
          <textarea
            className={styles.respostaTextarea}
            placeholder={`Digite ${bloco.label.toLowerCase()}...`}
            value={valor || ''}
            onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: e.target.value }))}
            rows={bloco.tipo === 'titulo' || bloco.tipo === 'subtitulo' ? 1 : 3}
          />
        )}

        {bloco.tipo === 'galeria' && (
          <div className={styles.respostaGaleria}>
            <p className={styles.respostaHint}>Anexe até {bloco.maxFotos || 5} fotos</p>
            {/* Previews das fotos */}
            {(valor || []).length > 0 && (
              <div className={styles.galeriaPreviewGrid}>
                {(valor as string[]).map((foto, idx) => (
                  <div key={`${bloco.id}-foto-${idx}-${foto.slice(0, 16)}`} className={styles.galeriaPreviewItem}>
                    <img src={foto} alt={`Foto ${idx + 1}`} className={styles.galeriaPreviewImg} />
                    <button
                      type="button"
                      className={styles.galeriaPreviewRemover}
                      onClick={() => setRespostas(prev => ({
                        ...prev,
                        [bloco.id]: (prev[bloco.id] as string[]).filter((_, i) => i !== idx),
                      }))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Botão adicionar */}
            {(valor || []).length < (bloco.maxFotos || 5) && (
              <label className={styles.respostaUploadBtn}>
                <Upload size={16} />
                <span>Adicionar Foto ({(valor || []).length}/{bloco.maxFotos || 5})</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={async e => {
                    const files = Array.from(e.target.files || []);
                    const maxFotos = bloco.maxFotos || 5;
                    const atuais = (valor as string[]) || [];
                    const slots = maxFotos - atuais.length;
                    e.target.value = '';
                    for (const file of files.slice(0, slots)) {
                      try {
                        const url = await enviarImagemPublica(file);
                        setRespostas(prev => ({
                          ...prev,
                          [bloco.id]: [...((prev[bloco.id] as string[]) || []), url],
                        }));
                      } catch (err: any) {
                        alert(err?.message || 'Não foi possível enviar a imagem.');
                      }
                    }
                  }}
                />
              </label>
            )}
            {(valor || []).length >= (bloco.maxFotos || 5) && (
              <span className={styles.respostaFotoCount}>Limite de {bloco.maxFotos || 5} fotos atingido</span>
            )}
          </div>
        )}

        {bloco.tipo === 'checklist' && (
          <div className={styles.respostaChecklist}>
            {bloco.opcoes?.map((op, idx) => (
              <label key={`${bloco.id}-check-${op}-${idx}`} className={styles.checkItem}>
                <input type="checkbox" checked={valor?.[idx] || false} onChange={e => {
                  const arr = [...(valor || bloco.opcoes!.map(() => false))];
                  arr[idx] = e.target.checked;
                  setRespostas(prev => ({ ...prev, [bloco.id]: arr }));
                }} />
                <span>{op}</span>
              </label>
            ))}
          </div>
        )}

        {(bloco.tipo === 'status' || bloco.tipo === 'prioridade') && (
          <select className={styles.respostaSelect} value={valor || ''} onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: e.target.value }))}>
            <option value="">Selecione...</option>
            {bloco.opcoes?.map((op, idx) => <option key={`${bloco.id}-select-${op}-${idx}`} value={op}>{op}</option>)}
          </select>
        )}

        {bloco.tipo === 'avaliacao_estrela' && (
          <div className={styles.respostaEstrelas}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} className={`${styles.estrela} ${(valor || 0) >= n ? styles.estrelaAtiva : ''}`}
                onClick={() => setRespostas(prev => ({ ...prev, [bloco.id]: n }))}>
                <Star size={28} fill={(valor || 0) >= n ? '#fbc02d' : 'none'} />
              </button>
            ))}
            <span className={styles.estrelaTexto}>{valor ? `${valor}/5` : 'Toque para avaliar'}</span>
          </div>
        )}

        {bloco.tipo === 'avaliacao_escala' && (
          <div className={styles.respostaEscala}>
            <div className={styles.escalaNumeros}>
              {Array.from({ length: 11 }, (_, i) => (
                <button key={i} className={`${styles.escalaNum} ${valor === i ? styles.escalaNumAtivo : ''}`}
                  onClick={() => setRespostas(prev => ({ ...prev, [bloco.id]: i }))}>
                  {i}
                </button>
              ))}
            </div>
            <div className={styles.escalaLabels}>
              <span>Muito ruim</span>
              <span>Excelente</span>
            </div>
          </div>
        )}

        {bloco.tipo === 'pergunta' && (
          <div className={styles.respostaPerguntas}>
            {bloco.opcoes?.map((pergunta, idx) => (
              <div key={`${bloco.id}-pergunta-${pergunta}-${idx}`} className={styles.perguntaItem}>
                <label className={styles.perguntaLabel}>{pergunta || `Pergunta ${idx + 1}`}</label>
                <textarea
                  className={styles.respostaTextarea}
                  placeholder="Sua resposta..."
                  value={valor?.[idx] || ''}
                  onChange={e => {
                    const arr = [...(valor || bloco.opcoes!.map(() => ''))];
                    arr[idx] = e.target.value;
                    setRespostas(prev => ({ ...prev, [bloco.id]: arr }));
                  }}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        {(bloco.tipo === 'aviso' || bloco.tipo === 'comunicado') && (
          <textarea
            className={styles.respostaTextarea}
            placeholder={bloco.tipo === 'aviso' ? 'Registre o aviso...' : 'Registre o comunicado...'}
            value={valor || ''}
            onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: e.target.value }))}
            rows={3}
          />
        )}

        {bloco.tipo === 'feedback' && (
          <div className={styles.feedbackFields}>
            <p className={styles.feedbackHint}>Informe seu contato para receber um retorno:</p>
            <div className={styles.feedbackRow}>
              <Phone size={16} className={styles.feedbackIcon} />
              <input
                className={styles.formInput}
                placeholder="WhatsApp (ex: 11 99999-9999)"
                value={valor?.whatsapp || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], whatsapp: e.target.value } }))}
              />
            </div>
            <div className={styles.feedbackRow}>
              <Mail size={16} className={styles.feedbackIcon} />
              <input
                className={styles.formInput}
                type="email"
                placeholder="E-mail (ex: nome@email.com)"
                value={valor?.email || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], email: e.target.value } }))}
              />
            </div>
          </div>
        )}

        {bloco.tipo === 'urgencia' && (
          <div className={styles.urgenciaFields}>
            <div className={styles.urgenciaBanner}>
              <Siren size={20} />
              <span>Selecione o tipo de urgência e descreva o ocorrido</span>
            </div>
            <div className={styles.urgenciaOpcoes}>
              {bloco.opcoes?.map((op, idx) => (
                <label key={`${bloco.id}-urgencia-${op}-${idx}`} className={`${styles.urgenciaItem} ${valor?.tipo === op ? styles.urgenciaItemAtivo : ''}`}>
                  <input
                    type="radio"
                    name={`urgencia-${bloco.id}`}
                    checked={valor?.tipo === op}
                    onChange={() => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], tipo: op } }))}
                    hidden
                  />
                  <AlertTriangle size={14} />
                  <span>{op}</span>
                </label>
              ))}
            </div>
            <textarea
              className={styles.respostaTextarea}
              placeholder="Descreva a urgência com detalhe (local, gravidade, etc.)..."
              value={valor?.descricao || ''}
              onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], descricao: e.target.value } }))}
              rows={3}
            />
            <div className={styles.urgenciaAlerta}>
              <AlertTriangle size={14} />
              <span>Ao enviar, uma notificação será disparada imediatamente para os responsáveis.</span>
            </div>
          </div>
        )}

        {bloco.tipo === 'agendar_servico' && (
          <div className={styles.agendarFields}>
            <div className={styles.agendarBanner}>
              <CalendarPlus size={20} />
              <span>Solicite limpeza fora do horário (pós-festa, mudança, etc.)</span>
            </div>
            <div className={styles.agendarOpcoes}>
              {bloco.opcoes?.map((op, idx) => (
                <label key={`${bloco.id}-agendar-${op}-${idx}`} className={`${styles.agendarItem} ${valor?.tipoServico === op ? styles.agendarItemAtivo : ''}`}>
                  <input
                    type="radio"
                    name={`agendar-${bloco.id}`}
                    checked={valor?.tipoServico === op}
                    onChange={() => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], tipoServico: op } }))}
                    hidden
                  />
                  <span>{op}</span>
                </label>
              ))}
            </div>
            <div className={styles.agendarCampos}>
              <div className={styles.agendarRow}>
                <label htmlFor={`agendar-data-${bloco.id}`}>Data desejada</label>
                <input
                  id={`agendar-data-${bloco.id}`}
                  type="date"
                  className={styles.formInput}
                  value={valor?.data || ''}
                  onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], data: e.target.value } }))}
                />
              </div>
              <div className={styles.agendarRow}>
                <label htmlFor={`agendar-horario-${bloco.id}`}>Horário preferido</label>
                <input
                  id={`agendar-horario-${bloco.id}`}
                  type="time"
                  className={styles.formInput}
                  value={valor?.horario || ''}
                  onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], horario: e.target.value } }))}
                />
              </div>
            </div>
            <textarea
              className={styles.respostaTextarea}
              placeholder="Observaçõe (local, detalhes adicionais, etc.)..."
              value={valor?.observacoes || ''}
              onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], observacoes: e.target.value } }))}
              rows={3}
            />
          </div>
        )}

        {bloco.tipo === 'pesquisa_satisfacao' && (
          <div className={styles.pesquisaFields}>
            <div className={styles.pesquisaBanner}>
              <ClipboardCheck size={20} />
              <span>Avalie o serviço geral da empresa</span>
            </div>
            <div className={styles.pesquisaCriterios}>
              {bloco.opcoes?.map((criterio, idx) => (
                <div key={`${bloco.id}-criterio-${criterio}-${idx}`} className={styles.pesquisaCriterio}>
                  <span className={styles.pesquisaCriterioLabel}>{criterio}</span>
                  <div className={styles.pesquisaEstrelas}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        className={`${styles.pesquisaEstrela} ${(valor?.[idx] || 0) >= n ? styles.pesquisaEstrelaAtiva : ''}`}
                        onClick={() => {
                          const arr = [...(valor || bloco.opcoes!.map(() => 0))];
                          arr[idx] = n;
                          setRespostas(prev => ({ ...prev, [bloco.id]: arr }));
                        }}
                      >
                        <Star size={20} fill={(valor?.[idx] || 0) >= n ? '#00897b' : 'none'} />
                      </button>
                    ))}
                    <span className={styles.pesquisaNota}>{valor?.[idx] ? `${valor[idx]}/5` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
            <textarea
              className={styles.respostaTextarea}
              placeholder="Comentário ou sugestões (opcional)..."
              value={valor?.comentario || (typeof valor === 'object' && !Array.isArray(valor) ? valor?.comentario : '') || ''}
              onChange={e => {
                const notas = Array.isArray(valor) ? valor : (bloco.opcoes || []).map(() => 0);
                setRespostas(prev => ({ ...prev, [bloco.id]: { notas, comentario: e.target.value } }));
              }}
              rows={2}
            />
          </div>
        )}

        {bloco.tipo === 'controle_ponto' && (
          usuario
            ? <ControlePontoBloco blocoId={bloco.id} valor={valor} setRespostas={setRespostas} />
            : <div className={styles.manutencaoAlerta}><AlertTriangle size={14} /><span>O registro de ponto exige login no sistema.</span></div>
        )}

        {bloco.tipo === 'sla_tempo' && (
          usuario
            ? <SlaTempoBloco blocoId={bloco.id} bloco={bloco} valor={valor} setRespostas={setRespostas} />
            : <div className={styles.manutencaoAlerta}><AlertTriangle size={14} /><span>O registro de SLA exige login no sistema.</span></div>
        )}

        {bloco.tipo === 'assinatura_digital' && (
          <AssinaturaDigitalBloco blocoId={bloco.id} bloco={bloco} valor={valor} setRespostas={setRespostas} />
        )}

        {bloco.tipo === 'ocorrencia' && (
          <div className={styles.ocorrenciaFields}>
            <div className={styles.ocorrenciaBanner}>
              <Camera size={20} />
              <span>Informe a ocorrência com foto e descrição</span>
            </div>
            <div className={styles.ocorrenciaCategoria}>
              <span className={styles.ocorrenciaCatLabel}>Categoria do problema:</span>
              <div className={styles.ocorrenciaOpcoes}>
                {bloco.opcoes?.map((op, idx) => (
                  <label key={`${bloco.id}-ocorrencia-${op}-${idx}`} className={`${styles.ocorrenciaItem} ${valor?.categoria === op ? styles.ocorrenciaItemAtivo : ''}`}>
                    <input
                      type="radio"
                      name={`ocorrencia-${bloco.id}`}
                      checked={valor?.categoria === op}
                      onChange={() => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], categoria: op } }))}
                      hidden
                    />
                    <AlertTriangle size={14} />
                    <span>{op}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.ocorrenciaLocal}>
              <label className={styles.ocorrenciaCatLabel} htmlFor={`ocorrencia-local-${bloco.id}`}>Local da ocorrência:</label>
              <input
                id={`ocorrencia-local-${bloco.id}`}
                className={styles.formInput}
                placeholder="Ex: Hall do Bloco A, Garagem 2, Piscina..."
                value={valor?.local || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], local: e.target.value } }))}
              />
            </div>
            <div className={styles.ocorrenciaDescricao}>
              <label className={styles.ocorrenciaCatLabel} htmlFor={`ocorrencia-descricao-${bloco.id}`}>Descrição detalhada:</label>
              <textarea
                id={`ocorrencia-descricao-${bloco.id}`}
                className={styles.respostaTextarea}
                placeholder="Descreva o problema encontrado com o máximo de detalhe (o que aconteceu, quando percebeu, gravidade)..."
                value={valor?.descricao || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], descricao: e.target.value } }))}
                rows={4}
              />
            </div>
            <div className={styles.ocorrenciaFotos}>
              <span className={styles.ocorrenciaCatLabel}>Fotos do problema:</span>
              <div className={styles.ocorrenciaFotoGrid}>
                {(valor?.fotos || []).map((foto: string, idx: number) => (
                  <div key={`${bloco.id}-ocorrencia-foto-${idx}-${foto.slice(0, 16)}`} className={styles.ocorrenciaFotoThumb}>
                    <img src={foto} alt={`Foto ${idx + 1}`} />
                    <button
                      type="button"
                      className={styles.ocorrenciaFotoRemover}
                      onClick={() => {
                        const novasFotos = (valor?.fotos || []).filter((_: any, i: number) => i !== idx);
                        setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], fotos: novasFotos } }));
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(valor?.fotos || []).length < 5 && (
                  <label className={styles.ocorrenciaFotoAdd}>
                    <Camera size={24} />
                    <span>Adicionar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const url = await enviarImagemPublica(file);
                          setRespostas(prev => ({
                            ...prev,
                            [bloco.id]: { ...prev[bloco.id], fotos: [...((prev[bloco.id] as any)?.fotos || []), url] },
                          }));
                        } catch (err: any) {
                          alert(err?.message || 'Não foi possível enviar a imagem.');
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <span className={styles.ocorrenciaFotoHint}>{(valor?.fotos || []).length}/5 fotos — tire fotos claras do problema</span>
            </div>
            <div className={styles.ocorrenciaAlerta}>
              <AlertTriangle size={14} />
              <span>A ocorrência será registrada e encaminhada à equipe de manutenção.</span>
            </div>
          </div>
        )}

        {bloco.tipo === 'manutencao' && (
          <div className={styles.manutencaoFields}>
            <div className={styles.manutencaoBanner}>
              <Wrench size={20} />
              <span>Reportar problema de manutenção com foto e descrição</span>
            </div>
            <div className={styles.manutencaoSecao}>
              <span className={styles.manutencaoLabel}>Tipo do problema:</span>
              <div className={styles.manutencaoOpcoes}>
                {bloco.opcoes?.map((op, idx) => (
                  <label key={`${bloco.id}-manutencao-${op}-${idx}`} className={`${styles.manutencaoItem} ${valor?.tipo === op ? styles.manutencaoItemAtivo : ''}`}>
                    <input
                      type="radio"
                      name={`manutencao-${bloco.id}`}
                      checked={valor?.tipo === op}
                      onChange={() => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], tipo: op } }))}
                      hidden
                    />
                    <Wrench size={14} />
                    <span>{op}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.manutencaoSecao}>
              <span className={styles.manutencaoLabel}>Prioridade:</span>
              <div className={styles.manutencaoPrioridades}>
                {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.manutencaoPri} ${styles[`manutencaoPri${p}`]} ${valor?.prioridade === p ? styles.manutencaoPriAtivo : ''}`}
                    onClick={() => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], prioridade: p } }))}
                  >
                    <Flag size={14} />
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.manutencaoSecao}>
              <label className={styles.manutencaoLabel} htmlFor={`manutencao-local-${bloco.id}`}>Local exato:</label>
              <input
                id={`manutencao-local-${bloco.id}`}
                className={styles.formInput}
                placeholder="Ex: Banheiro do 3º andar, Garagem subsolo, Portaria..."
                value={valor?.local || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], local: e.target.value } }))}
              />
            </div>
            <div className={styles.manutencaoSecao}>
              <label className={styles.manutencaoLabel} htmlFor={`manutencao-descricao-${bloco.id}`}>Descrição do problema:</label>
              <textarea
                id={`manutencao-descricao-${bloco.id}`}
                className={styles.respostaTextarea}
                placeholder="Descreva o que está quebrado, vazando ou com defeito. Inclua detalhe como há quanto tempo o problema existe e se está piorando..."
                value={valor?.descricao || ''}
                onChange={e => setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], descricao: e.target.value } }))}
                rows={4}
              />
            </div>
            <div className={styles.manutencaoSecao}>
              <span className={styles.manutencaoLabel}>Fotos do problema:</span>
              <div className={styles.manutencaoFotoGrid}>
                {(valor?.fotos || []).map((foto: string, idx: number) => (
                  <div key={`${bloco.id}-manutencao-foto-${idx}-${foto.slice(0, 16)}`} className={styles.manutencaoFotoThumb}>
                    <img src={foto} alt={`Foto ${idx + 1}`} />
                    <button
                      type="button"
                      className={styles.manutencaoFotoRemover}
                      onClick={() => {
                        const novasFotos = (valor?.fotos || []).filter((_: any, i: number) => i !== idx);
                        setRespostas(prev => ({ ...prev, [bloco.id]: { ...prev[bloco.id], fotos: novasFotos } }));
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(valor?.fotos || []).length < 5 && (
                  <label className={styles.manutencaoFotoAdd}>
                    <Camera size={24} />
                    <span>Tirar / anexar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const url = await enviarImagemPublica(file);
                          setRespostas(prev => ({
                            ...prev,
                            [bloco.id]: { ...prev[bloco.id], fotos: [...((prev[bloco.id] as any)?.fotos || []), url] },
                          }));
                        } catch (err: any) {
                          alert(err?.message || 'Não foi possível enviar a imagem.');
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <span className={styles.manutencaoFotoHint}>{(valor?.fotos || []).length}/5 fotos — registre o estado atual do problema</span>
            </div>
            <div className={styles.manutencaoAlerta}>
              <Wrench size={14} />
              <span>O chamado será aberto automaticamente e encaminhado à equipe de manutenção responsável.</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
        {etapaResposta === 'identificacao' && (
          <div className={styles.idForm}>
            <h4 className={styles.idTitulo}>Identificação</h4>
            <p className={styles.idDesc}>Por favor, identifique-se antes de continuar.</p>

            {/* Tipo */}
            <label className={styles.formLabel}>Você é:</label>
            <div className={styles.idTipoGrid}>
              {([
                { val: 'morador', label: 'Morador', icon: <Home size={20} /> },
                { val: 'funcionario', label: 'Funcionário', icon: <UserCheck size={20} /> },
                { val: 'prestador', label: 'Prestador', icon: <Building2 size={20} /> },
              ] as const).map(t => (
                <button key={t.val}
                  className={`${styles.idTipoBtn} ${identificacao.tipo === t.val ? styles.idTipoBtnAtivo : ''}`}
                  onClick={() => setIdentificacao(prev => ({ ...prev, tipo: t.val }))}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Nome */}
            <label className={styles.formLabel}>Seu Nome</label>
            <input className={styles.formInput} placeholder="Digite seu nome completo..." value={identificacao.nome} onChange={e => setIdentificacao(prev => ({ ...prev, nome: e.target.value }))} />

            {/* Bloco */}
            <label className={styles.formLabel}>Bloco</label>
            <select className={styles.formSelect} value={identificacao.bloco} onChange={e => setIdentificacao(prev => ({ ...prev, bloco: e.target.value }))}>
              <option value="">Selecione o bloco...</option>
              {formulario.blocosCadastrados.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Unidade */}
            <label className={styles.formLabel}>Apartamento / Casa</label>
            <input className={styles.formInput} placeholder="Ex: 204, Casa 12..." value={identificacao.unidade} onChange={e => setIdentificacao(prev => ({ ...prev, unidade: e.target.value }))} />

            {/* Anônimo */}
            <label className={`${styles.checkboxLabel} ${styles.checkboxDestaque}`}>
              <input type="checkbox" checked={identificacao.anonimo}
                onChange={e => setIdentificacao(prev => ({ ...prev, anonimo: e.target.checked, tipo: e.target.checked ? '' : prev.tipo, nome: e.target.checked ? '' : prev.nome, bloco: e.target.checked ? '' : prev.bloco, unidade: e.target.checked ? '' : prev.unidade }))} />
              <span>Não quero me identificar</span>
            </label>

            <button className={styles.formSubmit}
              onClick={avancarIdentificacao}
              disabled={!identificacao.anonimo && (!identificacao.tipo || !identificacao.nome || !identificacao.bloco || !identificacao.unidade)}>
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        )}

        {etapaResposta === 'formulario' && (
          <div className={styles.respForm}>
            {formulario.logo && (
              <div className={styles.respLogo}>
                <img src={formulario.logo} alt="Logo" />
              </div>
            )}
            {formulario.descricao && <p className={styles.respDesc}>{formulario.descricao}</p>}

            <div className={styles.respBlocos}>
              {formulario.blocos.map(renderBlocoResposta)}
            </div>

            {erroEnvio && (
              <div className={styles.erroEnvio}>
                <AlertTriangle size={16} />
                <span>{erroEnvio}</span>
              </div>
            )}

            <button className={styles.formSubmit} onClick={enviarRespostas} disabled={enviandoResposta}>
              {enviandoResposta ? 'Enviando...' : 'Enviar Respostas'}
            </button>
          </div>
        )}

        {etapaResposta === 'enviado' && (
          <div className={styles.enviadoMsg}>
            <div className={styles.enviadoIcone}>
              <CheckSquare size={48} />
            </div>
            <h4>Respostas enviadas!</h4>
            <p>Obrigado por participar. Suas respostas foram registradas com sucesso.</p>
            {onFechar && <button className={styles.formSubmit} onClick={onFechar}>Fechar</button>}
          </div>
        )}
    </>
  );
};

export default ResponderFormulario;
