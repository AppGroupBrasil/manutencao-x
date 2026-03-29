import React, { useState, useMemo, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import { usePagination } from '../../hooks/usePagination';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { fornecedores as fornecedoresApi, condominios as condominiosApi } from '../../services/api';
import {
  Plus, Search, Building2, Phone, Mail, MapPin, Star, FileText,
  Edit, Trash2, Award, Calendar, DollarSign, User
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './Fornecedores.module.css';

const TIPOS = [
  { value: 'prestador', label: 'Prestador de Serviço' },
  { value: 'fabricante', label: 'Fabricante' },
  { value: 'distribuidor', label: 'Distribuidor' },
  { value: 'assistencia_tecnica', label: 'Assistência Técnica' },
];

const STATUS_MAP: Record<string, { label: string; classe: string }> = {
  ativo: { label: 'Ativo', classe: styles.statusAtivo },
  inativo: { label: 'Inativo', classe: styles.statusInativo },
  bloqueado: { label: 'Bloqueado', classe: styles.statusBloqueado },
};

const CORES = ['#1a73e8', '#f57c00', '#d32f2f', '#00897b', '#7b1fa2'];

const FORM_INICIAL = {
  nome: '', cnpj: '', tipo: 'prestador', especialidade: '', telefone: '', email: '',
  endereco: '', cidade: '', estado: '', contatoNome: '', contatoTelefone: '', contatoEmail: '',
  observacoes: '', valorContrato: '', dataInicioContrato: '', dataFimContrato: '', status: 'ativo', condominioId: '',
};

const RenderStars: React.FC<{ nota: number; onClick?: (n: number) => void }> = ({ nota, onClick }) => (
  <div className={styles.stars}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={16}
        className={n <= Math.round(nota) ? styles.starFilled : styles.starEmpty}
        fill={n <= Math.round(nota) ? '#f9a825' : 'none'}
        style={onClick ? { cursor: 'pointer' } : undefined}
        onClick={() => onClick?.(n)}
      />
    ))}
  </div>
);

const FornecedoresPage: React.FC = () => {
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const ehGestor = roleNivel >= 2;

  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCondo, setFiltroCondo] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);

  // Avaliações
  const [showAval, setShowAval] = useState(false);
  const [avalForn, setAvalForn] = useState<any | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [showNovaAval, setShowNovaAval] = useState(false);
  const [avalForm, setAvalForm] = useState({ nota: 5, comentario: '' });

  useEffect(() => {
    Promise.all([
      fornecedoresApi.list(),
      condominiosApi.list().catch(() => []),
    ]).then(([forns, conds]) => {
      setFornecedores(forns as any[]);
      setCondominiosList(conds as any[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    let lista = fornecedores;
    if (filtroTipo !== 'todos') lista = lista.filter(f => f.tipo === filtroTipo);
    if (filtroStatus !== 'todos') lista = lista.filter(f => f.status === filtroStatus);
    if (filtroCondo !== 'todos') lista = lista.filter(f => f.condominioId === filtroCondo);
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(f => {
        const texto = `${f.nome} ${f.cnpj} ${f.especialidade} ${f.condominioNome}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }
    return lista;
  }, [fornecedores, filtroTipo, filtroStatus, filtroCondo, busca]);

  const chartTipo = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach(f => {
      const t = TIPOS.find(tp => tp.value === f.tipo)?.label || f.tipo;
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor }));
  }, [filtrados]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_INICIAL, condominioId: condominiosList[0]?.id || '' });
    setShowModal(true);
  };

  const abrirEditar = (f: any) => {
    setEditando(f);
    setForm({
      nome: f.nome || '', cnpj: f.cnpj || '', tipo: f.tipo || 'prestador',
      especialidade: f.especialidade || '', telefone: f.telefone || '', email: f.email || '',
      endereco: f.endereco || '', cidade: f.cidade || '', estado: f.estado || '',
      contatoNome: f.contatoNome || '', contatoTelefone: f.contatoTelefone || '',
      contatoEmail: f.contatoEmail || '', observacoes: f.observacoes || '',
      valorContrato: f.valorContrato?.toString() || '', dataInicioContrato: f.dataInicioContrato?.split('T')[0] || '',
      dataFimContrato: f.dataFimContrato?.split('T')[0] || '', status: f.status || 'ativo',
      condominioId: f.condominioId || '',
    });
    setShowModal(true);
  };

  const salvar = async () => {
    if (!tentarAcao()) return;
    if (!form.nome.trim() || !form.condominioId) return;
    try {
      const payload = { ...form, valorContrato: form.valorContrato ? parseFloat(form.valorContrato) : null };
      if (editando) {
        const atualizado = await fornecedoresApi.update(editando.id, payload);
        setFornecedores(prev => prev.map(f => f.id === editando.id ? atualizado : f));
      } else {
        const criado = await fornecedoresApi.create(payload);
        setFornecedores(prev => [...prev, criado]);
      }
      setShowModal(false);
    } catch (err) { console.error(err); }
  };

  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    if (!confirm('Excluir este fornecedor?')) return;
    try {
      await fornecedoresApi.remove(id);
      setFornecedores(prev => prev.filter(f => f.id !== id));
    } catch (err) { console.error(err); }
  };

  const abrirAvaliacoes = async (f: any) => {
    setAvalForn(f);
    try {
      const rows = await fornecedoresApi.listAvaliacoes(f.id);
      setAvaliacoes(rows);
    } catch { setAvaliacoes([]); }
    setShowAval(true);
  };

  const salvarAvaliacao = async () => {
    if (!tentarAcao() || !avalForn) return;
    try {
      const novo = await fornecedoresApi.addAvaliacao(avalForn.id, avalForm);
      setAvaliacoes(prev => [novo, ...prev]);
      // Atualizar média exibida
      const media = avaliacoes.length > 0
        ? ([...avaliacoes, novo].reduce((a, b) => a + b.nota, 0) / ([...avaliacoes, novo].length))
        : avalForm.nota;
      setFornecedores(prev => prev.map(f => f.id === avalForn.id ? { ...f, avaliacaoMedia: media, totalServicos: (f.totalServicos || 0) + 1 } : f));
      setShowNovaAval(false);
      setAvalForm({ nota: 5, comentario: '' });
    } catch (err) { console.error(err); }
  };

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando fornecedores..." />;

  return (
    <div id="fornecedores-content">
      <HowItWorks
        titulo="Gestão de Fornecedores"
        descricao="Cadastre e avalie empresas prestadoras de serviço."
        passos={[
          'Registre fornecedores com dados de contato e contrato',
          'Classifique por tipo (prestador, fabricante, assistência técnica)',
          'Avalie cada serviço prestado com nota de 1 a 5 estrelas',
          'Acompanhe contratos, valores e desempenho',
        ]}
      />

      <PageHeader
        titulo="Fornecedores"
        subtitulo={`${filtrados.length} fornecedor${filtrados.length !== 1 ? 'es' : ''}`}
        onCompartilhar={() => compartilharConteudo('Fornecedores', `Total: ${filtrados.length}`)}
        onImprimir={() => imprimirElemento('fornecedores-content')}
        onGerarPdf={() => gerarPdfDeElemento('fornecedores-content', 'fornecedores')}
        acoes={ehGestor ? (
          <button className={styles.btnPrimary} onClick={abrirNovo}>
            <Plus size={16} /> Novo Fornecedor
          </button>
        ) : undefined}
      />

      <div className={styles.filterBar}>
        <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)}>
          <option value="todos">Todos os Condomínios</option>
          {condominiosList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os Tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos Status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input placeholder="Buscar fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className={styles.grid}>
        {pag.items.map((f: any) => (
          <div className={styles.card} key={f.id}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{f.nome}</h3>
                <span className={styles.cardSub}>{TIPOS.find(t => t.value === f.tipo)?.label} {f.cnpj ? `• ${f.cnpj}` : ''}</span>
              </div>
              <span className={`${styles.statusBadge} ${STATUS_MAP[f.status]?.classe || ''}`}>
                {STATUS_MAP[f.status]?.label || f.status}
              </span>
            </div>
            <div className={styles.cardBody}>
              {f.especialidade && <div className={styles.cardRow}><FileText size={13} /> {f.especialidade}</div>}
              {f.telefone && <div className={styles.cardRow}><Phone size={13} /> {f.telefone}</div>}
              {f.email && <div className={styles.cardRow}><Mail size={13} /> {f.email}</div>}
              {f.cidade && <div className={styles.cardRow}><MapPin size={13} /> {f.cidade}{f.estado ? `/${f.estado}` : ''}</div>}
              <div className={styles.cardRow}><Building2 size={13} /> {f.condominioNome}</div>
              <div className={styles.cardRow}>
                <RenderStars nota={f.avaliacaoMedia || 0} />
                <span style={{ fontSize: 11, marginLeft: 4 }}>({f.totalServicos || 0} avaliações)</span>
              </div>
              {(f.valorContrato || f.dataFimContrato) && (
                <div className={styles.contractInfo}>
                  {f.valorContrato && <span><DollarSign size={12} style={{ display: 'inline' }} /> R$ {Number(f.valorContrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                  {f.dataFimContrato && (
                    <span>
                      <Calendar size={12} style={{ display: 'inline' }} /> Contrato até {new Date(f.dataFimContrato).toLocaleDateString('pt-BR')}
                      {new Date(f.dataFimContrato) < new Date() && <span style={{ color: '#d32f2f', fontWeight: 600, marginLeft: 4 }}>VENCIDO</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.cardActions}>
              <button className={styles.btnSm} onClick={() => abrirAvaliacoes(f)}><Award size={14} /> Avaliações</button>
              {ehGestor && <button className={styles.btnSm} onClick={() => abrirEditar(f)}><Edit size={14} /> Editar</button>}
              {ehGestor && <button className={styles.btnDanger} onClick={() => excluir(f.id)}><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {ehGestor && filtrados.length > 0 && (
        <div className={styles.charts}>
          <Card>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartTipo} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ nome, valor }) => `${nome}: ${valor}`}>
                  {chartTipo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <Modal aberto={showModal} titulo={editando ? 'Editar Fornecedor' : 'Novo Fornecedor'} onFechar={() => setShowModal(false)}>
          <div className={styles.formGrid}>
            <label>Nome da Empresa *
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: ElevaTech Ltda" />
            </label>
            <label>CNPJ
              <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </label>
            <label>Tipo *
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label>Especialidade
              <input value={form.especialidade} onChange={e => setForm({ ...form, especialidade: e.target.value })} placeholder="Ex: Elevadores, Bombas, HVAC" />
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
                <option value="bloqueado">Bloqueado</option>
              </select>
            </label>
            <label>Telefone
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
            </label>
            <label>E-mail
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>Cidade
              <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
            </label>
            <label>Estado
              <input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} maxLength={2} placeholder="SP" />
            </label>
            <label className={styles.fullWidth}>Endereço
              <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
            </label>

            <div className={styles.fullWidth} style={{ borderTop: '1px solid var(--cor-borda)', paddingTop: 12, marginTop: 4 }}>
              <strong style={{ fontSize: 13 }}>Contato Principal</strong>
            </div>
            <label>Nome do Contato
              <input value={form.contatoNome} onChange={e => setForm({ ...form, contatoNome: e.target.value })} />
            </label>
            <label>Telefone Contato
              <input value={form.contatoTelefone} onChange={e => setForm({ ...form, contatoTelefone: e.target.value })} />
            </label>
            <label>E-mail Contato
              <input type="email" value={form.contatoEmail} onChange={e => setForm({ ...form, contatoEmail: e.target.value })} />
            </label>

            <div className={styles.fullWidth} style={{ borderTop: '1px solid var(--cor-borda)', paddingTop: 12, marginTop: 4 }}>
              <strong style={{ fontSize: 13 }}>Dados do Contrato</strong>
            </div>
            <label>Valor do Contrato (R$)
              <input type="number" step="0.01" value={form.valorContrato} onChange={e => setForm({ ...form, valorContrato: e.target.value })} />
            </label>
            <label>Início do Contrato
              <input type="date" value={form.dataInicioContrato} onChange={e => setForm({ ...form, dataInicioContrato: e.target.value })} />
            </label>
            <label>Fim do Contrato
              <input type="date" value={form.dataFimContrato} onChange={e => setForm({ ...form, dataFimContrato: e.target.value })} />
            </label>

            <label className={styles.fullWidth}>Observações
              <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className={styles.btnSm} onClick={() => setShowModal(false)}>Cancelar</button>
            <button className={styles.btnPrimary} onClick={salvar}>{editando ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </Modal>
      )}

      {/* Modal Avaliações */}
      {showAval && avalForn && (
        <Modal aberto={showAval} titulo={`Avaliações — ${avalForn.nome}`} onFechar={() => { setShowAval(false); setShowNovaAval(false); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <RenderStars nota={avalForn.avaliacaoMedia || 0} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{Number(avalForn.avaliacaoMedia || 0).toFixed(1)} ({avalForn.totalServicos || 0})</span>
          </div>

          {ehGestor && !showNovaAval && (
            <button className={styles.btnPrimary} onClick={() => setShowNovaAval(true)} style={{ marginBottom: 12 }}>
              <Plus size={14} /> Nova Avaliação
            </button>
          )}

          {showNovaAval && (
            <div style={{ padding: 12, border: '1.5px solid var(--cor-borda)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500 }}>Nota:</span>
                <RenderStars nota={avalForm.nota} onClick={n => setAvalForm({ ...avalForm, nota: n })} />
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                Comentário
                <textarea
                  value={avalForm.comentario}
                  onChange={e => setAvalForm({ ...avalForm, comentario: e.target.value })}
                  style={{ padding: 8, border: '1.5px solid var(--cor-borda)', borderRadius: 8, background: 'var(--cor-fundo)', minHeight: 60, fontSize: 13 }}
                  placeholder="Descreva a experiência com o fornecedor..."
                />
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className={styles.btnSm} onClick={() => setShowNovaAval(false)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={salvarAvaliacao}>Salvar</button>
              </div>
            </div>
          )}

          <div className={styles.avalList}>
            {avaliacoes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--cor-texto-secundario)', padding: 20 }}>Nenhuma avaliação</p>}
            {avaliacoes.map(a => (
              <div className={styles.avalItem} key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <RenderStars nota={a.nota} />
                  <span style={{ fontSize: 11, color: 'var(--cor-texto-secundario)' }}>{new Date(a.criadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
                {a.comentario && <p>{a.comentario}</p>}
                {a.avaliadorNome && <p style={{ fontStyle: 'italic' }}>Por: {a.avaliadorNome}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FornecedoresPage;
