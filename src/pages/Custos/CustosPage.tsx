import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Receipt, Wrench, BarChart3, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { custos as custosApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useDemo } from '../../contexts/DemoContext';
import PageHeader from '../../components/Common/PageHeader';
import HowItWorks from '../../components/Common/HowItWorks';
import Card from '../../components/Common/Card';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import type { CustoOS, ResumoCustos, CustoPorGrupo, EvolucaoCusto, CustoPorEquipamento } from '../../types';
import styles from './CustosPage.module.css';

const CORES = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CustosPage: React.FC = () => {
  const { usuario } = useAuth();
  const { isDemo } = useDemo();

  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('ano');
  const [items, setItems] = useState<CustoOS[]>([]);
  const [resumo, setResumo] = useState<ResumoCustos>({ totalOs: 0, totalMaterial: 0, totalMaoObra: 0, totalTerceiros: 0, totalGeral: 0, mediaPorOs: 0 });
  const [porCondominio, setPorCondominio] = useState<CustoPorGrupo[]>([]);
  const [porCategoria, setPorCategoria] = useState<CustoPorGrupo[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoCusto[]>([]);
  const [porEquipamento, setPorEquipamento] = useState<CustoPorEquipamento[]>([]);

  const carregar = async () => {
    setLoading(true);
    try {
      const [res, cond, cat, evo, equip] = await Promise.all([
        custosApi.list({ periodo }),
        custosApi.porCondominio(),
        custosApi.porCategoria(),
        custosApi.evolucao(),
        custosApi.porEquipamento(),
      ]);
      setItems(res.items || []);
      setResumo(res.resumo || resumo);
      setPorCondominio(cond || []);
      setPorCategoria(cat || []);
      setEvolucao(evo || []);
      setPorEquipamento(equip || []);
    } catch (err) {
      console.error('Erro ao carregar custos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [periodo]);

  if (loading) return <LoadingSpinner texto="Carregando custos..." />;

  return (
    <div id="custos-content" className={styles.page}>
      <PageHeader
        titulo="Gestão de Custos"
        subtitulo="Controle e análise de custos de manutenção"
        onCompartilhar={() => compartilharConteudo('Gestão de Custos', `Total: ${fmtBRL(resumo.totalGeral)}`)}
        onImprimir={() => imprimirElemento('custos-content')}
        onGerarPdf={() => gerarPdfDeElemento('custos-content', 'custos-manutencao')}
      />

      <HowItWorks
        titulo="Gestão de Custos de Manutenção"
        descricao="Acompanhe todos os custos de manutenção: materiais, mão de obra e serviços terceirizados."
        passos={[
          'Os custos são registrados nas Ordens de Serviço (material, mão de obra, terceiros)',
          'Filtre por período, condomínio ou categoria para análises focadas',
          'Visualize a evolução mensal e identifique tendências de gasto',
          'Acompanhe os equipamentos que mais geram custo de manutenção',
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

      {/* Resumo */}
      <div className={styles.resumoGrid}>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.verde}`}><DollarSign size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{fmtBRL(resumo.totalGeral)}</h4>
            <span>Custo Total</span>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.azul}`}><Package size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{fmtBRL(resumo.totalMaterial)}</h4>
            <span>Materiais</span>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.laranja}`}><Wrench size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{fmtBRL(resumo.totalMaoObra)}</h4>
            <span>Mão de Obra</span>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.roxo}`}><Receipt size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{fmtBRL(resumo.totalTerceiros)}</h4>
            <span>Terceirizados</span>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.cinza}`}><BarChart3 size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{fmtBRL(resumo.mediaPorOs)}</h4>
            <span>Média por OS</span>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.azul}`}><TrendingUp size={22} /></div>
          <div className={styles.resumoInfo}>
            <h4>{resumo.totalOs}</h4>
            <span>OS com Custo</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {/* Evolução Mensal */}
        {evolucao.length > 0 && (
          <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
            <h3>Evolução Mensal de Custos</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Area type="monotone" dataKey="material" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Material" />
                <Area type="monotone" dataKey="maoObra" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="Mão de Obra" />
                <Area type="monotone" dataKey="terceiros" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} name="Terceiros" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Por Condomínio */}
        {porCondominio.length > 0 && (
          <div className={styles.chartCard}>
            <h3>Custo por Condomínio</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={porCondominio} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Por Categoria */}
        {porCategoria.length > 0 && (
          <div className={styles.chartCard}>
            <h3>Custo por Categoria</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={porCategoria.map(c => ({ nome: c.categoria || 'Outras', valor: c.total }))} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ nome, valor }) => `${nome}: ${fmtBRL(valor)}`}>
                  {porCategoria.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Equipamentos */}
      {porEquipamento.length > 0 && (
        <div className={styles.chartCard} style={{ marginTop: 20 }}>
          <h3>Top Equipamentos por Custo</h3>
          <ul className={styles.rankList}>
            {porEquipamento.slice(0, 10).map((eq, i) => (
              <li className={styles.rankItem} key={eq.id}>
                <span className={styles.rankName}>
                  {i + 1}. {eq.nome} <span className={styles.rankCode}>{eq.codigo}</span>
                </span>
                <span className={styles.rankValue}>{fmtBRL(eq.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela de OS com Custos */}
      {items.length > 0 && (
        <Card style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Ordens de Serviço com Custos</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Condomínio</th>
                  <th>Equipamento</th>
                  <th>Material</th>
                  <th>Mão de Obra</th>
                  <th>Terceiros</th>
                  <th>Total</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 50).map(os => (
                  <tr key={os.id}>
                    <td>{os.titulo}</td>
                    <td>{os.condominioNome}</td>
                    <td>{os.equipamentoNome || '—'}</td>
                    <td className={styles.valor}>{fmtBRL(os.custoMaterial || 0)}</td>
                    <td className={styles.valor}>{fmtBRL(os.custoMaoObra || 0)}</td>
                    <td className={styles.valor}>{fmtBRL(os.custoTerceiros || 0)}</td>
                    <td className={`${styles.valor} ${styles.valorPositivo}`}>{fmtBRL(os.custoTotal || 0)}</td>
                    <td>{new Date(os.dataAbertura).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {items.length === 0 && !loading && (
        <div className={styles.empty}>
          <DollarSign size={48} />
          <h4>Nenhum custo registrado</h4>
          <p>Os custos são preenchidos nas Ordens de Serviço (campos Material, Mão de Obra e Terceiros).</p>
        </div>
      )}
    </div>
  );
};

export default CustosPage;
