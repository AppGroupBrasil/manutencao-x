import React, { useState, useEffect, useRef, useMemo } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { formatarHora } from '../../utils/dateUtils';
import { formatarTempo } from '../../utils/geoUtils';
import { MapPin, Clock, User, Navigation, History, RefreshCw, CalendarDays, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geolocalizacao as geoApi } from '../../services/api';
import styles from './Geolocalizacao.module.css';

interface PosicaoMock {
  userId: string;
  nome: string;
  role: string;
  lat: number;
  lng: number;
  endereco: string;
  horaChegada: number;
  local: string;
  status: 'presente' | 'em_transito' | 'offline';
}



type PeriodoFiltro = 'hoje' | 'semana' | 'mes' | 'data_especifica';

function inicioHoje(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}
function inicioSemana(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dia = d.getDay(); d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return d.getTime();
}
function inicioMes(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1);
  return d.getTime();
}

function fimDoDia(dateStr: string): number {
  const d = new Date(dateStr + 'T23:59:59'); return d.getTime();
}
function inicioDoDia(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00'); return d.getTime();
}

/* ── Ícones customizados para o mapa ── */
const createIcon = (cor: string) => L.divIcon({
  className: '',
  html: `<div style=s
    width:32px;height:32px;border-radius:50%;
    background:${cor};border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
  s><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

const ICON_PRESENTE = createIcon('#2e7d32');
const ICON_TRANSITO = createIcon('#f57c00');
const ICON_OFFLINE = createIcon('#9e9e9e');

const getIconForStatus = (status: PosicaoMock['status']) => {
  if (status === 'presente') return ICON_PRESENTE;
  if (status === 'em_transito') return ICON_TRANSITO;
  return ICON_OFFLINE;
};

/* ── Componente para ajustar bounds do mapa ── */
const FitBounds: React.FC<{ posicoes: PosicaoMock[] }> = ({ posicoes }) => {
  const map = useMap();
  useEffect(() => {
    const validas = posicoes.filter(p => p.lat !== 0 && p.lng !== 0);
    if (validas.length > 0) {
      const bounds = L.latLngBounds(validas.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [posicoes, map]);
  return null;
};

const GeolocalizacaoPage: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<'tempo_real' | 'historico'>('tempo_real');
  const [posicoes, setPosicoes] = useState<PosicaoMock[]>([]);
  const [historico, setHistorico] = useState<{ nome: string; local: string; chegada: number; saida: number | undefined; tempo: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(Date.now());
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
  const [dataEspecifica, setDataEspecifica] = useState('');
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarDados = () => {
    geoApi.list().then((data: any[]) => {
      setPosicoes(data.map((p: any) => ({
        userId: p.userId || p.id,
        nome: p.nome || p.funcionarioNome || '',
        role: p.role || 'Funcionario',
        lat: p.latitude || p.lat || 0,
        lng: p.longitude || p.lng || 0,
        endereco: p.endereco || '',
        horaChegada: p.horaChegada ? new Date(p.horaChegada).getTime() : (p.criadoEm ? new Date(p.criadoEm).getTime() : Date.now()),
        local: p.local || '',
        status: p.status || 'presente',
      })));
      setHistorico(data.map((r: any) => ({
        nome: r.nome || r.funcionarioNome || '',
        local: r.local || '',
        chegada: r.horaChegada ? new Date(r.horaChegada).getTime() : (r.criadoEm ? new Date(r.criadoEm).getTime() : Date.now()),
        saida: r.saida ? new Date(r.saida).getTime() : undefined,
        tempo: r.tempo || 0,
      })));
      setUltimaAtualizacao(Date.now());
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { carregarDados(); }, []);

  /* ── Simulação de atualização em tempo real (30s) ── */
  useEffect(() => {
    intervaloRef.current = setInterval(() => {
      carregarDados();
    }, 30000);
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, []);

  const atualizarAgora = () => {
    carregarDados();
  };

  const posValidas = posicoes.filter(p => p.lat !== 0 && p.lng !== 0);

  /* ── Histórico filtrado por período ── */
  const historicoFiltrado = useMemo(() => {
    let inicio: number;
    let fim = Date.now();
    if (periodo === 'hoje') {
      inicio = inicioHoje();
    } else if (periodo === 'semana') {
      inicio = inicioSemana();
    } else if (periodo === 'mes') {
      inicio = inicioMes();
    } else {
      if (!dataEspecifica) return [];
      inicio = inicioDoDia(dataEspecifica);
      fim = fimDoDia(dataEspecifica);
    }
    return historico.filter(r => r.chegada >= inicio && r.chegada <= fim);
  }, [periodo, dataEspecifica]);

  /* ── Dados do gráfico baseados no filtro ── */
  const chartTempoFiltrado = useMemo(() => {
    const mapa: Record<string, number> = {};
    historicoFiltrado.forEach(r => {
      const primeiro = r.nome.split(' ')[0];
      mapa[primeiro] = (mapa[primeiro] || 0) + r.tempo / 60;
    });
    return Object.entries(mapa).map(([nome, horas]) => ({ nome, horas: Math.round(horas * 10) / 10 })).sort((a, b) => b.horas - a.horas);
  }, [historicoFiltrado]);

  const periodoLabel = periodo === 'hoje' ? 'Hoje' : periodo === 'semana' ? 'Esta Semana' : periodo === 'mes' ? 'Este Mês' : dataEspecifica ? new Date(dataEspecifica + 'T12:00:00').toLocaleDateString('pt-BR') : '';

  const centro: [number, number] = posValidas.length > 0
    ? [posValidas.reduce((s, p) => s + p.lat, 0) / posValidas.length, posValidas.reduce((s, p) => s + p.lng, 0) / posValidas.length]
    : [-23.5505, -46.6333];

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  return (
    <div id="geo-content">
      <HowItWorks
        titulo="Geolocalização"
        descricao="Acompanhe em tempo real a localização de supervisore e funcionários."
        passos={[
          'O sistema rastreia automaticamente a posição GPS dos funcionários',
          'A localização é atualizada a cada 30 segundos no mapa',
          'Filtre o histórico por dia, semana, mês ou data específica',
          'O sistema registra chegada e saída automaticamente',
          'Gere relatórios de permanência por endereço',
        ]}
      />

      <PageHeader
        titulo="Geolocalizacao"
        subtitulo="Rastreamento em tempo real de equipes"
        onCompartilhar={() => compartilharConteudo('Geolocalizacao', 'Dados de localizacao')}
        onImprimir={() => imprimirElemento('geo-content')}
        onGerarPdf={() => gerarPdfDeElemento('geo-content', 'geolocalizacao')}
      />

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${abaAtiva === 'tempo_real' ? styles.tabActive : ''}`} onClick={() => setAbaAtiva('tempo_real')}>
          <Navigation size={16} /> Tempo Real
        </button>
        <button className={`${styles.tab} ${abaAtiva === 'historico' ? styles.tabActive : ''}`} onClick={() => setAbaAtiva('historico')}>
          <History size={16} /> Historico
        </button>
      </div>

      {abaAtiva === 'tempo_real' && (
        <>
          <div className={styles.mapHeader}>
            <div className={styles.mapInfo}>
              <span className={styles.mapLive}></span>
              <span>Atualização automática a cada 30s</span>
              <span className={styles.mapTimestamp}>Última: {formatarHora(ultimaAtualizacao)}</span>
            </div>
            <button className={styles.mapRefresh} onClick={atualizarAgora}>
              <RefreshCw size={14} /> Atualizar Agora
            </button>
          </div>

          <div className={styles.mapWrapper}>
            <MapContainer center={centro} zoom={13} style={{ height: '450px', width: '100%', borderRadius: 'var(--raio-borda)' }} scrollWheelZoom={true} zoomControl={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds posicoes={posValidas} />
              {posValidas.map(pos => (
                <Marker
                  key={pos.userId}
                  position={[pos.lat, pos.lng]}
                  icon={getIconForStatus(pos.status)}
                  eventHandlers={{
                    click: () => setPosicaoSelecionada(pos.userId),
                  }}
                >
                  <Popup>
                    <div className={styles.popupContent}>
                      <strong>{pos.nome}</strong>
                      <span className={styles.popupRole}>{pos.role}</span>
                      <div className={styles.popupRow}><MapPin size={12} /> {pos.endereco}</div>
                      <div className={styles.popupRow}><Navigation size={12} /> {pos.local}</div>
                      {pos.horaChegada > 0 && <div className={styles.popupRow}><Clock size={12} /> Chegada: {formatarHora(pos.horaChegada)}</div>}
                      <div className={styles.popupStatus} data-status={pos.status}>
                        {pos.status === 'presente' ? '● Presente' : pos.status === 'em_transito' ? '● Em Trânsito' : '● Offline'}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className={styles.mapLegenda}>
            <span><span className={styles.legendaDot} style={{ background: '#2e7d32' }}></span> Presente</span>
            <span><span className={styles.legendaDot} style={{ background: '#f57c00' }}></span> Em Trânsito</span>
            <span><span className={styles.legendaDot} style={{ background: '#9e9e9e' }}></span> Offline</span>
            <span className={styles.legendaTotal}>{posValidas.length} no mapa</span>
          </div>

          <div className={styles.posGrid}>
            {posicoes.map(pos => (
              <Card key={pos.userId} padding="md" hover>
                <div className={`${styles.posCard} ${posicaoSelecionada === pos.userId ? styles.posCardAtiva : ''}`} onClick={() => setPosicaoSelecionada(pos.userId)}>
                  <div className={styles.posTop}>
                    <div className={styles.posAvatar}>
                      <User size={18} />
                    </div>
                    <StatusBadge
                      texto={pos.status === 'presente' ? 'Presente' : pos.status === 'em_transito' ? 'Em Transito' : 'Offline'}
                      variante={pos.status === 'presente' ? 'sucesso' : pos.status === 'em_transito' ? 'aviso' : 'neutro'}
                    />
                  </div>
                  <h4 className={styles.posNome}>{pos.nome}</h4>
                  <div className={styles.posEndereco}>
                    <MapPin size={13} />
                    <span>{pos.endereco}</span>
                  </div>
                  <div className={styles.posCoords}>
                    <Navigation size={13} />
                    <span>{pos.local}</span>
                  </div>
                  {pos.status !== 'offline' && (
                    <div className={styles.posCoordsText}>
                      {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                    </div>
                  )}
                  {pos.horaChegada > 0 && (
                    <div className={styles.posUpdate}>
                      <Clock size={12} />
                      <span>Chegada: {formatarHora(pos.horaChegada)}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {abaAtiva === 'historico' && (
        <>
          {/* ── Filtro de período ── */}
          <div className={styles.filtroBar}>
            <div className={styles.filtroLabel}>
              <Filter size={15} />
              <span>Período:</span>
            </div>
            <div className={styles.filtroBtns}>
              <button className={`${styles.filtroBtn} ${periodo === 'hoje' ? styles.filtroBtnAtivo : ''}`} onClick={() => setPeriodo('hoje')}>
                <CalendarDays size={13} /> Hoje
              </button>
              <button className={`${styles.filtroBtn} ${periodo === 'semana' ? styles.filtroBtnAtivo : ''}`} onClick={() => setPeriodo('semana')}>
                <CalendarDays size={13} /> Semana
              </button>
              <button className={`${styles.filtroBtn} ${periodo === 'mes' ? styles.filtroBtnAtivo : ''}`} onClick={() => setPeriodo('mes')}>
                <CalendarDays size={13} /> Mês
              </button>
              <button className={`${styles.filtroBtn} ${periodo === 'data_especifica' ? styles.filtroBtnAtivo : ''}`} onClick={() => setPeriodo('data_especifica')}>
                <CalendarDays size={13} /> Data Específica
              </button>
            </div>
            {periodo === 'data_especifica' && (
              <input
                type="date"
                className={styles.filtroDate}
                value={dataEspecifica}
                onChange={e => setDataEspecifica(e.target.value)}
              />
            )}
            <span className={styles.filtroResumo}>
              {historicoFiltrado.length} registro(s) — {periodoLabel}
            </span>
          </div>

          <Card padding="md">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Local</th>
                  <th>Data</th>
                  <th>Chegada</th>
                  <th>Saída</th>
                  <th>Permanência</th>
                </tr>
              </thead>
              <tbody>
                {historicoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--cor-texto-secundario)' }}>
                      Nenhum registro encontrado para este período.
                    </td>
                  </tr>
                ) : (
                  historicoFiltrado.map((reg, i) => (
                    <tr key={i}>
                      <td><strong>{reg.nome}</strong></td>
                      <td>{reg.local}</td>
                      <td>{new Date(reg.chegada).toLocaleDateString('pt-BR')}</td>
                      <td>{formatarHora(reg.chegada)}</td>
                      <td>{reg.saida ? formatarHora(reg.saida) : <StatusBadge texto="No local" variante="sucesso" />}</td>
                      <td><strong>{formatarTempo(reg.tempo)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          <div style={{ marginTop: '1cm' }}>
            <Card padding="md">
              <h3 className={styles.chartTitle}>Horas em Campo — {periodoLabel}</h3>
              {chartTempoFiltrado.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: 24 }}>Sem dados para este período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartTempoFiltrado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                    <XAxis dataKey="nome" stroke="var(--cor-texto-secundario)" fontSize={12} />
                    <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
                    <Bar dataKey="horas" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} name="Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default GeolocalizacaoPage;