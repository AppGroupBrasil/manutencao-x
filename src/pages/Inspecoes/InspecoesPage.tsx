import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDemo } from '../../contexts/DemoContext';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { formatarDataHora } from '../../utils/dateUtils';
import { Plus, Search, CheckCircle, XCircle, AlertCircle, Camera, Mic, MicOff, Trash2, Image } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { inspecoes as inspecoesApi, condominios as condominiosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import EmptyState from '../../components/Common/EmptyState';
import Pagination from '../../components/Common/Pagination';
import { usePagination } from '../../hooks/usePagination';
import WhatsAppShare from '../../components/Common/WhatsAppShare';
import styles from './Inspecoes.module.css';

const MAX_GRAVACAO_SEG = 30;

const CORES = ['#2e7d32', '#d32f2f'];

const InspecoesPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [inspecoes, setInspecoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNova, setModalNova] = useState(false);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [novaCond, setNovaCond] = useState('');
  const [novaLocal, setNovaLocal] = useState('');
  const [novaTipo, setNovaTipo] = useState('areas_comuns');
  const [novaObs, setNovaObs] = useState('');

  // --- Fotos ---
  const [fotos, setFotos] = useState<{ file: File; preview: string }[]>([]);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const adicionarFotos = useCallback((files: FileList | null) => {
    if (!files) return;
    const novas = Array.from(files).map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setFotos(prev => [...prev, ...novas]);
  }, []);

  const removerFoto = useCallback((idx: number) => {
    setFotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // --- Gravação de áudio ---
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarGravacao = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => {
        setTempoGravacao(prev => {
          if (prev + 1 >= MAX_GRAVACAO_SEG) {
            mediaRecorderRef.current?.stop();
            setGravando(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_GRAVACAO_SEG;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  }, []);

  const pararGravacao = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setGravando(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const removerAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setTempoGravacao(0);
  }, [audioUrl]);

  useEffect(() => {
    inspecoesApi.list().then((data: any[]) => setInspecoes(data)).catch(() => {}).finally(() => setLoading(false));
    condominiosApi.list().then((data: any[]) => { setCondominiosList(data); if (data.length > 0) setNovaCond(data[0].id); }).catch(() => {});
  }, []);

  const conformes = inspecoes.filter(i => i.status === 'conforme').length;
  const naoConformes = inspecoes.filter(i => i.status === 'nao_conforme').length;
  const CHART = [
    { nome: 'Conformes', valor: conformes },
    { nome: 'Não Conformes', valor: naoConformes },
  ];

  const pag = usePagination(inspecoes, { pageSize: 15 });

  if (loading) return <LoadingSpinner texto="Carregando inspeções..." />;

  return (
    <div id="inspecoes-content">
      <HowItWorks
        titulo="Inspeções"
        descricao="Realize inspeçõe detalhadas nas áreas dos condomínios. Registre conformidades, tire fotos e gere relatórios."
        passos={[
          'Selecione o tipo de inspeção (áreas comuns, elevadores, piscina, garagem, jardim, fachada)',
          'Preencha os itens de verificação conforme o checklist de inspeção',
          'Registre fotos e observações para cada item',
          'Classificar como conforme ou não conforme',
          'O sistema gera relatório automático da inspeção',
        ]}
      />

      <PageHeader
        titulo="Inspeções"
        subtitulo={`${inspecoes.length} inspeções realizadas`}
        onCompartilhar={() => compartilharConteudo('Inspeções', 'Histórico de inspeções')}
        onImprimir={() => imprimirElemento('inspecoes-content')}
        onGerarPdf={() => gerarPdfDeElemento('inspecoes-content', 'inspecoes')}
        acoes={
          <button className={styles.addBtn} onClick={() => setModalNova(true)}>
            <Plus size={18} /> <span>Nova Inspeção</span>
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5cm' }}>
        {inspecoes.length === 0 ? (
          <EmptyState
            icon={<Search size={48} strokeWidth={1.5} />}
            titulo="Nenhuma inspeção registrada"
            descricao="Crie uma inspeção para começar a registrar conformidades."
          />
        ) : pag.items.map(insp => (
          <Card key={insp.id} hover padding="md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--cor-texto-secundario)' }}>{insp.id}</span>
              <StatusBadge texto={insp.status === 'conforme' ? 'Conforme' : 'Não Conforme'} variante={insp.status === 'conforme' ? 'sucesso' : 'perigo'} />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--cor-texto)', margin: '0 0 4px' }}>{insp.cond} - {insp.local}</h4>
            <span style={{ fontSize: 12, color: 'var(--cor-primaria)', fontWeight: 600, textTransform: 'capitalize' }}>{insp.tipo.replace('_', ' ')}</span>
            <p style={{ fontSize: 13, color: 'var(--cor-texto-secundario)', margin: '8px 0' }}>{insp.obs}</p>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--cor-texto-secundario)' }}>
              <span>Inspetor: <strong>{insp.inspetor}</strong></span>
              <span>Itens: {insp.conformes}/{insp.itens}</span>
              <span>{formatarDataHora(insp.data)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <WhatsAppShare mensagem={`*Inspeção*\n*Condomínio:* ${insp.cond}\n*Local:* ${insp.local}\n*Tipo:* ${insp.tipo.replace('_', ' ')}\n*Resultado:* ${insp.status === 'conforme' ? 'Conforme' : 'Não Conforme'}\n*Itens Conformes:* ${insp.conformes}/${insp.itens}\n*Inspetor:* ${insp.inspetor}\n*Observações:* ${insp.obs || 'N/A'}`} />
            </div>
          </Card>
        ))}
      </div>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--cor-texto)' }}>Resultado das Inspeções</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={CHART} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="valor" nameKey="nome" label>
                {CHART.map((_, i) => <Cell key={i} fill={CORES[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Modal Nova Inspeção */}
      <Modal aberto={modalNova} onFechar={() => setModalNova(false)} titulo="Nova Inspeção" largura="lg">
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Condomínio</label>
            <select value={novaCond} onChange={e => setNovaCond(e.target.value)}>
              {condominiosList.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              {condominiosList.length === 0 && <option value="">Nenhum condomínio cadastrado</option>}
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Tipo de Inspeção</label>
              <select value={novaTipo} onChange={e => setNovaTipo(e.target.value)}>
                <option value="areas_comuns">Áreas Comuns</option>
                <option value="elevadores">Elevadores</option>
                <option value="piscina">Piscina</option>
                <option value="garagem">Garagem</option>
                <option value="jardim">Jardim</option>
                <option value="fachada">Fachada</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Local Específico</label>
              <input placeholder="Ex: Bloco A - Hall de entrada" value={novaLocal} onChange={e => setNovaLocal(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Observações</label>
            <textarea rows={3} placeholder="Descreva detalhe da inspeção..." value={novaObs} onChange={e => setNovaObs(e.target.value)} />
          </div>

          {/* --- Fotos --- */}
          <div className={styles.formGroup}>
            <label><Image size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Fotos</label>
            <input ref={inputFotoRef} type="file" accept="image/*" multiple hidden onChange={e => adicionarFotos(e.target.files)} />
            <div className={styles.fotosArea}>
              {fotos.map((f, i) => (
                <div key={i} className={styles.fotoThumb}>
                  <img src={f.preview} alt={`Foto ${i + 1}`} />
                  <button type="button" className={styles.fotoRemover} onClick={() => removerFoto(i)}><Trash2 size={12} /></button>
                </div>
              ))}
              <button type="button" className={styles.fotoAddBtn} onClick={() => inputFotoRef.current?.click()}>
                <Camera size={20} />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          {/* --- Áudio (microfone, máx 30s) --- */}
          <div className={styles.formGroup}>
            <label><Mic size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Áudio (máx {MAX_GRAVACAO_SEG}s)</label>
            <div className={styles.audioArea}>
              {!audioUrl && !gravando && (
                <button type="button" className={styles.micBtn} onClick={iniciarGravacao}>
                  <Mic size={18} /> Gravar áudio
                </button>
              )}
              {gravando && (
                <div className={styles.gravandoContainer}>
                  <span className={styles.gravandoDot} />
                  <span className={styles.gravandoTempo}>{tempoGravacao}s / {MAX_GRAVACAO_SEG}s</span>
                  <button type="button" className={styles.micBtnParar} onClick={pararGravacao}>
                    <MicOff size={16} /> Parar
                  </button>
                </div>
              )}
              {audioUrl && !gravando && (
                <div className={styles.audioPreview}>
                  <audio controls src={audioUrl} style={{ flex: 1, height: 36 }} />
                  <button type="button" className={styles.audioRemoverBtn} onClick={removerAudio}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </div>

          <button type="button" className={styles.submitBtn} onClick={async () => {
            try {
              const created = await inspecoesApi.create({
                condominioId: novaCond,
                tipo: novaTipo,
                local: novaLocal.trim(),
                obs: novaObs.trim(),
              } as any);
              setInspecoes(prev => [created, ...prev]);
            } catch { /* sem API, apenas fecha */ }
            fotos.forEach(f => URL.revokeObjectURL(f.preview));
            setFotos([]);
            removerAudio();
            setNovaLocal(''); setNovaObs(''); setNovaTipo('areas_comuns');
            setModalNova(false);
          }}>
            <Plus size={18} /> Criar Inspeção
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default InspecoesPage;
