import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, AlertTriangle, TrendingUp, Shield, Wrench, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { kpis as kpisApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useDemo } from '../../contexts/DemoContext';
import PageHeader from '../../components/Common/PageHeader';
import HowItWorks from '../../components/Common/HowItWorks';
import Card from '../../components/Common/Card';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import type { KPIsManutencao, KPIEquipamento, TendenciaKPI } from '../../types';
import styles from './KPIsPage.module.css';

const CORES_GRAFICO = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#06b6d4'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtHoras = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
};

const avaliar = (valor: number, bom: number, medio: number, maior: boolean = true): string => {
  if (maior) return valor >= bom ? 'bom' : valor >= medio ? 'medio' : 'ruim';
  return valor <= bom ? 'bom' : valor <= medio ? 'medio' : 'ruim';
};

const KPIsPage: React.FC = () => {
  const { usuario } = useAuth();
  const { isDemo } = useDemo();

  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('ano');
  const [kpis, setKpis] = useState<KPIsManutencao | null>(null);
  const [equipamentos, setEquipamentos] = useState<KPIEquipamento[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaKPI[]>([]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [kpiData, eqData, tendData] = await Promise.all([
        kpisApi.get({ periodo }),
        kpisApi.equipamentos(),
        kpisApi.tendencia(),
      ]);
      setKpis(kpiData || null);
      setEquipamentos(eqData || []);
      setTendencia(tendData || []);
    } catch (err) {
      console.error('Erro ao carregar KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [periodo]);

  if (loading) return <LoadingSpinner texto="Carregando KPIs..." />;
  if (!kpis) {
    return (
      <div className={styles.page}>
        <PageHeader titulo="KPIs de Manutenção" subtitulo="Indicadores de performance da manutenção" />
        <div className={styles.empty}>
          <Activity size={48} />
          <h4>Sem dados suficientes</h4>
          <p>Os KPIs são calculados a partir das Ordens de Serviço concluídas. Registre OS para gerar indicadores.</p>
        </div>
      </div>
    );
  }

  const piePrevCorr = [
    { name: 'Preventivas', value: kpis.preventivasVsCorretivas.preventivas },
    { name: 'Corretivas', value: kpis.preventivasVsCorretivas.corretivas },
  ];

  return (
    <div id="kpis-content" className={styles.page}>
      <PageHeader
        titulo="KPIs de Manutenção"
        subtitulo="Indicadores de performance da manutenção"
        onCompartilhar={() => compartilharConteudo('KPIs de Manutenção', `MTBF: ${fmtHoras(kpis.mtbf)} | MTTR: ${fmtHoras(kpis.mttr)} | Disponibilidade: ${fmtPct(kpis.disponibilidade)}`)}
        onImprimir={() => imprimirElemento('kpis-content')}
        onGerarPdf={() => gerarPdfDeElemento('kpis-content', 'kpis-manutencao')}
      />

      <HowItWorks
        titulo="KPIs de Manutenção"
        descricao="Indicadores-chave para medir a eficiência da sua operação de manutenção."
        passos={[
          'MTBF (Mean Time Between Failures) – tempo médio entre falhas dos equipamentos',
          'MTTR (Mean Time To Repair) – tempo médio de reparo',
          'Disponibilidade – percentual de tempo que os equipamentos ficam operacionais',
          'Backlog – quantidade de OS pendentes; quanto menor, melhor a capacidade operacional',
        ]}
      />

      {/* Filtros */}
      <div className={styles.filterBar}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="mes">Último Mês</option>
          <option value="trimestre">Último Trimestre</option>
          <option value="semestre">Último Semestre</option>
          <option value="ano">Último Ano</option>
          <option value="todos">Todo o Período</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>MTBF</span>
            <div className={`${styles.kpiIcon} ${styles.verde}`}><Clock size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtHoras(kpis.mtbf)}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.mtbf, 720, 168)]}`}>
            Tempo médio entre falhas
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>MTTR</span>
            <div className={`${styles.kpiIcon} ${styles.laranja}`}><Wrench size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtHoras(kpis.mttr)}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.mttr, 1, 4, false)]}`}>
            Tempo médio de reparo
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Disponibilidade</span>
            <div className={`${styles.kpiIcon} ${styles.azul}`}><Shield size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtPct(kpis.disponibilidade)}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.disponibilidade, 95, 85)]}`}>
            Meta: &gt; 95%
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Backlog</span>
            <div className={`${styles.kpiIcon} ${styles.vermelho}`}><AlertTriangle size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{kpis.backlog}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.backlog, 5, 20, false)]}`}>
            OS pendentes
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Taxa de Conclusão</span>
            <div className={`${styles.kpiIcon} ${styles.verde}`}><CheckCircle size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtPct(kpis.taxaConclusao)}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.taxaConclusao, 90, 70)]}`}>
            Meta: &gt; 90%
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Custo Total</span>
            <div className={`${styles.kpiIcon} ${styles.roxo}`}><TrendingUp size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtBRL(kpis.custoTotal)}</div>
          <div className={styles.kpiMeta}>Período selecionado</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Tempo de Resposta</span>
            <div className={`${styles.kpiIcon} ${styles.ciano}`}><Activity size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{fmtHoras(kpis.tempoMedioResposta)}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.tempoMedioResposta, 0.5, 2, false)]}`}>
            Meta: &lt; 30 min
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Taxa Reincidência</span>
            <div className={`${styles.kpiIcon} ${styles.amarelo}`}><RefreshCw size={18} /></div>
          </div>
          <div className={styles.kpiValor}>{kpis.reincidencia}</div>
          <div className={`${styles.kpiMeta} ${styles[avaliar(kpis.reincidencia, 2, 5, false)]}`}>
            Meta: &lt; 5%
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {/* Tendência */}
        {tendencia.length > 0 && (
          <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
            <h3>Tendência de KPIs (12 meses)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendencia}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="concluidas" stroke="#22c55e" name="Concluídas" dot={false} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total OS" dot={false} />
                <Line type="monotone" dataKey="preventivas" stroke="#a855f7" name="Preventivas" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Preventivas vs Corretivas */}
        {(kpis.preventivasVsCorretivas.preventivas > 0 || kpis.preventivasVsCorretivas.corretivas > 0) && (
          <div className={styles.chartCard}>
            <h3>Preventivas vs Corretivas</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={piePrevCorr} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  <Cell fill="#3b82f6" />
                  <Cell fill="#f97316" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Equipment KPI Table */}
      {equipamentos.length > 0 && (
        <Card style={{ marginTop: 4 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>KPIs por Equipamento</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Total OS</th>
                  <th>Concluídas</th>
                  <th>Preventivas</th>
                  <th>Corretivas</th>
                  <th>Tempo Médio</th>
                  <th>Custo Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {equipamentos.map(eq => {
                  const statusMap: Record<string, string> = { ativo: 'Saudável', manutencao: 'Em Manutenção', inativo: 'Inativo' };
                  const nivelMap: Record<string, string> = { ativo: 'bom', manutencao: 'medio', inativo: 'ruim' };
                  const nivel = nivelMap[eq.status] || 'cinza';
                  return (
                    <tr key={eq.id}>
                      <td><strong>{eq.nome}</strong></td>
                      <td>{eq.totalOs}</td>
                      <td>{eq.osConcluidas}</td>
                      <td>{eq.preventivas}</td>
                      <td>{eq.corretivas}</td>
                      <td>{eq.tempoMedio > 0 ? `${Math.round(eq.tempoMedio)} min` : '—'}</td>
                      <td className={styles.valor}>{fmtBRL(eq.custoTotal)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[nivel === 'bom' ? 'statusBom' : nivel === 'medio' ? 'statusMedio' : 'statusRuim']}`}>
                          {statusMap[eq.status] || eq.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default KPIsPage;
