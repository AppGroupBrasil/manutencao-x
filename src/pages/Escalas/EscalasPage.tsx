import React, { useState, useEffect, useMemo } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { diaSemanaLabel } from '../../utils/dateUtils';
import { Plus, CalendarCheck, BookOpen, Columns3, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { escalas as escalasApi, tarefas as tarefasApi, roteiros as roteirosApi, quadroAtividades as quadroApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './Escalas.module.css';

interface Escala {
  id: string;
  func: string;
  dia: number;
  inicio: string;
  fim: string;
  local: string;
  funcao: string;
  observacoes: string;
}

/* ===== Helpers p/ dados cruzados ===== */
interface TarefaResumo { titulo: string; prioridade: string; }
interface RoteiroResumo { titulo: string; }
interface QuadroResumo { titulo: string; prioridade: string; status: string; }

function criarMapaTarefas(tarefas: any[]): Record<string, TarefaResumo[]> {
  const mapa: Record<string, TarefaResumo[]> = {};
  tarefas.forEach((t: any) => {
    const nome = (t.funcionarioNome || '').toLowerCase();
    if (!nome) return;
    if (!mapa[nome]) mapa[nome] = [];
    mapa[nome].push({ titulo: t.titulo || 'Tarefa', prioridade: t.prioridade || 'media' });
  });
  return mapa;
}

function criarMapaRoteiros(roteiros: any[], logs: any[]): Record<string, RoteiroResumo[]> {
  const roteiroMap: Record<string, string> = {};
  roteiros.forEach((r: any) => { roteiroMap[r.id] = r.titulo || 'Roteiro'; });
  const mapa: Record<string, RoteiroResumo[]> = {};
  logs.forEach((l: any) => {
    const nome = (l.funcionarioNome || l.funcionario || '').toLowerCase();
    if (!nome) return;
    if (!mapa[nome]) mapa[nome] = [];
    mapa[nome].push({ titulo: roteiroMap[l.roteiroId] || 'Roteiro' });
  });
  return mapa;
}

function criarMapaQuadro(itens: any[]): Record<string, QuadroResumo[]> {
  const mapa: Record<string, QuadroResumo[]> = {};
  itens.forEach((a: any) => {
    const nome = (a.responsavelNome || a.responsavel || '').toLowerCase();
    if (!nome) return;
    if (!mapa[nome]) mapa[nome] = [];
    mapa[nome].push({ titulo: a.titulo || 'Atividade', prioridade: a.prioridade || 'media', status: a.status || 'a_fazer' });
  });
  return mapa;
}

const STATUS_LABEL: Record<string, string> = {
  a_fazer: 'A Fazer', em_andamento: 'Em Andamento', em_revisao: 'Em Revisão', concluido: 'Concluído',
};

const EscalasPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [dadosTarefas, setDadosTarefas] = useState<any[]>([]);
  const [dadosRoteiros, setDadosRoteiros] = useState<any[]>([]);
  const [dadosLogs, setDadosLogs] = useState<any[]>([]);
  const [dadosQuadro, setDadosQuadro] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [novaEscala, setNovaEscala] = useState({ func: '', dia: '1', inicio: '08:00', fim: '17:00', local: '', funcao: 'Limpeza', observacoes: '' });

  useEffect(() => {
    Promise.all([
      escalasApi.list(),
      tarefasApi.list().catch(() => []),
      roteirosApi.list().catch(() => []),
      quadroApi.list().catch(() => []),
    ]).then(([esc, tar, rot, qdr]) => {
      setEscalas((esc as any[]).map((e: any) => ({ id: e.id, func: e.funcionarioNome || '', dia: e.diaSemana, inicio: e.horaInicio, fim: e.horaFim, local: e.local || '', funcao: e.funcao || '', observacoes: e.observacoes || '' })));
      setDadosTarefas(tar as any[]);
      setDadosRoteiros(rot as any[]);
      setDadosQuadro(qdr as any[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  /* Dados cruzados — recalcula junto com escalas */
  const mapaTarefas = useMemo(() => criarMapaTarefas(dadosTarefas), [dadosTarefas]);
  const mapaRoteiros = useMemo(() => criarMapaRoteiros(dadosRoteiros, dadosLogs), [dadosRoteiros, dadosLogs]);
  const mapaQuadro = useMemo(() => criarMapaQuadro(dadosQuadro), [dadosQuadro]);

  const chartData = useMemo(() => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const contagem = [0, 0, 0, 0, 0, 0, 0];
    escalas.forEach(e => { if (e.dia >= 0 && e.dia <= 6) contagem[e.dia]++; });
    return dias.map((d, i) => ({ dia: d, escalas: contagem[i] }));
  }, [escalas]);

  const atualizarObs = async (id: string, obs: string) => {
    if (!tentarAcao()) return;
    try {
      const esc = escalas.find(e => e.id === id);
      if (!esc) return;
      await escalasApi.update(id, { funcionarioNome: esc.func, diaSemana: esc.dia, horaInicio: esc.inicio, horaFim: esc.fim, local: esc.local, funcao: esc.funcao, observacoes: obs });
      setEscalas(prev => prev.map(e => e.id === id ? { ...e, observacoes: obs } : e));
    } catch (err) { console.error(err); }
  };

  const adicionarEscala = async () => {
    if (!tentarAcao()) return;
    if (!novaEscala.func.trim() || !novaEscala.local.trim()) return;
    try {
      const created = await escalasApi.create({
        funcionarioNome: novaEscala.func.trim(),
        diaSemana: parseInt(novaEscala.dia),
        horaInicio: novaEscala.inicio,
        horaFim: novaEscala.fim,
        local: novaEscala.local.trim(),
        funcao: novaEscala.funcao,
        observacoes: novaEscala.observacoes.trim(),
      });
      const nova: Escala = { id: (created as any).id, func: novaEscala.func.trim(), dia: parseInt(novaEscala.dia), inicio: novaEscala.inicio, fim: novaEscala.fim, local: novaEscala.local.trim(), funcao: novaEscala.funcao, observacoes: novaEscala.observacoes.trim() };
      setEscalas(prev => [...prev, nova]);
      setNovaEscala({ func: '', dia: '1', inicio: '08:00', fim: '17:00', local: '', funcao: 'Limpeza', observacoes: '' });
      setShowModal(false);
    } catch (err) { console.error(err); }
  };

  const pag = usePagination(escalas, { pageSize: 20 });

  if (loading) return <LoadingSpinner texto="Carregando escalas..." />;

  return (
    <div id="escalas-content">
      <HowItWorks
        titulo="Escala de Trabalho"
        descricao="Organize a escalas de trabalho dos funcionários por dia da semana, horário e local de atuação."
        passos={[
          'Crie escalas definindo funcionário, dia, horário e local',
          'Visualize a grade semanal completa com todos os turnos',
          'Acompanhe por funcionário: tarefas agendadas, roteiros de execução e quadro de atividades',
          'Associe cada escala a um condomínio e função específica',
          'Altere escalas conforme necessidade',
        ]}
      />

      <PageHeader
        titulo="Escala de Trabalho"
        subtitulo={`${escalas.length} escalas configuradas`}
        onCompartilhar={() => compartilharConteudo('Escalas', 'Grade de escalas')}
        onImprimir={() => imprimirElemento('escalas-content')}
        onGerarPdf={() => gerarPdfDeElemento('escalas-content', 'escalas')}
        acoes={
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={18} /> <span>Nova Escala</span>
          </button>
        }
      />

      <Card padding="md">
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Dia</th>
                <th>Horário</th>
                <th>Local</th>
                <th>Função</th>
                <th><CalendarCheck size={13} style={{verticalAlign:'middle',marginRight:4}} />Tarefas Agendadas</th>
                <th><BookOpen size={13} style={{verticalAlign:'middle',marginRight:4}} />Roteiros</th>
                <th><Columns3 size={13} style={{verticalAlign:'middle',marginRight:4}} />Quadro Atividades</th>
                <th>Observações</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {escalas.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 40 }}><EmptyState icon={<Calendar size={48} strokeWidth={1.5} />} titulo="Nenhuma escala cadastrada" descricao="Crie escala de trabalho para organizar a equipe." /></td></tr>
              ) : pag.items.map(esc => {
                const nomeKey = esc.func.toLowerCase();
                const tarefas = mapaTarefas[nomeKey] || [];
                const roteiros = mapaRoteiros[nomeKey] || [];
                const quadro = mapaQuadro[nomeKey] || [];
                return (
                <tr key={esc.id}>
                  <td className={styles.funcNome}>{esc.func}</td>
                  <td>{diaSemanaLabel(esc.dia)}</td>
                  <td>{esc.inicio} - {esc.fim}</td>
                  <td>{esc.local}</td>
                  <td>{esc.funcao}</td>
                  <td>
                    {tarefas.length === 0 ? (
                      <span className={styles.semDados}>—</span>
                    ) : (
                      <div className={styles.pillList}>
                        {tarefas.map((t, i) => (
                          <span key={i} className={`${styles.pill} ${styles[`prio_${t.prioridade}`] || ''}`} title={t.titulo}>
                            {t.titulo.length > 22 ? t.titulo.slice(0, 20) + '…' : t.titulo}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {roteiros.length === 0 ? (
                      <span className={styles.semDados}>—</span>
                    ) : (
                      <div className={styles.pillList}>
                        {roteiros.map((r, i) => (
                          <span key={i} className={`${styles.pill} ${styles.pillRoteiro}`} title={r.titulo}>
                            {r.titulo.length > 22 ? r.titulo.slice(0, 20) + '…' : r.titulo}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {quadro.length === 0 ? (
                      <span className={styles.semDados}>—</span>
                    ) : (
                      <div className={styles.pillList}>
                        {quadro.map((q, i) => (
                          <span key={i} className={`${styles.pill} ${styles[`status_${q.status}`] || ''}`} title={`${q.titulo} — ${STATUS_LABEL[q.status] || q.status}`}>
                            {q.titulo.length > 18 ? q.titulo.slice(0, 16) + '…' : q.titulo}
                            <small className={styles.pillStatus}>{STATUS_LABEL[q.status] || q.status}</small>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      className={styles.obsInput}
                      placeholder="Adicionar observação..."
                      value={esc.observacoes}
                      onChange={e => atualizarObs(esc.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <WhatsAppShare mensagem={`*Escala de Trabalho*\n*Funcionário:* ${esc.func}\n*Dia:* ${diaSemanaLabel(esc.dia)}\n*Horário:* ${esc.inicio} - ${esc.fim}\n*Local:* ${esc.local}\n*Função:* ${esc.funcao}\n*Observações:* ${esc.observacoes || 'N/A'}`} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--cor-texto)' }}>Escalas por Dia</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="dia" fontSize={12} stroke="var(--cor-texto-secundario)" />
              <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
              <Bar dataKey="escalas" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Modal aberto={showModal} onFechar={() => setShowModal(false)} titulo="Nova Escala" largura="md">
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Funcionário</label>
            <input className={styles.formInput} placeholder="Nome do funcionário" value={novaEscala.func} onChange={e => setNovaEscala(p => ({ ...p, func: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dia da Semana</label>
            <select className={styles.formSelect} value={novaEscala.dia} onChange={e => setNovaEscala(p => ({ ...p, dia: e.target.value }))}>
              <option value="1">Segunda</option>
              <option value="2">Terça</option>
              <option value="3">Quarta</option>
              <option value="4">Quinta</option>
              <option value="5">Sexta</option>
              <option value="6">Sábado</option>
              <option value="0">Domingo</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Início</label>
            <input type="time" className={styles.formInput} value={novaEscala.inicio} onChange={e => setNovaEscala(p => ({ ...p, inicio: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fim</label>
            <input type="time" className={styles.formInput} value={novaEscala.fim} onChange={e => setNovaEscala(p => ({ ...p, fim: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Local</label>
            <input className={styles.formInput} placeholder="Ex: Cond. Aurora - Bloco A" value={novaEscala.local} onChange={e => setNovaEscala(p => ({ ...p, local: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Função</label>
            <select className={styles.formSelect} value={novaEscala.funcao} onChange={e => setNovaEscala(p => ({ ...p, funcao: e.target.value }))}>
              <option value="Limpeza">Limpeza</option>
              <option value="Limpeza Geral">Limpeza Geral</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Jardinagem">Jardinagem</option>
              <option value="Portaria">Portaria</option>
            </select>
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Observações</label>
            <input className={styles.formInput} placeholder="Observaçõe opcionais..." value={novaEscala.observacoes} onChange={e => setNovaEscala(p => ({ ...p, observacoes: e.target.value }))} />
          </div>
          <button className={styles.formSubmit} onClick={adicionarEscala}>
            <Plus size={18} /> Adicionar Escala
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default EscalasPage;
