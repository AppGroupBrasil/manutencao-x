import React, { useState, useEffect, useRef } from 'react';
import { validarImagem } from '../../utils/imageUtils';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { Plus, Building2, MapPin, Phone, Mail, Users, Home, X, Pencil, Trash2, Upload, Image, Shield, ShieldOff, Clock, CreditCard, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { useAuth } from '../../contexts/AuthContext';
import { condominios as condominiosApi } from '../../services/api';
import styles from './Condominios.module.css';

interface Condominio {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  blocos: number;
  unidades: number;
  sindico: string;
  telefone: string;
  email: string;
  logoUrl?: string;
  loginTitulo?: string;
  loginSubtitulo?: string;
  // campos master
  ativo?: boolean;
  plano?: string;
  status_plano?: string;
  data_fim_teste?: string;
  valor_mensalidade?: number;
  administrador_nome?: string;
  criado_em?: string;
}

const formVazio = (): Omit<Condominio, 'id'> => ({
  nome: '', endereco: '', cidade: '', blocos: 0, unidades: 0, sindico: '', telefone: '', email: '',
  logoUrl: undefined, loginTitulo: undefined, loginSubtitulo: undefined,
});

const CondominiosPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const { usuario } = useAuth();
  const isMaster = usuario?.role === 'master';
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<Omit<Condominio, 'id'>>(formVazio());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // master: status modal
  const [statusModal, setStatusModal] = useState<Condominio | null>(null);
  const [statusForm, setStatusForm] = useState({ plano: '', status_plano: '', ativo: true, data_fim_teste: '', valor_mensalidade: 0 });
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    condominiosApi.list()
      .then(rows => setCondominios(rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        endereco: r.endereco || '',
        cidade: r.cidade || '',
        blocos: r.blocos || 0,
        unidades: r.unidades || 0,
        sindico: r.sindico || '',
        telefone: r.telefone || '',
        email: r.email || '',
        ativo: r.ativo,
        plano: r.plano,
        status_plano: r.status_plano,
        data_fim_teste: r.data_fim_teste,
        valor_mensalidade: r.valor_mensalidade ? Number(r.valor_mensalidade) : undefined,
        administrador_nome: r.administrador_nome,
        criado_em: r.criado_em,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = condominios.map(c => ({
    nome: c.nome.replace('Condomínio ', '').replace('Residencial ', '').replace('Edifício ', ''),
    unidades: c.unidades,
  }));

  const abrirNovo = () => {
    if (!tentarAcao()) return;
    setForm(formVazio());
    setEditandoId(null);
    setModalAberto(true);
  };

  const abrirEditar = (cond: Condominio) => {
    if (!tentarAcao()) return;
    const { id, ...rest } = cond;
    setForm(rest);
    setEditandoId(id);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditandoId(null);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return;
    try {
      if (editandoId) {
        await condominiosApi.update(editandoId, form as any);
        setCondominios(prev => prev.map(c => c.id === editandoId ? { ...form, id: editandoId } : c));
      } else {
        const novo = await condominiosApi.create(form as any);
        setCondominios(prev => [...prev, { ...form, id: (novo as any).id }]);
      }
    } catch { alert('Erro ao salvar'); }
    fecharModal();
  };

  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    try { await condominiosApi.remove(id); } catch { alert('Erro ao excluir'); }
    setCondominios(prev => prev.filter(c => c.id !== id));
    setConfirmDelete(null);
  };

  const setField = (key: keyof Omit<Condominio, 'id'>, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Master: abrir modal de status
  const abrirStatusModal = (cond: Condominio) => {
    setStatusModal(cond);
    setStatusForm({
      plano: cond.plano || 'teste',
      status_plano: cond.status_plano || 'teste',
      ativo: cond.ativo !== false,
      data_fim_teste: cond.data_fim_teste ? cond.data_fim_teste.slice(0, 10) : '',
      valor_mensalidade: cond.valor_mensalidade || 0,
    });
  };

  const salvarStatus = async () => {
    if (!statusModal) return;
    try {
      await condominiosApi.patchStatus(statusModal.id, statusForm);
      setCondominios(prev => prev.map(c =>
        c.id === statusModal.id ? { ...c, ...statusForm } : c
      ));
      setStatusModal(null);
    } catch { alert('Erro ao atualizar status'); }
  };

  const toggleBloquear = async (cond: Condominio) => {
    const novoStatus = cond.status_plano === 'bloqueado' ? 'ativo' : 'bloqueado';
    const novoAtivo = novoStatus !== 'bloqueado';
    try {
      await condominiosApi.patchStatus(cond.id, { status_plano: novoStatus, ativo: novoAtivo });
      setCondominios(prev => prev.map(c =>
        c.id === cond.id ? { ...c, status_plano: novoStatus, ativo: novoAtivo } : c
      ));
    } catch { alert('Erro ao alterar status'); }
  };

  // Master: filtros
  const condFiltrados = condominios.filter(c => {
    if (filtroStatus !== 'todos' && c.status_plano !== filtroStatus) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return c.nome.toLowerCase().includes(b) || c.cidade.toLowerCase().includes(b) || (c.administrador_nome || '').toLowerCase().includes(b);
    }
    return true;
  });

  const statusLabel = (s?: string) => {
    const map: Record<string, string> = { teste: 'Teste', ativo: 'Ativo', inadimplente: 'Inadimplente', bloqueado: 'Bloqueado' };
    return map[s || 'teste'] || s || '—';
  };
  const statusClass = (s?: string) => {
    const map: Record<string, string> = { teste: styles.badgeTeste, ativo: styles.badgeAtivo, inadimplente: styles.badgeInadimplente, bloqueado: styles.badgeBloqueado };
    return map[s || 'teste'] || styles.badgeTeste;
  };
  const planoLabel = (p?: string) => {
    const map: Record<string, string> = { teste: 'Teste', basico: 'Básico', profissional: 'Profissional', enterprise: 'Enterprise' };
    return map[p || 'teste'] || p || '—';
  };

  return (
    <div id="condominios-content">
      <HowItWorks
        titulo={isMaster ? 'Gestão da Plataforma — Condomínios' : 'Gestão de Condomínios'}
        descricao={isMaster
          ? 'Gerencie todos os condomínios cadastrados na plataforma. Altere planos, status, bloqueie inadimplentes e acompanhe o ciclo de vida de cada conta.'
          : 'Cadastre e gerencie todos os condomínios atendidos. Cada condomínio possui seus blocos, unidades, síndico responsável e informações de contato.'}
        passos={isMaster
          ? [
              'Visualize todos os condomínios da plataforma com seus status',
              'Altere plano e status de cada condomínio',
              'Bloqueie condomínios inadimplentes',
              'Estenda períodos de teste',
              'Acompanhe o administrador responsável por cada condomínio',
            ]
          : [
              'Cadastre um novo condomínio com nome, endereço e dados do síndico',
              'Defina o número de blocos e unidades',
              'Vincule equipes de manutenção predial a cada condomínio',
              'Acompanhe as ordens de serviço e checklists por condomínio',
              'Gere relatórios individual ou consolidado',
            ]}
      />

      <PageHeader
        titulo="Condomínios"
        subtitulo={isMaster ? `${condominios.length} condomínios na plataforma` : `${condominios.length} condomínios cadastrados`}
        onCompartilhar={() => compartilharConteudo('Condomínios', `Total: ${condominios.length}`)}
        onImprimir={() => imprimirElemento('condominios-content')}
        onGerarPdf={() => gerarPdfDeElemento('condominios-content', 'condominios')}
        acoes={!isMaster ? (
          <button className={styles.addBtn} onClick={abrirNovo}>
            <Plus size={18} /> <span>Novo Condomínio</span>
          </button>
        ) : undefined}
      />

      {/* === MASTER VIEW: Tabela com filtros === */}
      {isMaster && (
        <>
          <div className={styles.masterFilters}>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input placeholder="Buscar por nome, cidade ou administrador..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className={styles.filterTabs}>
              {['todos', 'teste', 'ativo', 'inadimplente', 'bloqueado'].map(s => (
                <button
                  key={s}
                  className={`${styles.filterTab} ${filtroStatus === s ? styles.filterTabActive : ''}`}
                  onClick={() => setFiltroStatus(s)}
                >
                  {s === 'todos' ? 'Todos' : statusLabel(s)}
                  <span className={styles.filterCount}>
                    {s === 'todos' ? condominios.length : condominios.filter(c => c.status_plano === s).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Card padding="sm">
            <div className={styles.tableWrapper}>
              <table className={styles.masterTable}>
                <thead>
                  <tr>
                    <th>Condomínio</th>
                    <th>Administrador</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Fim do Teste</th>
                    <th>Mensalidade</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {condFiltrados.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--cor-texto-secundario)' }}>Nenhum condomínio encontrado</td></tr>
                  )}
                  {condFiltrados.map(cond => (
                    <tr key={cond.id} className={cond.ativo === false ? styles.rowInactive : undefined}>
                      <td>
                        <div className={styles.cellCond}>
                          <Building2 size={16} />
                          <div>
                            <strong>{cond.nome}</strong>
                            <small>{cond.cidade || '—'}</small>
                          </div>
                        </div>
                      </td>
                      <td>{cond.administrador_nome || <span style={{ color: 'var(--cor-texto-secundario)' }}>Sem admin</span>}</td>
                      <td>{planoLabel(cond.plano)}</td>
                      <td><span className={`${styles.badge} ${statusClass(cond.status_plano)}`}>{statusLabel(cond.status_plano)}</span></td>
                      <td>{cond.data_fim_teste ? new Date(cond.data_fim_teste).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{cond.valor_mensalidade ? `R$ ${Number(cond.valor_mensalidade).toFixed(2)}` : '—'}</td>
                      <td>
                        <div className={styles.condActions}>
                          <button className={styles.condActionBtn} onClick={() => abrirStatusModal(cond)} title="Gerenciar plano/status">
                            <CreditCard size={14} />
                          </button>
                          <button
                            className={cond.status_plano === 'bloqueado' ? styles.condActionBtnSuccess : styles.condActionBtnDanger}
                            onClick={() => toggleBloquear(cond)}
                            title={cond.status_plano === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                          >
                            {cond.status_plano === 'bloqueado' ? <Shield size={14} /> : <ShieldOff size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* === ADMIN VIEW: Cards === */}
      {!isMaster && (
        <>
          <div className={styles.grid}>
            {condominios.map(cond => (
          <Card key={cond.id} hover padding="md">
            <div className={styles.condCard}>
              <div className={styles.condCardTop}>
                {cond.logoUrl ? (
                  <img src={cond.logoUrl} alt={cond.nome} className={styles.condLogoImg} />
                ) : (
                  <div className={styles.condIcon}>
                    <Building2 size={24} />
                  </div>
                )}
                <div className={styles.condActions}>
                  <button className={styles.condActionBtn} onClick={() => abrirEditar(cond)} title="Editar">
                    <Pencil size={14} />
                  </button>
                  {confirmDelete === cond.id ? (
                    <>
                      <button className={styles.condActionBtnDanger} onClick={() => excluir(cond.id)} title="Confirmar exclusão">
                        <Trash2 size={14} />
                      </button>
                      <button className={styles.condActionBtn} onClick={() => setConfirmDelete(null)} title="Cancelar">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button className={styles.condActionBtn} onClick={() => setConfirmDelete(cond.id)} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <h4 className={styles.condNome}>{cond.nome}</h4>
              <div className={styles.condInfo}>
                <span><MapPin size={13} /> {cond.endereco}, {cond.cidade}</span>
                <span><Users size={13} /> Síndico: {cond.sindico}</span>
                <span><Home size={13} /> {cond.blocos} blocos • {cond.unidades} unidades</span>
                <span><Phone size={13} /> {cond.telefone}</span>
                <span><Mail size={13} /> {cond.email}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--cor-texto)' }}>Unidades por Condomínio</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
              <XAxis dataKey="nome" stroke="var(--cor-texto-secundario)" fontSize={11} />
              <YAxis stroke="var(--cor-texto-secundario)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
              <Bar dataKey="unidades" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
        </>
      )}

      {/* Modal Cadastro / Edição (admin) */}
      {modalAberto && (
        <div className={styles.overlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editandoId ? 'Editar Condomínio' : 'Novo Condomínio'}</h3>
              <button className={styles.modalClose} onClick={fecharModal}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setField('nome', e.target.value)} placeholder="Ex: Condomínio Aurora" />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Endereço</label>
                  <input value={form.endereco} onChange={e => setField('endereco', e.target.value)} placeholder="Rua, número" />
                </div>
                <div className={styles.formGroup}>
                  <label>Cidade</label>
                  <input value={form.cidade} onChange={e => setField('cidade', e.target.value)} placeholder="Cidade" />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Blocos</label>
                  <input type="number" min={0} value={form.blocos || ''} onChange={e => setField('blocos', Number(e.target.value))} />
                </div>
                <div className={styles.formGroup}>
                  <label>Unidades</label>
                  <input type="number" min={0} value={form.unidades || ''} onChange={e => setField('unidades', Number(e.target.value))} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Síndico</label>
                <input value={form.sindico} onChange={e => setField('sindico', e.target.value)} placeholder="Nome do síndico" />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Telefone</label>
                  <input value={form.telefone} onChange={e => setField('telefone', e.target.value)} placeholder="(00) 0000-0000" />
                </div>
                <div className={styles.formGroup}>
                  <label>E-mail</label>
                  <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@cond.com" />
                </div>
              </div>

              {/* Branding - Tela de Login */}
              <div className={styles.brandingSection}>
                <h4 className={styles.brandingSectionTitle}>
                  <Image size={15} /> Personalização da Tela de Login
                </h4>
                <div className={styles.logoUploadArea}>
                  {form.logoUrl ? (
                    <div className={styles.logoPreviewWrapper}>
                      <img src={form.logoUrl} alt="Logo" className={styles.logoPreviewImg} />
                      <button
                        type="button"
                        className={styles.logoPreviewRemove}
                        onClick={() => setForm(prev => ({ ...prev, logoUrl: undefined }))}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.logoPlaceholder} onClick={() => logoInputRef.current?.click()}>
                      <Upload size={18} />
                      <span>Enviar Logo</span>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  {form.logoUrl && (
                    <button type="button" className={styles.logoChangeSmall} onClick={() => logoInputRef.current?.click()}>
                      <Upload size={13} /> Alterar
                    </button>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Título do Login</label>
                  <input
                    value={form.loginTitulo || ''}
                    onChange={e => setForm(prev => ({ ...prev, loginTitulo: e.target.value || undefined }))}
                    placeholder="Ex: Bem-vindo ao Condomínio Aurora"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Subtítulo do Login</label>
                  <input
                    value={form.loginSubtitulo || ''}
                    onChange={e => setForm(prev => ({ ...prev, loginSubtitulo: e.target.value || undefined }))}
                    placeholder="Ex: Faça login para acessar o sistema"
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={fecharModal}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={salvar} disabled={!form.nome.trim()}>
                {editandoId ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Status (master) */}
      {statusModal && (
        <div className={styles.overlay} onClick={() => setStatusModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Gerenciar — {statusModal.nome}</h3>
              <button className={styles.modalClose} onClick={() => setStatusModal(null)}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Plano</label>
                  <select value={statusForm.plano} onChange={e => setStatusForm(prev => ({ ...prev, plano: e.target.value }))}>
                    <option value="teste">Teste</option>
                    <option value="basico">Básico</option>
                    <option value="profissional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select value={statusForm.status_plano} onChange={e => setStatusForm(prev => ({ ...prev, status_plano: e.target.value, ativo: e.target.value !== 'bloqueado' }))}>
                    <option value="teste">Teste</option>
                    <option value="ativo">Ativo</option>
                    <option value="inadimplente">Inadimplente</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Fim do Teste</label>
                  <input type="date" value={statusForm.data_fim_teste} onChange={e => setStatusForm(prev => ({ ...prev, data_fim_teste: e.target.value }))} />
                </div>
                <div className={styles.formGroup}>
                  <label>Mensalidade (R$)</label>
                  <input type="number" min={0} step={0.01} value={statusForm.valor_mensalidade || ''} onChange={e => setStatusForm(prev => ({ ...prev, valor_mensalidade: Number(e.target.value) }))} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={statusForm.ativo} onChange={e => setStatusForm(prev => ({ ...prev, ativo: e.target.checked }))} />
                  Conta ativa
                </label>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={() => setStatusModal(null)}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={salvarStatus}>Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CondominiosPage;
