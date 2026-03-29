import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { validarImagem } from '../../utils/imageUtils';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Plus, Trash2, Save, X, Eye, Edit3, Image, Play, ChevronLeft, ChevronRight,
  CheckCircle2, Camera, AlertTriangle, FileText, Clock,
  Layers, BookOpen, Upload, Hash, MessageCircle, Settings,
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { roteiros as roteirosApi, moradores as moradoresApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import styles from './RoteiroExecucao.module.css';

/* ═══════════════════════════════════════
   TIPOS
═══════════════════════════════════════ */
interface PassoRoteiro {
  id: string;
  titulo: string;
  descricao: string;
  imagens: string[];
  videoUrl: string;
}

interface Roteiro {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  capa: string;
  passos: PassoRoteiro[];
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface ExecucaoPasso {
  passoId: string;
  feito: boolean;
  fotoAntes: string;
  fotoDepois: string;
  descAntes: string;
  descDepois: string;
  imagens: string[];
  problema: string;
  problemaEnviado: boolean;
  status: string;
  prioridade: string;
}

interface ExecucaoRoteiro {
  roteiroId: string;
  funcionario: string;
  data: string;
  passosExec: ExecucaoPasso[];
}

/* ═══════════════════════════════════════
   STORAGE (removed)
═══════════════════════════════════════ */
interface ContatoWhats { id: string; nome: string; telefone: string; }

const CATEGORIAS = [
  'Limpeza', 'Manutenção', 'Jardinagem', 'Segurança', 'Piscina', 'Recepção', 'Elevador', 'Garagem', 'Outro',
];

function youtubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  let videoId: string | null = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
    else if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
  } catch { return null; }
  return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null;
}

/* ═══════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════ */
const RoteiroExecucaoPage: React.FC = () => {
  const { usuario } = useAuth();
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const podeCriar = roleNivel >= 2; // master, admin, supervisor
  const ehFuncionario = roleNivel === 1;

  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [execucoesLog, setExecucoesLog] = useState<ExecucaoRoteiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'criar'>('lista');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  /* ── Criar / Editar ── */
  const [editando, setEditando] = useState<Roteiro | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategoria, setFormCategoria] = useState('Limpeza');
  const [formCapa, setFormCapa] = useState('');
  const [formPassos, setFormPassos] = useState<PassoRoteiro[]>([]);
  const capaInputRef = useRef<HTMLInputElement>(null);

  /* ── Story view ── */
  const [storyRoteiro, setStoryRoteiro] = useState<Roteiro | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [storyImgIdx, setStoryImgIdx] = useState(0);

  /* ── Execução (funcionário) ── */
  const [execRoteiro, setExecRoteiro] = useState<Roteiro | null>(null);
  const [execPassos, setExecPassos] = useState<ExecucaoPasso[]>([]);
  const [modalFoto, setModalFoto] = useState<{ passo: PassoRoteiro; exec: ExecucaoPasso } | null>(null);
  const [modalProblema, setModalProblema] = useState<{ passo: PassoRoteiro; exec: ExecucaoPasso } | null>(null);
  const antesInputRef2 = useRef<HTMLInputElement>(null);
  const depoisInputRef2 = useRef<HTMLInputElement>(null);
  const problemaInputRef2 = useRef<HTMLInputElement>(null);
  const [protocolo] = useState(() => `ROT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);

  /* ── WhatsApp ── */
  const [contatosWhats, setContatosWhats] = useState<ContatoWhats[]>([]);
  const [contatoSelecionado, setContatoSelecionado] = useState<string>('');
  const [whatsNome, setWhatsNome] = useState('');
  const [whatsTelefone, setWhatsTelefone] = useState('');
  const [showWhatsConfig, setShowWhatsConfig] = useState(false);

  useEffect(() => {
    Promise.all([
      roteirosApi.list(),
      moradoresApi.listWhatsContatos().catch(() => []),
    ]).then(([rots, contatos]) => {
      setRoteiros(rots as Roteiro[]);
      setContatosWhats(contatos as ContatoWhats[]);
      if ((contatos as ContatoWhats[]).length > 0) setContatoSelecionado((contatos as ContatoWhats[])[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const salvarNovoContato = async () => {
    if (!whatsNome.trim() || !whatsTelefone.trim()) return;
    try {
      const novo = await moradoresApi.addWhatsContato({ nome: whatsNome.trim(), telefone: whatsTelefone.trim() }) as ContatoWhats;
      setContatosWhats(prev => [...prev, novo]);
      if (!contatoSelecionado) setContatoSelecionado(novo.id);
    } catch (err) { console.error(err); }
    setWhatsNome('');
    setWhatsTelefone('');
  };

  const removerContato = async (id: string) => {
    try {
      await moradoresApi.removeWhatsContato(id);
      setContatosWhats(prev => prev.filter(c => c.id !== id));
      if (contatoSelecionado === id) setContatoSelecionado(contatosWhats.filter(c => c.id !== id)[0]?.id || '');
    } catch (err) { console.error(err); }
  };

  const formatarTelefone = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    return v;
  };

  /* ── Filtro ── */
  const filtrados = useMemo(() => {
    let lista = roteiros;
    if (filtroCategoria) lista = lista.filter(r => r.categoria === filtroCategoria);
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter(r => `${r.titulo} ${r.descricao} ${r.categoria}`.toLowerCase().includes(t));
    }
    return lista;
  }, [roteiros, busca, filtroCategoria]);

  /* ── Helpers form ── */
  const resetForm = () => {
    setEditando(null);
    setFormTitulo('');
    setFormDesc('');
    setFormCategoria('Limpeza');
    setFormCapa('');
    setFormPassos([]);
  };

  const abrirEditor = (r?: Roteiro) => {
    if (r) {
      setEditando(r);
      setFormTitulo(r.titulo);
      setFormDesc(r.descricao);
      setFormCategoria(r.categoria);
      setFormCapa(r.capa);
      setFormPassos(r.passos.map(p => ({ ...p })));
    } else {
      resetForm();
    }
    setAbaAtiva('criar');
  };

  const addPasso = () => {
    setFormPassos(prev => [...prev, {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titulo: '',
      descricao: '',
      imagens: [],
      videoUrl: '',
    }]);
  };

  const atualizarPasso = (id: string, campo: keyof PassoRoteiro, valor: any) => {
    setFormPassos(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };

  const removerPasso = (id: string) => {
    setFormPassos(prev => prev.filter(p => p.id !== id));
  };

  const addImagemPasso = (passoId: string, dataUrl: string) => {
    setFormPassos(prev => prev.map(p =>
      p.id === passoId && p.imagens.length < 5
        ? { ...p, imagens: [...p.imagens, dataUrl] }
        : p
    ));
  };

  const removerImagemPasso = (passoId: string, idx: number) => {
    setFormPassos(prev => prev.map(p =>
      p.id === passoId ? { ...p, imagens: p.imagens.filter((_, i) => i !== idx) } : p
    ));
  };

  const handleCapaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setFormCapa(ev.target.result as string); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const salvarRoteiro = async () => {
    if (!tentarAcao()) return;
    if (!formTitulo.trim() || formPassos.length === 0) return;
    try {
      if (editando) {
        await roteirosApi.update(editando.id, {
          titulo: formTitulo.trim(), descricao: formDesc.trim(), categoria: formCategoria,
          capa: formCapa, passos: formPassos,
        });
        setRoteiros(prev => prev.map(r => r.id === editando.id ? {
          ...r, titulo: formTitulo.trim(), descricao: formDesc.trim(), categoria: formCategoria,
          capa: formCapa, passos: formPassos, atualizadoEm: new Date().toISOString(),
        } : r));
      } else {
        const criado = await roteirosApi.create({
          titulo: formTitulo.trim(), descricao: formDesc.trim(), categoria: formCategoria,
          capa: formCapa, passos: formPassos,
          criadoPor: usuario?.nome || 'Sistema',
        }) as Roteiro;
        setRoteiros(prev => [criado, ...prev]);
      }
    } catch (err) { console.error(err); }
    resetForm();
    setAbaAtiva('lista');
  };

  const excluirRoteiro = async (id: string) => {
    if (!tentarAcao()) return;
    if (!confirm('Tem certeza que deseja excluir este roteiro? Esta ação não pode ser desfeita.')) return;
    try {
      await roteirosApi.remove(id);
      setRoteiros(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  };

  /* ── Execução (funcionário) ── */
  const iniciarExecucao = async (r: Roteiro) => {
    setExecRoteiro(r);
    try {
      const execs = await roteirosApi.listExecucoes(r.id) as ExecucaoRoteiro[];
      const existente = execs.find(e => e.funcionario === (usuario?.email || ''));
      if (existente) {
        setExecPassos(existente.passosExec.map(p => ({
          ...p,
          descAntes: p.descAntes || '',
          descDepois: p.descDepois || '',
          imagens: p.imagens || [],
          status: p.status || 'aberto',
          prioridade: p.prioridade || 'media',
        })));
      } else {
        setExecPassos(r.passos.map(p => ({ passoId: p.id, feito: false, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: '', imagens: [], problema: '', problemaEnviado: false, status: 'aberto', prioridade: 'media' })));
      }
    } catch {
      setExecPassos(r.passos.map(p => ({ passoId: p.id, feito: false, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: '', imagens: [], problema: '', problemaEnviado: false, status: 'aberto', prioridade: 'media' })));
    }
  };

  const togglePasso = (passoId: string) => {
    setExecPassos(prev => {
      const novos = prev.map(p => p.passoId === passoId ? { ...p, feito: !p.feito } : p);
      salvarExecLog(novos);
      return novos;
    });
  };

  const salvarExecLog = async (passos: ExecucaoPasso[]) => {
    if (!execRoteiro) return;
    try {
      await roteirosApi.addExecucao(execRoteiro.id, {
        funcionario: usuario?.email || '',
        passosExec: passos,
      });
    } catch { /* best-effort */ }
  };

  const atualizarExecPasso = (passoId: string, campo: keyof ExecucaoPasso, valor: any) => {
    setExecPassos(prev => {
      const novos = prev.map(p => p.passoId === passoId ? { ...p, [campo]: valor } : p);
      salvarExecLog(novos);
      return novos;
    });
  };

  /* ── Story navigation ── */
  const abrirStory = (r: Roteiro) => { setStoryRoteiro(r); setStoryIdx(0); setStoryImgIdx(0); };
  const fecharStory = () => { setStoryRoteiro(null); setStoryIdx(0); setStoryImgIdx(0); };
  const storyAnterior = () => {
    if (storyImgIdx > 0) {
      setStoryImgIdx(i => i - 1);
    } else if (storyIdx > 0) {
      const prevIdx = storyIdx - 1;
      const prevPasso = storyRoteiro?.passos[prevIdx];
      const totalImgs = prevPasso ? Math.max(prevPasso.imagens.length, 1) : 1;
      setStoryIdx(prevIdx);
      setStoryImgIdx(totalImgs - 1);
    }
  };
  const storyProximo = () => {
    if (!storyRoteiro) return;
    const passo = storyRoteiro.passos[storyIdx];
    const totalImgs = passo ? Math.max(passo.imagens.length, 1) : 1;
    if (storyImgIdx < totalImgs - 1) {
      setStoryImgIdx(i => i + 1);
    } else if (storyIdx < storyRoteiro.passos.length - 1) {
      setStoryIdx(i => i + 1);
      setStoryImgIdx(0);
    }
  };
  const ehPrimeiroSlide = storyIdx === 0 && storyImgIdx === 0;
  const ehUltimoSlide = storyRoteiro
    ? storyIdx === storyRoteiro.passos.length - 1 &&
      storyImgIdx >= Math.max((storyRoteiro.passos[storyIdx]?.imagens.length || 1) - 1, 0)
    : true;

  /* ── Helpers para modal foto ── */
  const handleFotoRoteiro = (tipo: 'antes' | 'depois', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modalFoto) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => {
      if (!ev.target?.result) return;
      const val = ev.target.result as string;
      const campo = tipo === 'antes' ? 'fotoAntes' : 'fotoDepois';
      atualizarExecPasso(modalFoto.exec.passoId, campo, val);
      setModalFoto(prev => prev ? { ...prev, exec: { ...prev.exec, [campo]: val } } : null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDescFoto = (tipo: 'antes' | 'depois', valor: string) => {
    if (!modalFoto) return;
    const campo = tipo === 'antes' ? 'descAntes' : 'descDepois';
    atualizarExecPasso(modalFoto.exec.passoId, campo, valor);
    setModalFoto(prev => prev ? { ...prev, exec: { ...prev.exec, [campo]: valor } } : null);
  };

  /* ── Helpers para modal problema ── */
  const handleImagemProblemaRoteiro = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !modalProblema) return;
    Array.from(files).forEach(file => {
      const erro = validarImagem(file);
      if (erro) { alert(erro); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        if (!ev.target?.result) return;
        const val = ev.target.result as string;
        setModalProblema(prev => {
          if (!prev) return null;
          const novas = [...prev.exec.imagens, val];
          atualizarExecPasso(prev.exec.passoId, 'imagens', novas);
          return { ...prev, exec: { ...prev.exec, imagens: novas } };
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removerImagemProblemaRoteiro = (idx: number) => {
    if (!modalProblema) return;
    const novas = (modalProblema.exec.imagens || []).filter((_, i) => i !== idx);
    atualizarExecPasso(modalProblema.exec.passoId, 'imagens', novas);
    setModalProblema(prev => prev ? { ...prev, exec: { ...prev.exec, imagens: novas } } : null);
  };

  /* ══════════════════════════════════ RENDER ══════════════════════════════════ */

  /** Modal Antes e Depois */
  const renderModalFoto = () => {
    if (!modalFoto) return null;
    const { passo, exec } = modalFoto;
    return (
      <Modal aberto={!!modalFoto} onFechar={() => setModalFoto(null)} titulo="Ante e Depois" largura="lg">
        <div className={styles.antesDepoisForm}>
          <p className={styles.modalItemDesc}>Item: <strong>{passo.titulo || 'Passo'}</strong></p>

          <div className={styles.antesDepoisGrid}>
            {/* ANTES */}
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}>
                <span className={styles.adBadgeAntes}>ANTES</span>
              </h4>
              {exec.fotoAntes ? (
                <div className={styles.adFotoContainer}>
                  <img src={exec.fotoAntes} alt="Antes" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => {
                    atualizarExecPasso(exec.passoId, 'fotoAntes', '');
                    setModalFoto(prev => prev ? { ...prev, exec: { ...prev.exec, fotoAntes: '' } } : null);
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => antesInputRef2.current?.click()}>
                  <Camera size={32} />
                  <span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={antesInputRef2} type="file" accept="image/*" hidden onChange={e => handleFotoRoteiro('antes', e)} />
              <textarea
                className={styles.formTextarea}
                placeholder="Descrição do estado antes..."
                value={exec.descAntes}
                onChange={e => handleDescFoto('antes', e.target.value)}
                rows={3}
              />
            </div>

            {/* DEPOIS */}
            <div className={styles.adColuna}>
              <h4 className={styles.adTitulo}>
                <span className={styles.adBadgeDepois}>DEPOIS</span>
              </h4>
              {exec.fotoDepois ? (
                <div className={styles.adFotoContainer}>
                  <img src={exec.fotoDepois} alt="Depois" className={styles.adFoto} />
                  <button className={styles.adFotoRemover} onClick={() => {
                    atualizarExecPasso(exec.passoId, 'fotoDepois', '');
                    setModalFoto(prev => prev ? { ...prev, exec: { ...prev.exec, fotoDepois: '' } } : null);
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className={styles.adUploadArea} onClick={() => depoisInputRef2.current?.click()}>
                  <Camera size={32} />
                  <span>Tirar / Selecionar Foto</span>
                </button>
              )}
              <input ref={depoisInputRef2} type="file" accept="image/*" hidden onChange={e => handleFotoRoteiro('depois', e)} />
              <textarea
                className={styles.formTextarea}
                placeholder="Descrição do estado depois..."
                value={exec.descDepois}
                onChange={e => handleDescFoto('depois', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Comparação */}
          {exec.fotoAntes && exec.fotoDepois && (
            <div className={styles.adComparacao}>
              <h4 className={styles.adCompTitulo}>Comparação</h4>
              <div className={styles.adCompGrid}>
                <div className={styles.adCompItem}>
                  <span className={styles.adBadgeAntes}>ANTES</span>
                  <img src={exec.fotoAntes} alt="Antes" />
                  <p>{exec.descAntes || 'Sem descrição'}</p>
                </div>
                <div className={styles.adCompItem}>
                  <span className={styles.adBadgeDepois}>DEPOIS</span>
                  <img src={exec.fotoDepois} alt="Depois" />
                  <p>{exec.descDepois || 'Sem descrição'}</p>
                </div>
              </div>
            </div>
          )}

          <button className={styles.formSubmit} onClick={() => { alert('Registro salvo com sucesso!'); setModalFoto(null); }}>
            <Camera size={16} /> Salvar Registro
          </button>
        </div>
      </Modal>
    );
  };

  /** Modal Reportar Problema */
  const renderModalProblema = () => {
    if (!modalProblema) return null;
    const { passo, exec } = modalProblema;
    return (
      <Modal aberto={!!modalProblema} onFechar={() => setModalProblema(null)} titulo="Reportar Problema" largura="md">
        <div className={styles.problemaForm}>
          <div className={styles.protocoloHeader}>
            <div className={styles.protocoloTag}>
              <Hash size={14} />
              <span>{protocolo}</span>
            </div>
          </div>
          <p className={styles.modalItemDesc}>Item: <strong>{passo.titulo || 'Passo'}</strong></p>

          <label className={styles.formLabel}>Imagens</label>
          <div className={styles.imagensArea}>
            {(exec.imagens || []).map((img, i) => (
              <div key={i} className={styles.imagemThumb}>
                <img src={img} alt={`Imagem ${i + 1}`} />
                <button className={styles.imagemRemover} onClick={() => removerImagemProblemaRoteiro(i)}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button className={styles.imagemAdd} onClick={() => problemaInputRef2.current?.click()}>
              <Upload size={20} />
              <span>Adicionar</span>
            </button>
            <input ref={problemaInputRef2} type="file" accept="image/*" multiple hidden onChange={handleImagemProblemaRoteiro} />
          </div>

          <label className={styles.formLabel}>Descrição do Problema</label>
          <textarea
            className={styles.formTextarea}
            placeholder="Descreva o problema encontrado..."
            value={exec.problema}
            onChange={e => {
              const v = e.target.value;
              atualizarExecPasso(exec.passoId, 'problema', v);
              setModalProblema(prev => prev ? { ...prev, exec: { ...prev.exec, problema: v } } : null);
            }}
            rows={4}
          />

          <div className={styles.formRow2}>
            <div className={styles.formGroup2}>
              <label className={styles.formLabel}>Status</label>
              <select className={styles.formSelect} value={exec.status}
                onChange={e => {
                  const v = e.target.value;
                  atualizarExecPasso(exec.passoId, 'status', v);
                  setModalProblema(prev => prev ? { ...prev, exec: { ...prev.exec, status: v } } : null);
                }}>
                <option value="aberto">Aberto</option>
                <option value="em_analise">Em Análise</option>
                <option value="resolvido">Resolvido</option>
              </select>
            </div>
            <div className={styles.formGroup2}>
              <label className={styles.formLabel}>Prioridade</label>
              <select className={styles.formSelect} value={exec.prioridade}
                onChange={e => {
                  const v = e.target.value;
                  atualizarExecPasso(exec.passoId, 'prioridade', v);
                  setModalProblema(prev => prev ? { ...prev, exec: { ...prev.exec, prioridade: v } } : null);
                }}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {exec.problemaEnviado ? (
            <div className={styles.reporteEnviado}>
              <CheckCircle2 size={18} />
              Problema reportado com sucesso
            </div>
          ) : (
            <button
              className={styles.formSubmit}
              disabled={!exec.problema.trim()}
              onClick={() => {
                atualizarExecPasso(exec.passoId, 'problemaEnviado', true);
                setModalProblema(prev => prev ? { ...prev, exec: { ...prev.exec, problemaEnviado: true } } : null);
              }}
            >
              <AlertTriangle size={16} /> Enviar Reporte
            </button>
          )}

          {/* WhatsApp */}
          <div className={styles.whatsSection}>
            <div className={styles.whatsHeader}>
              <button
                className={styles.whatsBtn}
                onClick={() => {
                  const contato = contatosWhats.find(c => c.id === contatoSelecionado);
                  if (!contato) { setShowWhatsConfig(true); return; }
                  const num = contato.telefone.replace(/\D/g, '');
                  const texto = encodeURIComponent(`*Problema Reportado*\n*Protocolo:* ${protocolo}\n\n*Item:* ${passo.titulo || 'Passo'}\n*Descrição:* ${exec.problema || 'N/A'}\n*Status:* ${exec.status}\n*Prioridade:* ${exec.prioridade}\n*Enviado para:* ${contato.nome}`);
                  window.open(`https://wa.me/55${num}?text=${texto}`, '_blank');
                }}
              >
                <MessageCircle size={18} /> Enviar para WhatsApp
              </button>
              <button
                className={`${styles.whatsConfigBtn} ${showWhatsConfig ? styles.whatsConfigBtnActive : ''}`}
                onClick={() => setShowWhatsConfig(prev => !prev)}
                title="Configurar Contatos"
              >
                <Settings size={18} />
              </button>
            </div>

            {contatosWhats.length > 0 && (
              <div className={styles.whatsContatoSelect}>
                <label className={styles.formLabel}>Enviar para:</label>
                <select
                  className={styles.formSelect}
                  value={contatoSelecionado}
                  onChange={e => setContatoSelecionado(e.target.value)}
                >
                  {contatosWhats.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>
                  ))}
                </select>
              </div>
            )}

            {showWhatsConfig && (
              <div className={styles.whatsConfigPanel}>
                <h5 className={styles.whatsConfigTitle}>Adicionar Contato</h5>
                <div className={styles.whatsConfigFields}>
                  <div className={styles.formGroup2}>
                    <label className={styles.formLabel}>Nome</label>
                    <input
                      className={styles.formInput}
                      placeholder="Nome do contato"
                      value={whatsNome}
                      onChange={e => setWhatsNome(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup2}>
                    <label className={styles.formLabel}>WhatsApp</label>
                    <input
                      className={styles.formInput}
                      placeholder="(00) 00000-0000"
                      value={whatsTelefone}
                      maxLength={15}
                      onChange={e => setWhatsTelefone(formatarTelefone(e.target.value))}
                    />
                  </div>
                  <button className={styles.whatsSaveBtn} onClick={salvarNovoContato}>
                    <Save size={15} /> Salvar
                  </button>
                </div>

                {contatosWhats.length > 0 && (
                  <div className={styles.whatsContatosList}>
                    <h5 className={styles.whatsConfigTitle}>Contatos Salvos</h5>
                    {contatosWhats.map((c, i) => (
                      <div key={c.id} className={styles.whatsContatoItem}>
                        <div className={styles.whatsContatoInfo}>
                          <strong>{c.nome}</strong>
                          <span>{c.telefone}</span>
                          {i === 0 && <span className={styles.whatsContatoBadge}>Padrão</span>}
                        </div>
                        <button className={styles.whatsContatoRemover} onClick={() => removerContato(c.id)} title="Remover">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  };

  /** Story fullscreen view */
  const renderStory = () => {
    if (!storyRoteiro) return null;
    const passo = storyRoteiro.passos[storyIdx];
    if (!passo) return null;
    const embedUrl = youtubeEmbedUrl(passo.videoUrl);
    const totalImgs = Math.max(passo.imagens.length, 1);
    const imgAtual = passo.imagens[storyImgIdx] || passo.imagens[0];

    // Calcular total de slides para progress bar
    const slides: { passoIdx: number; imgIdx: number }[] = [];
    storyRoteiro.passos.forEach((p, pi) => {
      const n = Math.max(p.imagens.length, 1);
      for (let ii = 0; ii < n; ii++) slides.push({ passoIdx: pi, imgIdx: ii });
    });
    const slideAtual = slides.findIndex(s => s.passoIdx === storyIdx && s.imgIdx === storyImgIdx);

    return (
      <div className={styles.storyOverlay}>
        <div className={styles.storyContainer}>
          {/* Progress bars */}
          <div className={styles.storyProgress}>
            {slides.map((s, i) => (
              <div key={i} className={styles.storyProgressBar}>
                <div className={styles.storyProgressFill} style={{ width: i <= slideAtual ? '100%' : '0%' }} />
              </div>
            ))}
          </div>
          {/* Header */}
          <div className={styles.storyHeader}>
            <div className={styles.storyHeaderInfo}>
              <div className={styles.storyHeaderAvatar}><BookOpen size={18} /></div>
              <div className={styles.storyHeaderTexto}>
                <h4>{storyRoteiro.titulo}</h4>
                <span>Passo {storyIdx + 1} de {storyRoteiro.passos.length}{totalImgs > 1 ? ` — Foto ${storyImgIdx + 1}/${totalImgs}` : ''}</span>
              </div>
            </div>
            <button className={styles.storyFechar} onClick={fecharStory}><X size={22} /></button>
          </div>
          {/* Content */}
          <div className={styles.storyContent} onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width * 0.35) storyAnterior();
            else if (x > rect.width * 0.65) storyProximo();
          }}>
            <div className={styles.storyMidia}>
              {passo.imagens.length > 0 && imgAtual ? (
                <img src={imgAtual} alt={`${passo.titulo} - foto ${storyImgIdx + 1}`} />
              ) : embedUrl ? (
                <iframe src={embedUrl} title={passo.titulo} allowFullScreen />
              ) : (
                <div className={styles.storyMidiaNone}><Image size={48} /></div>
              )}
            </div>
            <div className={styles.storyTexto}>
              <div className={styles.storyPassoNum}>Passo {storyIdx + 1}</div>
              <h3 className={styles.storyPassoTitulo}>{passo.titulo || `Passo ${storyIdx + 1}`}</h3>
              <p className={styles.storyPassoDesc}>{passo.descricao}</p>
            </div>
          </div>
          {/* Setas de navegação */}
          <div className={styles.storyNavBtns}>
            <button className={styles.storyNavBtn} onClick={storyAnterior} disabled={ehPrimeiroSlide}>
              <ChevronLeft size={28} />
            </button>
            <button className={styles.storyNavBtn} onClick={storyProximo} disabled={ehUltimoSlide}>
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  /** Render editor de passos */
  const renderPassoEditor = (passo: PassoRoteiro, idx: number) => {
    const embedUrl = youtubeEmbedUrl(passo.videoUrl);
    return (
      <div key={passo.id} className={styles.passoCard}>
        <div className={styles.passoCardHeader}>
          <div className={styles.passoNumero}>{idx + 1}</div>
          <input
            className={styles.passoTituloInput}
            placeholder={`Título do passo ${idx + 1}`}
            value={passo.titulo}
            onChange={e => atualizarPasso(passo.id, 'titulo', e.target.value)}
          />
          <button className={styles.passoRemover} onClick={() => removerPasso(passo.id)} title="Remover passo">
            <Trash2 size={16} />
          </button>
        </div>
        <textarea
          className={styles.passoDescTextarea}
          placeholder="Descreva o que o funcionário precisa fazer neste passo..."
          value={passo.descricao}
          onChange={e => atualizarPasso(passo.id, 'descricao', e.target.value)}
          rows={3}
        />
        {/* Mídia */}
        <div className={styles.passoMidia}>
          <div className={styles.passoMidiaLabel}>Imagens (até 5)</div>
          <div className={styles.passoImgPreview}>
            {passo.imagens.map((img, imgIdx) => (
              <div key={imgIdx} className={styles.passoImgThumb}>
                <img src={img} alt={`img-${imgIdx}`} />
                <button className={styles.passoImgRemover} onClick={() => removerImagemPasso(passo.id, imgIdx)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {passo.imagens.length < 5 && (
              <label className={styles.btnUploadImg}>
                <Upload size={14} /> Foto
                <input type="file" accept="image/*" hidden
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const erro = validarImagem(file);
                    if (erro) { alert(erro); e.target.value = ''; return; }
                    const reader = new FileReader();
                    reader.onload = ev => { if (ev.target?.result) addImagemPasso(passo.id, ev.target.result as string); };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <div className={styles.passoMidiaLabel}>Vídeo do YouTube</div>
            <div className={styles.passoMidiaRow}>
              <input
                className={styles.passoMidiaInput}
                placeholder="Cole o link do YouTube aqui..."
                value={passo.videoUrl}
                onChange={e => atualizarPasso(passo.id, 'videoUrl', e.target.value)}
              />
            </div>
            {embedUrl && (
              <div className={styles.passoVideoPreview}>
                <iframe src={embedUrl} title="preview" allowFullScreen />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /** Execução — checklist do funcionário */
  const renderExecucao = () => {
    if (!execRoteiro) return null;
    const total = execPassos.length;
    const feitos = execPassos.filter(p => p.feito).length;
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    return (
      <>
        <div className={styles.execContainer}>
          <div className={styles.execHeader}>
            <h2 className={styles.execHeaderTitulo}>{execRoteiro.titulo}</h2>
            <p className={styles.execHeaderDesc}>{execRoteiro.descricao}</p>
          </div>
          <div className={styles.execProgress}>
            <div className={styles.execProgressBar}>
              <div className={styles.execProgressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.execProgressText}>{feitos}/{total} ({pct}%)</span>
          </div>
          <div className={styles.execPassosList}>
            {execRoteiro.passos.map((passo, idx) => {
              const exec = execPassos.find(e => e.passoId === passo.id);
              if (!exec) return null;
              return (
                <div key={passo.id} className={styles.execPasso}>
                  <button
                    className={`${styles.execPassoCheck} ${exec.feito ? styles.execPassoCheckFeito : ''}`}
                    onClick={() => togglePasso(passo.id)}
                  >
                    {exec.feito && <CheckCircle2 size={18} />}
                  </button>
                  <div className={styles.execPassoBody}>
                    <p className={`${styles.execPassoTitulo} ${exec.feito ? styles.execPassoTituloFeito : ''}`}>
                      {passo.titulo || `Passo ${idx + 1}`}
                    </p>
                    {passo.descricao && (
                      <p className={`${styles.execPassoDesc} ${exec.feito ? styles.execPassoDescFeito : ''}`}>
                        {passo.descricao}
                      </p>
                    )}
                  </div>
                  <div className={styles.execPassoAcoes}>
                    {(passo.imagens.length > 0 || passo.videoUrl) && (
                      <button className={styles.btnStory} onClick={() => abrirStory(execRoteiro)} title="Ver instruções">
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      className={styles.btnTresPontos}
                      onClick={() => setModalFoto({ passo, exec })}
                      title="Foto antes/depois"
                    >
                      <Camera size={16} />
                    </button>
                    <button
                      className={styles.btnTresPontos}
                      onClick={() => setModalProblema({ passo, exec })}
                      title="Reportar problema"
                    >
                      <AlertTriangle size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button className={styles.btnCancelar} onClick={() => setExecRoteiro(null)} style={{ alignSelf: 'flex-start' }}>
          <ChevronLeft size={16} /> Voltar à lista
        </button>
      </>
    );
  };

  /* ═══════════════════════════════ MAIN RETURN ═══════════════════════════════ */

  // Se está executando um roteiro (funcionário)
  if (execRoteiro) {
    return (
      <div id="roteiro-content" className={styles.container}>
        <PageHeader
          titulo="Roteiro de Execução"
          subtitulo={execRoteiro.titulo}
          onCompartilhar={() => compartilharConteudo('Roteiro', execRoteiro.titulo)}
          onImprimir={() => imprimirElemento('roteiro-content')}
          onGerarPdf={() => gerarPdfDeElemento('roteiro-content', 'roteiro')}
        />
        {renderExecucao()}
        {renderStory()}
        {renderModalFoto()}
        {renderModalProblema()}
      </div>
    );
  }

  const pag = usePagination(filtrados, { pageSize: 12 });

  if (loading) return <LoadingSpinner texto="Carregando roteiros..." />;

  return (
    <div id="roteiro-content" className={styles.container}>
      <HowItWorks
        titulo="Roteiro de Execução"
        descricao="Crie roteiro visuais passo a passo com fotos, vídeos e descrições para guiar os funcionários na execução dos serviços."
        passos={[
          'Master, Administrador ou Supervisor criam roteiros com título, descrição e passos detalhados',
          'Cada passo pode ter fotos ilustrativas e link de vídeo do YouTube',
          'Funcionários visualizam como um Story e seguem o checklist riscando cada passo',
          'No menu de 3 pontos, o funcionário registra foto do antes/depois e reporta problemas',
          'Todo progresso é salvo automaticamente para acompanhamento',
        ]}
      />

      <PageHeader
        titulo="Roteiro de Execução"
        subtitulo={`${filtrados.length} roteiros`}
        onCompartilhar={() => compartilharConteudo('Roteiros', 'Lista de roteiros de execução')}
        onImprimir={() => imprimirElemento('roteiro-content')}
        onGerarPdf={() => gerarPdfDeElemento('roteiro-content', 'roteiros')}
        acoes={
          podeCriar ? (
            <button className={styles.btnSalvar} onClick={() => abrirEditor()}>
              <Plus size={18} /> <span>Novo Roteiro</span>
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      {podeCriar && (
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${abaAtiva === 'lista' ? styles.tabAtiva : ''}`} onClick={() => setAbaAtiva('lista')}>
            <Layers size={18} /> Roteiros <span className={styles.tabBadge}>{roteiros.length}</span>
          </button>
          <button className={`${styles.tab} ${abaAtiva === 'criar' ? styles.tabAtiva : ''}`} onClick={() => abrirEditor()}>
            <Plus size={18} /> {editando ? 'Editar Roteiro' : 'Criar Roteiro'}
          </button>
        </div>
      )}

      {/* ═══ ABA LISTA ═══ */}
      {abaAtiva === 'lista' && (
        <>
          <div className={styles.filtros}>
            <input
              className={styles.filtroInput}
              placeholder="Buscar roteiros..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <select className={styles.filtroSelect} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas categorias</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {filtrados.length === 0 ? (
            <Card>
              <div className={styles.listaVazia}>
                <BookOpen size={48} />
                <h4>Nenhum roteiro encontrado</h4>
                <p>{podeCriar ? 'Crie o primeiro roteiro para guiar sua equipe.' : 'Ainda não há roteiros disponíveis.'}</p>
              </div>
            </Card>
          ) : (
            <div className={styles.roteiroGrid}>
              {pag.items.map(r => (
                <div key={r.id} className={styles.roteiroCard}>
                  <div className={styles.roteiroCardCapa}>
                    {r.capa ? (
                      <>
                        <img src={r.capa} alt="Capa" />
                        <div className={styles.roteiroCardCapaOverlay} />
                      </>
                    ) : (
                      <BookOpen size={48} className={styles.roteiroCardCapaIcone} />
                    )}
                  </div>
                  <div className={styles.roteiroCardBody}>
                    <h3 className={styles.roteiroCardTitulo}>{r.titulo}</h3>
                    <p className={styles.roteiroCardDesc}>{r.descricao || 'Sem descrição'}</p>
                    <div className={styles.roteiroCardMeta}>
                      <span><Layers size={13} /> {r.passos.length} passos</span>
                      <span><FileText size={13} /> {r.categoria}</span>
                      <span><Clock size={13} /> {new Date(r.criadoEm).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className={styles.roteiroCardActions}>
                      <button className={styles.btnVer} onClick={() => ehFuncionario ? iniciarExecucao(r) : abrirStory(r)}>
                        <Eye size={15} /> {ehFuncionario ? 'Executar' : 'Visualizar'}
                      </button>
                      {podeCriar && (
                        <>
                          <button className={styles.btnEditar} onClick={() => abrirEditor(r)}>
                            <Edit3 size={15} /> Editar
                          </button>
                          <button className={styles.btnExcluir} onClick={() => excluirRoteiro(r.id)}>
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                      {ehFuncionario && (
                        <button className={styles.btnEditar} onClick={() => abrirStory(r)}>
                          <Play size={15} /> Story
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />
        </>
      )}

      {/* ═══ ABA CRIAR/EDITAR ═══ */}
      {abaAtiva === 'criar' && podeCriar && (
        <div className={styles.formSection}>
          <h3 className={styles.formTitle}>
            <BookOpen size={20} /> {editando ? 'Editar Roteiro' : 'Novo Roteiro de Execução'}
          </h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Título do Roteiro *</label>
            <input className={styles.formInput} placeholder="Ex: Limpeza do Banheiro Social" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descrição</label>
            <textarea className={styles.formTextarea} placeholder="Descreva o objetivo deste roteiro..." value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria</label>
              <select className={styles.formInput} value={formCategoria} onChange={e => setFormCategoria(e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Imagem de capa</label>
              <label className={styles.btnUploadImg} style={{ padding: '10px 14px' }}>
                <Image size={16} /> {formCapa ? 'Trocar capa' : 'Upload capa'}
                <input ref={capaInputRef} type="file" accept="image/*" hidden onChange={handleCapaUpload} />
              </label>
              {formCapa && <img src={formCapa} alt="capa" style={{ width: 120, height: 70, objectFit: 'cover', borderRadius: 8, marginTop: 6, border: '1px solid var(--cor-borda)' }} />}
            </div>
          </div>

          {/* Passos */}
          <div style={{ marginTop: 24 }}>
            <div className={styles.passosHeader}>
              <div className={styles.passosTitle}>
                <Layers size={18} /> Passos do Roteiro <span className={styles.passosCount}>{formPassos.length}</span>
              </div>
              <button className={styles.btnAddPasso} onClick={addPasso}>
                <Plus size={16} /> Adicionar Passo
              </button>
            </div>
            {formPassos.length === 0 ? (
              <Card>
                <div className={styles.listaVazia}>
                  <Layers size={36} />
                  <h4>Nenhum passo adicionado</h4>
                  <p>Clique em sAdicionar Passos para criar o passo a passo do roteiro.</p>
                </div>
              </Card>
            ) : (
              <div className={styles.passosList}>
                {formPassos.map((passo, idx) => renderPassoEditor(passo, idx))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button className={styles.btnSalvar} onClick={salvarRoteiro} disabled={!formTitulo.trim() || formPassos.length === 0}>
              <Save size={16} /> {editando ? 'Salvar Alterações' : 'Criar Roteiro'}
            </button>
            <button className={styles.btnCancelar} onClick={() => { resetForm(); setAbaAtiva('lista'); }}>
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {renderStory()}
      {renderModalFoto()}
      {renderModalProblema()}
    </div>
  );
};

export default RoteiroExecucaoPage;
