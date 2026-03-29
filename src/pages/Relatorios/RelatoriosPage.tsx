import React, { useState, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { BarChart3, TrendingUp, PieChart as PieIcon, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { relatorios as relatoriosApi } from '../../services/api';
import styles from '../Geolocalizacao/Geolocalizacao.module.css';

const CORES = ['#2e7d32', '#1a73e8', '#f57c00', '#d32f2f', '#9e9e9e'];

const RelatoriosPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>({ osMensal: [], osPorCondominio: [], custoMensal: [], produtividade: [], satisfacao: [] });

  useEffect(() => {
    relatoriosApi.resumo().then((data: any) => setDados(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  return (
    <div id="relatorios-content">
      <HowItWorks
        titulo="Relatório e Gráficos"
        descricao="Visualize relatório completos com gráficos de todas as funções do sistema. Analise dados de OS, checklists, materiais, produtividade e satisfação."
        passos={[
          'Selecione o período de análise desejado',
          'Visualize gráficos de barras, linhas, pizza e área',
          'Compare dados entre condomínios e funcionários',
          'Analise tendências de custos e produtividade',
          'Exporte qualquer relatório em PDF ou imprima',
        ]}
      />

      <PageHeader
        titulo="Relatórios"
        subtitulo="Análise completa do sistema"
        onCompartilhar={() => compartilharConteudo('Relatórios', 'Relatórios do sistema Manutenção X')}
        onImprimir={() => imprimirElemento('relatorios-content')}
        onGerarPdf={() => gerarPdfDeElemento('relatorios-content', 'relatorios')}
      />

      <div className={styles.chartsRow}>
        <Card padding="md">
          <h3 className={styles.chartTitle}>
            <BarChart3 size={18} style={{ color: 'var(--cor-primaria)' }} /> Ordens de Serviço por Mês
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados.osMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="mes" fontSize={12} stroke="var(--cor-texto-secundario)" />
              <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
              <Bar dataKey="limpeza" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Limpeza" />
              <Bar dataKey="manutencao" fill="#00897b" radius={[4, 4, 0, 0]} name="Manutenção" />
              <Bar dataKey="emergencia" fill="#d32f2f" radius={[4, 4, 0, 0]} name="Emergência" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md">
          <h3 className={styles.chartTitle}>
            <TrendingUp size={18} style={{ color: 'var(--cor-primaria)' }} /> Custos Mensais
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dados.custoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="mes" fontSize={12} stroke="var(--cor-texto-secundario)" />
              <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} formatter={(v: number) => `R$ ${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="custo" fill="var(--cor-primaria-light)" stroke="var(--cor-primaria)" strokeWidth={2} name="Custo" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className={styles.chartsRow}>
        <Card padding="md">
          <h3 className={styles.chartTitle}>
            <Activity size={18} style={{ color: 'var(--cor-primaria)' }} /> Produtividade por Funcionário
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados.produtividade}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="funcionario" fontSize={12} stroke="var(--cor-texto-secundario)" />
              <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
              <Bar dataKey="tarefas" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Tarefa Concluídas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md">
          <h3 className={styles.chartTitle}>
            <PieIcon size={18} style={{ color: 'var(--cor-primaria)' }} /> Satisfação dos Condomínios
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={dados.satisfacao} cx="50%" cy="50%" innerRadius={50} outerRadius={100} dataKey="valor" nameKey="estrelas" label>
                {(dados.satisfacao || []).map((_: any, i: number) => <Cell key={i} fill={CORES[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card padding="md">
        <h3 className={styles.chartTitle}>O.S. por Condomínio e Nota Média</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dados.osPorCondominio}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
            <XAxis dataKey="nome" fontSize={12} stroke="var(--cor-texto-secundario)" />
            <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
            <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
            <Bar dataKey="os" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Orden de Serviço" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default RelatoriosPage;
