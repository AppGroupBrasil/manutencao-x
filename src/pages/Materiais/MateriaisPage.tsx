import React, { useState, useMemo, useRef, useEffect } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import StatusBadge from '../../components/Common/StatusBadge';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useAuth } from '../../contexts/AuthContext';
import { validarImagem } from '../../utils/imageUtils';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { Plus, Package, Mail, Search, X, Hash, ArrowDownCircle, ArrowUpCircle, Camera, Mic, MicOff, FileText, Image, Building2, CheckCircle, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDemo } from '../../contexts/DemoContext';
import { materiais as materiaisApi, condominios as condominiosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './Materiais.module.css';

/* ── Tipos ── */
interface Material {
  id: string;
  protocolo: string;
  nome: string;
  categoria: string;
  unidade: string;
  qtd: number;
  min: number;
  custo: number;
  emailNotificacao: string;
  condominio: string;
}

interface Movimentacao {
  id: string;
  materialId: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  observacao: string;
  audioUrl: string | null;
  fotos: string[];
  notaFiscalUrl: string | null;
  data: string;
  funcionario: string;
}

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMaterial = (material: any): Material => ({
  id: String(material?.id ?? ''),
  protocolo: String(material?.protocolo ?? ''),
  nome: String(material?.nome ?? ''),
  categoria: String(material?.categoria ?? 'Outros'),
  unidade: String(material?.unidade ?? 'un'),
  qtd: toSafeNumber(material?.qtd),
  min: toSafeNumber(material?.min),
  custo: toSafeNumber(material?.custo),
  emailNotificacao: String(material?.emailNotificacao ?? ''),
  condominio: String(material?.condominio ?? ''),
});

/* ── Helpers ── */
const gerarProtocolo = () => {
  const now = new Date();
  const p = `MAT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  return p;
};

const CORES = ['#1a73e8', '#f57c00', '#d32f2f', '#00897b', '#7b1fa2'];

const EMAIL_RESPONSAVEL = 'gestor@condominio.com';

/* ── Componente ── */
const MateriaisPage: React.FC = () => {
  const { roleNivel } = usePermissions();
  const { usuario } = useAuth();
  const { tentarAcao } = useDemo();
  const ehGestor = roleNivel >= 2; // supervisor+
  const [condominiosList, setCondominiosList] = useState<string[]>([]);
  const CONDOMINIOS = useMemo(() => ['Todos', ...condominiosList], [condominiosList]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: '', categoria: 'Limpeza', unidade: 'un', qtd: '', min: '', custo: '', email: '', condominio: 'Residencial Aurora' });
  const [notificacao, setNotificacao] = useState<{ visivel: boolean; material: string; email: string } | null>(null);

  // Filtros
  const [condoSelecionado, setCondoSelecionado] = useState('Todos');
  const [busca, setBusca] = useState('');

  // Modal de movimentação
  const [showMovModal, setShowMovModal] = useState(false);
  const [movMaterial, setMovMaterial] = useState<Material | null>(null);
  const [movForm, setMovForm] = useState<{
    tipo: 'entrada' | 'saida';
    quantidade: string;
    observacao: string;
    fotos: string[];
    notaFiscalUrl: string | null;
    audioUrl: string | null;
  }>({ tipo: 'entrada', quantidade: '', observacao: '', fotos: [], notaFiscalUrl: null, audioUrl: null });
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const nfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      materiaisApi.list(),
      condominiosApi.list().catch(() => []),
    ]).then(([mats, conds]) => {
      setMateriais(Array.isArray(mats) ? mats.map(normalizeMaterial) : []);
      setCondominiosList((conds as any[]).map(c => c.nome));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Modal historico
  const [showHistorico, setShowHistorico] = useState(false);
  const [histMaterial, setHistMaterial] = useState<Material | null>(null);

  /* ── Filtro + Busca ── */
  const filtrados = useMemo(() => {
    let lista = materiais;
    if (condoSelecionado !== 'Todos') {
      lista = lista.filter(m => m.condominio === condoSelecionado);
    }
    if (busca.trim()) {
      const termos = busca.toLowerCase().split(/\s+/);
      lista = lista.filter(m => {
        const texto = `${m.nome} ${m.categoria} ${m.protocolo} ${m.unidade} ${m.condominio}`.toLowerCase();
        return termos.every(t => texto.includes(t));
      });
    }
    return lista;
  }, [materiais, condoSelecionado, busca]);

  /* ── Charts ── */
  const chartCat = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach(m => { map[m.categoria] = (map[m.categoria] || 0) + 1; });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor }));
  }, [filtrados]);

  /* ── Criar Material ── */
  const criarMaterial = async () => {
    if (!tentarAcao()) return;
    if (!form.nome.trim() || !form.qtd || !form.min || !form.custo) return;
    try {
      const criado = await materiaisApi.create({
        protocolo: gerarProtocolo(),
        nome: form.nome.trim(),
        categoria: form.categoria,
        unidade: form.unidade,
        qtd: parseInt(form.qtd),
        min: parseInt(form.min),
        custo: parseFloat(form.custo),
        emailNotificacao: form.email.trim(),
        condominio: form.condominio,
      }) as Material;
      const materialCriado = normalizeMaterial(criado);
      setMateriais(prev => [...prev, materialCriado]);

      if (!ehGestor) {
        const emailDest = form.email.trim() || EMAIL_RESPONSAVEL;
        setNotificacao({ visivel: true, material: materialCriado.nome, email: emailDest });
        setTimeout(() => setNotificacao(null), 6000);
      }

      setForm({ nome: '', categoria: 'Limpeza', unidade: 'un', qtd: '', min: '', custo: '', email: '', condominio: condominiosList[0] || 'Residencial Aurora' });
      setShowModal(false);
    } catch (err) { console.error(err); }
  };

  /* ── Abrir Modal Movimentação ── */
  const abrirMovimentacao = (mat: Material, tipo: 'entrada' | 'saida') => {
    setMovMaterial(mat);
    setMovForm({ tipo, quantidade: '', observacao: '', fotos: [], notaFiscalUrl: null, audioUrl: null });
    setShowMovModal(true);
  };

  /* ── Salvar Movimentação ── */
  const salvarMovimentacao = async () => {
    if (!tentarAcao()) return;
    if (!movMaterial || !movForm.quantidade || parseInt(movForm.quantidade) <= 0) return;
    const qtdNum = parseInt(movForm.quantidade);

    if (movForm.tipo === 'saida' && qtdNum > movMaterial.qtd) {
      alert('Quantidade de saída maior que o estoque disponível!');
      return;
    }

    try {
      const mov = await materiaisApi.addMovimentacao(movMaterial.id, {
        tipo: movForm.tipo,
        quantidade: qtdNum,
        observacao: movForm.observacao,
        audioUrl: movForm.audioUrl,
        fotos: movForm.fotos,
        notaFiscalUrl: movForm.notaFiscalUrl,
        funcionario: usuario?.nome || 'Funcionário Atual',
      }) as Movimentacao;
      setMovimentacoes(prev => [...prev, mov]);
      setMateriais(prev => prev.map(m => {
        if (m.id !== movMaterial.id) return m;
        const novaQtd = movForm.tipo === 'entrada' ? m.qtd + qtdNum : m.qtd - qtdNum;
        return { ...m, qtd: novaQtd };
      }));
      setShowMovModal(false);
    } catch (err) { console.error(err); }
  };

  /* ── Fotos ── */
  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const erro = validarImagem(file);
      if (erro) { alert(erro); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setMovForm(p => ({ ...p, fotos: [...p.fotos, ev.target!.result as string] }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleNotaFiscal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setMovForm(p => ({ ...p, notaFiscalUrl: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Áudio ── */
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setMovForm(p => ({ ...p, audioUrl: url }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setGravandoAudio(true);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  };

  const pararGravacao = () => {
    mediaRecorderRef.current?.stop();
    setGravandoAudio(false);
  };

  /* ── Histórico ── */
  const abrirHistorico = async (mat: Material) => {
    setHistMaterial(mat);
    try {
      const movs = await materiaisApi.listMovimentacoes(mat.id) as Movimentacao[];
      setMovimentacoes(prev => {
        const outros = prev.filter(m => m.materialId !== mat.id);
        return [...outros, ...movs];
      });
    } catch { /* keep local */ }
    setShowHistorico(true);
  };

  const historicoDoMaterial = useMemo(() => {
    if (!histMaterial) return [];
    return movimentacoes.filter(m => m.materialId === histMaterial.id).reverse();
  }, [histMaterial, movimentacoes]);

  const pag = usePagination(filtrados, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando materiais..." />;

  return (
    <div id="materiais-content">
      {/* ═══ Toast de Notificação ═══ */}
      {notificacao?.visivel && (
        <div className={styles.toast}>
          <div className={styles.toastIcon}>
            <Send size={18} />
          </div>
          <div className={styles.toastContent}>
            <strong>Notificação enviada!</strong>
            <span>O responsável (<strong>{notificacao.email}</strong>) foi notificado sobre o novo material <strong>{notificacao.material}</strong>.</span>
          </div>
          <button className={styles.toastClose} onClick={() => setNotificacao(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <HowItWorks
        titulo="Controle de Estoque"
        descricao="Gerencie o estoque de materiai de manutenção predial. Receba alertas quando o estoque estiver baixo."
        passos={[
          'Selecione o condomínio para visualizar o estoque específico',
          'Use a busca para encontrar materiais por nome, categoria ou protocolo',
          'Registre entradas e saídas com fotos, áudio e nota fiscal',
          'O sistema alerta quando a quantidade está abaixo do mínimo',
          'Acompanhe o histórico completo de movimentações',
        ]}
      />

      <PageHeader
        titulo={ehGestor ? 'Materiais e Estoque' : 'Movimentação de Estoque'}
        subtitulo={ehGestor
          ? `${filtrados.length} materiais ${condoSelecionado !== 'Todos' ? `em ${condoSelecionado}` : 'cadastrados'}`
          : `${filtrados.length} materiais disponíveis — Registre entradas e retiradas`
        }
        onCompartilhar={() => compartilharConteudo('Materiais', 'Listagem de materiais')}
        onImprimir={() => imprimirElemento('materiais-content')}
        onGerarPdf={() => gerarPdfDeElemento('materiais-content', 'materiais')}
        acoes={
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={18} /> <span>Novo Material</span>
          </button>
        }
      />

      {/* ═══ Barra de Filtros: Condomínio + Busca ═══ */}
      <div className={styles.filtrosBar}>
        <div className={styles.condoSelector}>
          <Building2 size={18} className={styles.condoIcon} />
          <select
            className={styles.condoSelect}
            value={condoSelecionado}
            onChange={e => setCondoSelecionado(e.target.value)}
          >
            {CONDOMINIOS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className={styles.buscaArea}>
          <Search size={16} className={styles.buscaIcon} />
          <input
            className={styles.buscaInput}
            placeholder="Buscar por nome, categoria, protocolo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button className={styles.buscaLimpar} onClick={() => setBusca('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ═══ Grid de Cards ═══ */}
      {filtrados.length === 0 ? (
        <div className={styles.vazio}>
          <Package size={40} strokeWidth={1.2} />
          <span>Nenhum material encontrado</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {pag.items.map(mat => {
            const baixo = mat.qtd <= mat.min;
            return (
              <Card key={mat.id} hover padding="md">
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <Package size={20} color={baixo ? '#d32f2f' : 'var(--cor-primaria)'} />
                    <span className={styles.protocoloTag}><Hash size={11} />{mat.protocolo}</span>
                    <StatusBadge texto={baixo ? 'Estoque Baixo' : 'Ok'} variante={baixo ? 'perigo' : 'sucesso'} />
                  </div>
                  <h4 className={styles.cardNome}>{mat.nome}</h4>
                  <div className={styles.cardCondo}><Building2 size={12} />{mat.condominio}</div>
                  <span className={styles.cardCat}>{mat.categoria}</span>
                  <div className={styles.cardQtd}>
                    <span>Qtd: <strong style={{ color: baixo ? '#d32f2f' : 'var(--cor-texto)' }}>{mat.qtd}</strong> {mat.unidade}</span>
                    <span>Mín: {mat.min}</span>
                  </div>
                  <span className={styles.cardCusto}>R$ {toSafeNumber(mat.custo).toFixed(2)}/{mat.unidade}</span>

                  {mat.emailNotificacao && (
                    <div className={styles.emailNotif} style={baixo ? { background: '#fff3e0', borderColor: '#ff9800' } : {}}>
                      <Mail size={13} />
                      <span>{mat.emailNotificacao}</span>
                      {baixo && <span className={styles.emailAlerta}>⚠ Notificar</span>}
                    </div>
                  )}
                  {baixo && !mat.emailNotificacao && (
                    <div className={styles.emailNotif} style={{ background: '#ffebee', borderColor: '#d32f2f' }}>
                      <Mail size={13} color="#d32f2f" />
                      <span style={{ color: '#d32f2f', fontWeight: 600 }}>Sem e-mail de notificação</span>
                    </div>
                  )}

                  {/* Botões Funcionário: Entrada / Saída / Histórico */}
                  <div className={styles.cardActions}>
                    <button className={styles.btnEntrada} onClick={() => abrirMovimentacao(mat, 'entrada')}>
                      <ArrowDownCircle size={14} /> Entrada
                    </button>
                    <button className={styles.btnSaida} onClick={() => abrirMovimentacao(mat, 'saida')}>
                      <ArrowUpCircle size={14} /> Retirada
                    </button>
                    <button className={styles.btnHistorico} onClick={() => abrirHistorico(mat)}>
                      <FileText size={14} /> Histórico
                    </button>
                    <WhatsAppShare mensagem={`*Material*\n*Protocolo:* ${mat.protocolo}\n*Nome:* ${mat.nome}\n*Categoria:* ${mat.categoria}\n*Quantidade:* ${mat.qtd} ${mat.unidade}\n*Estoque Mínimo:* ${mat.min} ${mat.unidade}\n*Custo:* R$ ${Number(mat.custo || 0).toFixed(2)}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {/* ═══ Gráficos (só gestor) ═══ */}
      {ehGestor && (
        <div style={{ marginTop: '1cm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1cm' }}>
          <Card padding="md">
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--cor-texto)' }}>Por Categoria</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartCat} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="valor" nameKey="nome" label>
                  {chartCat.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card padding="md">
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--cor-texto)' }}>Estoque vs Mínimo</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={filtrados.slice(0, 5).map(m => ({ nome: m.nome.split(' ')[0], atual: m.qtd, minimo: m.min }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cor-borda)" />
                <XAxis dataKey="nome" fontSize={11} stroke="var(--cor-texto-secundario)" />
                <YAxis fontSize={12} stroke="var(--cor-texto-secundario)" />
                <Tooltip contentStyle={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', borderRadius: 8 }} />
                <Bar dataKey="atual" fill="#1a73e8" radius={[4, 4, 0, 0]} name="Atual" />
                <Bar dataKey="minimo" fill="#d32f2f" radius={[4, 4, 0, 0]} name="Mínimo" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ═══ Modal: Novo Material ═══ */}
      <Modal aberto={showModal} onFechar={() => setShowModal(false)} titulo="Novo Material" largura="md">
        <div className={styles.formGrid}>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Nome</label>
            <input className={styles.formInput} placeholder="Ex: Desinfetante 5L" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Condomínio</label>
            <select className={styles.formSelect} value={form.condominio} onChange={e => setForm(p => ({ ...p, condominio: e.target.value }))}>
              {CONDOMINIOS.filter(c => c !== 'Todos').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Categoria</label>
            <select className={styles.formSelect} value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
              <option value="Limpeza">Limpeza</option>
              <option value="Descartáveis">Descartáveis</option>
              <option value="EPI">EPI</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Unidade</label>
            <select className={styles.formSelect} value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
              <option value="un">Unidade (un)</option>
              <option value="pct">Pacote (pct)</option>
              <option value="cx">Caixa (cx)</option>
              <option value="kg">Quilo (kg)</option>
              <option value="L">Litro (L)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Quantidade Atual</label>
            <input type="number" min="0" className={styles.formInput} placeholder="0" value={form.qtd} onChange={e => setForm(p => ({ ...p, qtd: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Quantidade Mínima</label>
            <input type="number" min="0" className={styles.formInput} placeholder="0" value={form.min} onChange={e => setForm(p => ({ ...p, min: e.target.value }))} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Custo Unitário (R$)</label>
            <input type="number" min="0" step="0.01" className={styles.formInput} placeholder="0.00" value={form.custo} onChange={e => setForm(p => ({ ...p, custo: e.target.value }))} />
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>📧 E-mail para Notificação de Quantidade Mínima</label>
            <input type="email" className={styles.formInput} placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <span className={styles.emailHint}>Ao atingir a quantidade mínima, uma notificação será enviada para este e-mail.</span>
          </div>
          <button className={styles.formSubmit} onClick={criarMaterial}>
            <Plus size={18} /> Cadastrar Material
          </button>
          {!ehGestor && (
            <div className={styles.emailAviso}>
              <CheckCircle size={14} />
              <span>Ao cadastrar, o responsável será notificado por e-mail automaticamente.</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══ Modal: Movimentação (Entrada / Saída) ═══ */}
      <Modal
        aberto={showMovModal}
        onFechar={() => { setShowMovModal(false); if (gravandoAudio) pararGravacao(); }}
        titulo={movForm.tipo === 'entrada' ? '📥 Abastecimento de Estoque' : '📤 Retirada de Estoque'}
        largura="md"
      >
        {movMaterial && (
          <div className={styles.movModal}>
            {/* Info do Material */}
            <div className={styles.movInfo}>
              <Package size={18} color="var(--cor-primaria)" />
              <div>
                <strong>{movMaterial.nome}</strong>
                <span className={styles.movInfoSub}>{movMaterial.condominio} · Estoque atual: <strong>{movMaterial.qtd}</strong> {movMaterial.unidade}</span>
              </div>
              <span className={styles.protocoloTag} style={{ marginLeft: 'auto' }}><Hash size={11} />{movMaterial.protocolo}</span>
            </div>

            {/* Tipo Toggle */}
            <div className={styles.movTipoToggle}>
              <button
                className={`${styles.movTipoBtn} ${movForm.tipo === 'entrada' ? styles.movTipoBtnEntradaAtivo : ''}`}
                onClick={() => setMovForm(p => ({ ...p, tipo: 'entrada' }))}
              >
                <ArrowDownCircle size={16} /> Entrada (Abastecimento)
              </button>
              <button
                className={`${styles.movTipoBtn} ${movForm.tipo === 'saida' ? styles.movTipoBtnSaidaAtivo : ''}`}
                onClick={() => setMovForm(p => ({ ...p, tipo: 'saida' }))}
              >
                <ArrowUpCircle size={16} /> Saída (Retirada)
              </button>
            </div>

            {/* Quantidade */}
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Quantidade ({movMaterial.unidade})</label>
              <input
                type="number"
                min="1"
                max={movForm.tipo === 'saida' ? movMaterial.qtd : undefined}
                className={styles.formInput}
                placeholder={`Quantidade de ${movForm.tipo === 'entrada' ? 'entrada' : 'saída'}`}
                value={movForm.quantidade}
                onChange={e => setMovForm(p => ({ ...p, quantidade: e.target.value }))}
              />
            </div>

            {/* Observação Texto */}
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>📝 Observações</label>
              <textarea
                className={styles.formTextarea}
                rows={3}
                placeholder="Escreva sua observações aqui..."
                value={movForm.observacao}
                onChange={e => setMovForm(p => ({ ...p, observacao: e.target.value }))}
              />
            </div>

            {/* Áudio */}
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>🎙️ Observação em Áudio</label>
              <div className={styles.audioArea}>
                {!gravandoAudio ? (
                  <button className={styles.audioBtn} onClick={iniciarGravacao}>
                    <Mic size={16} /> Gravar Áudio
                  </button>
                ) : (
                  <button className={`${styles.audioBtn} ${styles.audioBtnGravando}`} onClick={pararGravacao}>
                    <MicOff size={16} /> Parar Gravação
                  </button>
                )}
                {movForm.audioUrl && (
                  <div className={styles.audioPreview}>
                    <audio controls src={movForm.audioUrl} style={{ height: 36, width: '100%' }} />
                    <button className={styles.audioRemover} onClick={() => setMovForm(p => ({ ...p, audioUrl: null }))}>
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Fotos */}
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>📷 Fotos</label>
              <input ref={fotoInputRef} type="file" accept="image/*" multiple onChange={handleFotos} style={{ display: 'none' }} />
              <button className={styles.fotoBtn} onClick={() => fotoInputRef.current?.click()}>
                <Camera size={16} /> Adicionar Fotos
              </button>
              {movForm.fotos.length > 0 && (
                <div className={styles.fotosGrid}>
                  {movForm.fotos.map((f, i) => (
                    <div key={i} className={styles.fotoThumb}>
                      <img src={f} alt={`Foto ${i + 1}`} />
                      <button className={styles.fotoRemover} onClick={() => setMovForm(p => ({ ...p, fotos: p.fotos.filter((_, j) => j !== i) }))}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nota Fiscal */}
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>🧾 Nota Fiscal</label>
              <input ref={nfInputRef} type="file" accept="image/*,.pdf" onChange={handleNotaFiscal} style={{ display: 'none' }} />
              <button className={styles.nfBtn} onClick={() => nfInputRef.current?.click()}>
                <Image size={16} /> Anexar Nota Fiscal
              </button>
              {movForm.notaFiscalUrl && (
                <div className={styles.nfPreview}>
                  {movForm.notaFiscalUrl.startsWith('data:image') ? (
                    <img src={movForm.notaFiscalUrl} alt="Nota Fiscal" className={styles.nfImage} />
                  ) : (
                    <span className={styles.nfPdf}><FileText size={16} /> Nota Fiscal anexada (PDF)</span>
                  )}
                  <button className={styles.fotoRemover} onClick={() => setMovForm(p => ({ ...p, notaFiscalUrl: null }))}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Salvar */}
            <button
              className={`${styles.formSubmit} ${movForm.tipo === 'entrada' ? styles.btnEntradaFull : styles.btnSaidaFull}`}
              onClick={salvarMovimentacao}
            >
              {movForm.tipo === 'entrada' ? <><ArrowDownCircle size={18} /> Registrar Entrada</> : <><ArrowUpCircle size={18} /> Registrar Retirada</>}
            </button>
          </div>
        )}
      </Modal>

      {/* ═══ Modal: Histórico de Movimentações ═══ */}
      <Modal
        aberto={showHistorico}
        onFechar={() => setShowHistorico(false)}
        titulo={`📋 Histórico — ${histMaterial?.nome || ''}`}
        largura="md"
      >
        {histMaterial && (
          <div className={styles.historicoModal}>
            <div className={styles.movInfo} style={{ marginBottom: 16 }}>
              <Package size={18} color="var(--cor-primaria)" />
              <div>
                <strong>{histMaterial.nome}</strong>
                <span className={styles.movInfoSub}>{histMaterial.condominio} · Estoque atual: <strong>{histMaterial.qtd}</strong> {histMaterial.unidade}</span>
              </div>
            </div>
            {historicoDoMaterial.length === 0 ? (
              <div className={styles.vazio} style={{ padding: '30px 0' }}>
                <FileText size={32} strokeWidth={1.2} />
                <span>Nenhuma movimentação registrada</span>
              </div>
            ) : (
              <div className={styles.histLista}>
                {historicoDoMaterial.map(mov => (
                  <div key={mov.id} className={`${styles.histItem} ${mov.tipo === 'entrada' ? styles.histEntrada : styles.histSaida}`}>
                    <div className={styles.histHeader}>
                      {mov.tipo === 'entrada' ? <ArrowDownCircle size={16} color="#2e7d32" /> : <ArrowUpCircle size={16} color="#d32f2f" />}
                      <strong>{mov.tipo === 'entrada' ? 'Entrada' : 'Retirada'}: {mov.quantidade} {histMaterial.unidade}</strong>
                      <span className={styles.histData}>{mov.data}</span>
                    </div>
                    <span className={styles.histFunc}>Funcionário: {mov.funcionario}</span>
                    {mov.observacao && <p className={styles.histObs}>{mov.observacao}</p>}
                    {mov.audioUrl && <audio controls src={mov.audioUrl} style={{ width: '100%', height: 32, marginTop: 4 }} />}
                    {mov.fotos.length > 0 && (
                      <div className={styles.fotosGrid} style={{ marginTop: 6 }}>
                        {mov.fotos.map((f, i) => (
                          <div key={i} className={styles.fotoThumb}><img src={f} alt={`Foto ${i + 1}`} /></div>
                        ))}
                      </div>
                    )}
                    {mov.notaFiscalUrl && (
                      <div className={styles.nfPreview} style={{ marginTop: 6 }}>
                        {mov.notaFiscalUrl.startsWith('data:image') ? (
                          <img src={mov.notaFiscalUrl} alt="NF" className={styles.nfImage} />
                        ) : (
                          <span className={styles.nfPdf}><FileText size={14} /> NF em PDF</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MateriaisPage;
