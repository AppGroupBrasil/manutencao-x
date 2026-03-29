import React, { useState, useMemo, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import StatusBadge from '../../components/Common/StatusBadge';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDemo } from '../../contexts/DemoContext';
import { usePagination } from '../../hooks/usePagination';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { equipamentos as equipamentosApi, condominios as condominiosApi, fornecedores as fornecedoresApi } from '../../services/api';
import {
  Plus, Search, Cpu, MapPin, Calendar, Wrench, Building2, Star, Tag,
  History, Edit, Trash2, Shield, Zap, Droplets, Flame, Monitor, CircuitBoard
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import styles from './Equipamentos.module.css';

interface CondominioOption {
  id: string;
  nome: string;
}

interface FornecedorOption {
  id: string;
  nome: string;
}

interface HistoricoEquipamento {
  id: string;
  tipo: string;
  descricao: string;
  dataServico?: string;
  custo?: number;
  fornecedorNome?: string;
  tecnico?: string;
  observacoes?: string;
}

interface EquipamentoItem {
  id: string;
  nome: string;
  codigo?: string;
  categoria: string;
  status: string;
  marca?: string;
  modelo?: string;
  localizacao?: string;
  andar?: string;
  dataGarantia?: string;
  fornecedorNome?: string;
  condominioId: string;
  condominioNome?: string;
  descricao?: string;
  numeroSerie?: string;
  dataInstalacao?: string;
  vidaUtilAnos?: number;
  potencia?: string;
  fabricante?: string;
  fornecedorId?: string;
  manualUrl?: string;
  fotoUrl?: string;
  observacoes?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const CATEGORIAS = [
  { value: 'elevador', label: 'Elevador', icon: <Cpu size={14} /> },
  { value: 'bomba', label: 'Bomba', icon: <Droplets size={14} /> },
  { value: 'gerador', label: 'Gerador', icon: <Zap size={14} /> },
  { value: 'hvac', label: 'HVAC / Ar-Cond.', icon: <CircuitBoard size={14} /> },
  { value: 'eletrico', label: 'Elétrico', icon: <Zap size={14} /> },
  { value: 'hidraulico', label: 'Hidráulico', icon: <Droplets size={14} /> },
  { value: 'incendio', label: 'Incêndio', icon: <Flame size={14} /> },
  { value: 'seguranca', label: 'Segurança', icon: <Shield size={14} /> },
  { value: 'piscina', label: 'Piscina', icon: <Droplets size={14} /> },
  { value: 'portao', label: 'Portão', icon: <Monitor size={14} /> },
  { value: 'interfone', label: 'Interfone', icon: <Monitor size={14} /> },
  { value: 'cftv', label: 'CFTV', icon: <Monitor size={14} /> },
  { value: 'outro', label: 'Outro', icon: <Wrench size={14} /> },
];

const STATUS_MAP: Record<string, { label: string; classe: string }> = {
  ativo: { label: 'Ativo', classe: styles.statusAtivo },
  inativo: { label: 'Inativo', classe: styles.statusInativo },
  manutencao: { label: 'Manutenção', classe: styles.statusManutencao },
  descartado: { label: 'Descartado', classe: styles.statusDescartado },
};

const CORES = ['#1a73e8', '#f57c00', '#d32f2f', '#00897b', '#7b1fa2', '#455a64', '#c2185b', '#5d4037', '#0097a7', '#689f38', '#8e24aa', '#f44336', '#ff9800'];

const FORM_INICIAL = {
  nome: '', descricao: '', categoria: 'outro', marca: '', modelo: '',
  numeroSerie: '', localizacao: '', andar: '', dataInstalacao: '',
  dataGarantia: '', vidaUtilAnos: '', potencia: '', fabricante: '',
  fornecedorId: '', manualUrl: '', fotoUrl: '', status: 'ativo',
  observacoes: '', condominioId: '',
};

const EquipamentosPage: React.FC = () => {
  const { roleNivel } = usePermissions();
  const { usuario } = useAuth();
  const { tentarAcao } = useDemo();
  const ehGestor = roleNivel >= 2;

  const [equipamentos, setEquipamentos] = useState<EquipamentoItem[]>([]);
  const [condominiosList, setCondominiosList] = useState<CondominioOption[]>([]);
  const [fornecedoresList, setFornecedoresList] = useState<FornecedorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCondo, setFiltroCondo] = useState('todos');

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<EquipamentoItem | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [showHistorico, setShowHistorico] = useState(false);
  const [histEquip, setHistEquip] = useState<EquipamentoItem | null>(null);
  const [historico, setHistorico] = useState<HistoricoEquipamento[]>([]);
  const [showHistForm, setShowHistForm] = useState(false);
  const [histForm, setHistForm] = useState({ tipo: 'manutencao', descricao: '', dataServico: '', custo: '', fornecedorId: '', tecnico: '', observacoes: '' });

  useEffect(() => {
    setErro(null);
    Promise.all([
      equipamentosApi.list(),
      condominiosApi.list().catch(() => []),
      fornecedoresApi.list().catch(() => []),
    ]).then(([eqs, conds, forns]) => {
      setEquipamentos(eqs as EquipamentoItem[]);
      setCondominiosList(conds as CondominioOption[]);
      setFornecedoresList(forns as FornecedorOption[]);
    }).catch(error => {
      setEquipamentos([]);
      setCondominiosList([]);
      setFornecedoresList([]);
      setErro(getErrorMessage(error, 'Não foi possível carregar equipamentos.'));
    }).finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    let lista = equipamentos;
    if (filtroCat !== 'todos') lista = lista.filter(e => e.categoria === filtroCat);
    if (filtroStatus !== 'todos') lista = lista.filter(e => e.status === filtroStatus);
    if (filtroCondo !== 'todos') lista = lista.filter(e => e.condominioId === filtroCondo);
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(e => {
        const texto = `${e.nome} ${e.codigo} ${e.marca} ${e.modelo} ${e.localizacao} ${e.condominioNome}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }
    return lista;
  }, [equipamentos, filtroCat, filtroStatus, filtroCondo, busca]);

  const chartCat = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach(e => {
      const cat = CATEGORIAS.find(c => c.value === e.categoria)?.label || e.categoria;
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor }));
  }, [filtrados]);

  const chartStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach(e => {
      const s = STATUS_MAP[e.status]?.label || e.status;
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor }));
  }, [filtrados]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_INICIAL, condominioId: condominiosList[0]?.id || '' });
    setShowModal(true);
  };

  const abrirEditar = (eq: EquipamentoItem) => {
    setEditando(eq);
    setForm({
      nome: eq.nome || '', descricao: eq.descricao || '', categoria: eq.categoria || 'outro',
      marca: eq.marca || '', modelo: eq.modelo || '', numeroSerie: eq.numeroSerie || '',
      localizacao: eq.localizacao || '', andar: eq.andar || '',
      dataInstalacao: eq.dataInstalacao?.split('T')[0] || '', dataGarantia: eq.dataGarantia?.split('T')[0] || '',
      vidaUtilAnos: eq.vidaUtilAnos?.toString() || '', potencia: eq.potencia || '',
      fabricante: eq.fabricante || '', fornecedorId: eq.fornecedorId || '',
      manualUrl: eq.manualUrl || '', fotoUrl: eq.fotoUrl || '',
      status: eq.status || 'ativo', observacoes: eq.observacoes || '',
      condominioId: eq.condominioId || '',
    });
    setShowModal(true);
  };

  const salvar = async () => {
    if (!tentarAcao()) return;
    if (!form.nome.trim() || !form.condominioId) return;
    try {
      if (editando) {
        const atualizado = await equipamentosApi.update(editando.id, form);
        setEquipamentos(prev => prev.map(e => e.id === editando.id ? atualizado as EquipamentoItem : e));
      } else {
        const criado = await equipamentosApi.create(form);
        setEquipamentos(prev => [...prev, criado as EquipamentoItem]);
      }
      setErro(null);
      setShowModal(false);
    } catch (error) {
      setErro(getErrorMessage(error, 'Não foi possível salvar o equipamento.'));
    }
  };

  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    if (!confirm('Excluir este equipamento?')) return;
    try {
      await equipamentosApi.remove(id);
      setEquipamentos(prev => prev.filter(e => e.id !== id));
      setErro(null);
    } catch (error) {
      setErro(getErrorMessage(error, 'Não foi possível excluir o equipamento.'));
    }
  };

  const abrirHistorico = async (eq: EquipamentoItem) => {
    setHistEquip(eq);
    try {
      const rows = await equipamentosApi.listHistorico(eq.id);
      setHistorico(rows as HistoricoEquipamento[]);
      setErro(null);
    } catch (error) {
      setHistorico([]);
      setErro(getErrorMessage(error, 'Não foi possível carregar o histórico do equipamento.'));
    }
    setShowHistorico(true);
  };

  const salvarHistorico = async () => {
    if (!tentarAcao() || !histEquip) return;
    if (!histForm.descricao.trim()) return;
    try {
      const novo = await equipamentosApi.addHistorico(histEquip.id, {
        ...histForm,
        custo: histForm.custo ? parseFloat(histForm.custo) : 0,
        fornecedorNome: fornecedoresList.find(f => f.id === histForm.fornecedorId)?.nome || '',
      });
      setHistorico(prev => [novo as HistoricoEquipamento, ...prev]);
      setShowHistForm(false);
      setHistForm({ tipo: 'manutencao', descricao: '', dataServico: '', custo: '', fornecedorId: '', tecnico: '', observacoes: '' });
      setErro(null);
    } catch (error) {
      setErro(getErrorMessage(error, 'Não foi possível registrar o histórico do equipamento.'));
    }
  };

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando equipamentos..." />;

  return (
    <div id="equipamentos-content">
      <HowItWorks
        titulo="Cadastro de Equipamentos"
        descricao="Gerencie todos os equipamentos e ativos do condomínio."
        passos={[
          'Cadastre equipamentos com dados técnicos (marca, modelo, série)',
          'Vincule ao condomínio, fornecedor e QR Code',
          'Acompanhe o histórico completo de manutenções',
          'Monitore garantias, vida útil e status operacional',
        ]}
      />

      <PageHeader
        titulo="Equipamentos"
        subtitulo={`${filtrados.length} equipamento${filtrados.length !== 1 ? 's' : ''} cadastrado${filtrados.length !== 1 ? 's' : ''}`}
        onCompartilhar={() => compartilharConteudo('Equipamentos', `Total: ${filtrados.length}`)}
        onImprimir={() => imprimirElemento('equipamentos-content')}
        onGerarPdf={() => gerarPdfDeElemento('equipamentos-content', 'equipamentos')}
        acoes={ehGestor ? (
          <button className={styles.btnPrimary} onClick={abrirNovo}>
            <Plus size={16} /> Novo Equipamento
          </button>
        ) : undefined}
      />

      {erro && (
        <Card padding="md" style={{ marginBottom: 16, border: '1px solid rgba(211,47,47,0.2)', background: 'rgba(211,47,47,0.05)' }}>
          <div style={{ color: '#b71c1c', fontWeight: 600 }}>{erro}</div>
        </Card>
      )}

      {/* Filtros */}
      <div className={styles.filterBar}>
        <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)}>
          <option value="todos">Todos os Condomínios</option>
          {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="todos">Todas Categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="manutencao">Manutenção</option>
          <option value="descartado">Descartado</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input
            placeholder="Buscar equipamento..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Grid de Cards */}
      <div className={styles.grid}>
        {pag.items.map(eq => (
          <div className={styles.card} key={eq.id}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{eq.nome}</h3>
                <span className={styles.cardCode}>{eq.codigo}</span>
              </div>
              <span className={`${styles.statusBadge} ${STATUS_MAP[eq.status]?.classe || ''}`}>
                {STATUS_MAP[eq.status]?.label || eq.status}
              </span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardRow}>
                <Tag size={13} /> {CATEGORIAS.find(c => c.value === eq.categoria)?.label || eq.categoria}
              </div>
              {eq.marca && <div className={styles.cardRow}><Wrench size={13} /> {eq.marca} {eq.modelo || ''}</div>}
              {eq.localizacao && <div className={styles.cardRow}><MapPin size={13} /> {eq.localizacao}{eq.andar ? ` — ${eq.andar}º andar` : ''}</div>}
              <div className={styles.cardRow}><Building2 size={13} /> {eq.condominioNome}</div>
              {eq.dataGarantia && (
                <div className={styles.cardRow}>
                  <Calendar size={13} />
                  Garantia até {new Date(eq.dataGarantia).toLocaleDateString('pt-BR')}
                  {new Date(eq.dataGarantia) < new Date() && <span style={{ color: '#d32f2f', fontWeight: 600, marginLeft: 4 }}>EXPIRADA</span>}
                </div>
              )}
              {eq.fornecedorNome && <div className={styles.cardRow}><Star size={13} /> {eq.fornecedorNome}</div>}
            </div>
            <div className={styles.cardActions}>
              <button className={styles.btnSm} onClick={() => abrirHistorico(eq)}><History size={14} /> Histórico</button>
              {ehGestor && <button className={styles.btnSm} onClick={() => abrirEditar(eq)}><Edit size={14} /> Editar</button>}
              {ehGestor && <button className={styles.btnDanger} onClick={() => excluir(eq.id)}><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {/* Charts */}
      {ehGestor && filtrados.length > 0 && (
        <div className={styles.charts}>
          <Card>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartCat} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ nome, valor }) => `${nome}: ${valor}`}>
                  {chartCat.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="valor" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <Modal aberto={showModal} titulo={editando ? 'Editar Equipamento' : 'Novo Equipamento'} onFechar={() => setShowModal(false)}>
          <div className={styles.formGrid}>
            <label>Nome *
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Elevador Social 1" />
            </label>
            <label>Categoria *
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Condomínio *
              <select value={form.condominioId} onChange={e => setForm({ ...form, condominioId: e.target.value })}>
                <option value="">Selecione...</option>
                {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="manutencao">Em Manutenção</option>
                <option value="descartado">Descartado</option>
              </select>
            </label>
            <label>Marca
              <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Ex: Otis" />
            </label>
            <label>Modelo
              <input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: Gen2" />
            </label>
            <label>Nº Série
              <input value={form.numeroSerie} onChange={e => setForm({ ...form, numeroSerie: e.target.value })} />
            </label>
            <label>Potência
              <input value={form.potencia} onChange={e => setForm({ ...form, potencia: e.target.value })} placeholder="Ex: 5 CV" />
            </label>
            <label>Localização
              <input value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex: Casa de Máquinas" />
            </label>
            <label>Andar
              <input value={form.andar} onChange={e => setForm({ ...form, andar: e.target.value })} placeholder="Ex: Cobertura" />
            </label>
            <label>Data Instalação
              <input type="date" value={form.dataInstalacao} onChange={e => setForm({ ...form, dataInstalacao: e.target.value })} />
            </label>
            <label>Data Garantia
              <input type="date" value={form.dataGarantia} onChange={e => setForm({ ...form, dataGarantia: e.target.value })} />
            </label>
            <label>Vida Útil (anos)
              <input type="number" value={form.vidaUtilAnos} onChange={e => setForm({ ...form, vidaUtilAnos: e.target.value })} />
            </label>
            <label>Fabricante
              <input value={form.fabricante} onChange={e => setForm({ ...form, fabricante: e.target.value })} />
            </label>
            <label>Fornecedor
              <select value={form.fornecedorId} onChange={e => setForm({ ...form, fornecedorId: e.target.value })}>
                <option value="">Nenhum</option>
                {fornecedoresList.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
            <label className={styles.fullWidth}>Descrição
              <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes técnicos..." />
            </label>
            <label className={styles.fullWidth}>Observações
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className={styles.btnSm} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvar}>{editando ? 'Salvar Alterações' : 'Cadastrar'}</button>
          </div>
        </Modal>
      )}

      {/* Modal Histórico de Manutenção */}
      {showHistorico && histEquip && (
        <Modal aberto={showHistorico} titulo={`Histórico — ${histEquip.nome}`} onFechar={() => { setShowHistorico(false); setShowHistForm(false); }}>
          {ehGestor && !showHistForm && (
            <button className={styles.btnPrimary} onClick={() => setShowHistForm(true)} style={{ marginBottom: 12 }}>
              <Plus size={14} /> Registrar Manutenção
            </button>
          )}

          {showHistForm && (
            <div className={styles.formGrid} style={{ marginBottom: 16, padding: 12, border: '1.5px solid var(--cor-borda)', borderRadius: 10 }}>
              <label>Tipo
                <select value={histForm.tipo} onChange={e => setHistForm({ ...histForm, tipo: e.target.value })}>
                  <option value="manutencao">Manutenção</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                  <option value="troca">Troca de Peça</option>
                  <option value="inspecao">Inspeção</option>
                </select>
              </label>
              <label>Data
                <input type="date" value={histForm.dataServico} onChange={e => setHistForm({ ...histForm, dataServico: e.target.value })} />
              </label>
              <label>Custo (R$)
                <input type="number" step="0.01" value={histForm.custo} onChange={e => setHistForm({ ...histForm, custo: e.target.value })} />
              </label>
              <label>Técnico
                <input value={histForm.tecnico} onChange={e => setHistForm({ ...histForm, tecnico: e.target.value })} />
              </label>
              <label>Fornecedor
                <select value={histForm.fornecedorId} onChange={e => setHistForm({ ...histForm, fornecedorId: e.target.value })}>
                  <option value="">Nenhum</option>
                  {fornecedoresList.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </label>
              <label className={styles.fullWidth}>Descrição *
                <textarea value={histForm.descricao} onChange={e => setHistForm({ ...histForm, descricao: e.target.value })} placeholder="O que foi feito..." />
              </label>
              <div className={styles.fullWidth} style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className={styles.btnSm} onClick={() => setShowHistForm(false)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={salvarHistorico}>Salvar</button>
              </div>
            </div>
          )}

          <div className={styles.historicoList}>
            {historico.length === 0 && <p style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: 20 }}>Nenhum registro de manutenção</p>}
            {historico.map(h => (
              <div className={styles.historicoItem} key={h.id}>
                <h4>{h.tipo?.toUpperCase()} — {h.dataServico ? new Date(h.dataServico).toLocaleDateString('pt-BR') : 'Sem data'}</h4>
                <p>{h.descricao}</p>
                {h.tecnico && <p>Técnico: {h.tecnico}</p>}
                {h.fornecedorNome && <p>Fornecedor: {h.fornecedorNome}</p>}
                {typeof h.custo === 'number' && h.custo > 0 && <p style={{ fontWeight: 600 }}>Custo: R$ {Number(h.custo).toFixed(2)}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EquipamentosPage;
