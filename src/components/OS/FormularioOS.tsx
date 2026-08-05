import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, FileDown, FileText, Paperclip, Printer, Save, Trash2 } from 'lucide-react';
import Modal from '../Common/Modal';
import LoadingSpinner from '../Common/LoadingSpinner';
import StatusBadge, { prioridadeBadge, statusOSBadge } from '../Common/StatusBadge';
import WhatsAppShare from '../Common/WhatsAppShare';
import ShareButton from '../Common/ShareButton';
import { useAuth } from '../../contexts/AuthContext';
import { ordensServico as osApi } from '../../services/api';
import { ACCEPT_ANEXOS, ACCEPT_CAMERA, ehAnexoArquivo, enviarAnexo, urlAnexoSegura } from '../../utils/anexos';
import { compartilharConteudo, gerarPdfDeElementoPaginado, imprimirElemento } from '../../utils/exportUtils';
import styles from './FormularioOS.module.css';

type Fase = 'antes' | 'depois';

interface Props {
  osId: string | null;
  onFechar: () => void;
  onAtualizado?: (row: any) => void;
  somenteLeitura?: boolean;
}

const TIPOS = [
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'preventiva', label: 'Preventiva' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const STATUS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const FORM_VAZIO = {
  titulo: '', descricao: '', tipo: 'limpeza', prioridade: 'media', status: 'aberta',
  local: '', dataPrevisao: '', observacoes: '', custoMaterial: '', custoMaoObra: '', custoExterno: '',
};

const rotulo = (lista: { value: string; label: string }[], valor: string) =>
  lista.find(i => i.value === valor)?.label || valor || '—';

function dataBR(valor?: string | number | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function soData(valor?: string | null): string {
  return valor ? String(valor).slice(0, 10) : '';
}

function numeroTexto(valor: unknown): string {
  const n = Number(valor);
  return !valor || isNaN(n) || n === 0 ? '' : String(n);
}

function valorPositivo(valor: string): number {
  const n = Number(valor);
  return isNaN(n) || n < 0 ? 0 : n;
}

function moeda(valor: unknown): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function urlAbsoluta(url?: string | null): string {
  const segura = urlAnexoSegura(url);
  if (segura === '#') return '#';
  return segura.startsWith('/') ? `${window.location.origin}${segura}` : segura;
}

const chaveNome = (nome: unknown) => `nome:${String(nome || '').trim().toLowerCase()}`;

function chaveResponsavel(r: any): string {
  const uid = r.usuarioId ?? r.usuario_id;
  return uid ? `id:${uid}` : chaveNome(r.nome);
}

function chaveCandidato(c: any): string {
  return c.id ? `id:${c.id}` : chaveNome(c.nome);
}

export default function FormularioOS({ osId, onFechar, onAtualizado, somenteLeitura }: Props) {
  const { usuario } = useAuth();
  const [os, setOs] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [statusOriginal, setStatusOriginal] = useState('aberta');
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [responsaveisOriginais, setResponsaveisOriginais] = useState<string[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const [enviandoFase, setEnviandoFase] = useState<Fase | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const faseAlvo = useRef<Fase>('antes');
  const blocoImpressao = useRef<HTMLDivElement>(null);

  const editavel = !somenteLeitura;
  const statusDisponiveis = usuario?.role === 'funcionario'
    ? STATUS.filter(s => s.value !== 'cancelada' || form.status === 'cancelada')
    : STATUS;

  const aplicar = (row: any) => {
    setOs(row);
    setForm({
      titulo: row.titulo || '',
      descricao: row.descricao || '',
      tipo: row.tipo || 'limpeza',
      prioridade: row.prioridade || 'media',
      status: row.status || 'aberta',
      local: row.local || '',
      dataPrevisao: soData(row.dataPrevisao),
      observacoes: row.observacoes || '',
      custoMaterial: numeroTexto(row.custoMaterial),
      custoMaoObra: numeroTexto(row.custoMaoObra),
      custoExterno: numeroTexto(row.custoTerceiros),
    });
    setStatusOriginal(row.status || 'aberta');
    const chaves = (row.responsaveis || []).map(chaveResponsavel);
    setResponsaveis(chaves);
    setResponsaveisOriginais(chaves);
  };

  useEffect(() => {
    setOs(null);
    setCandidatos([]);
    setErro('');
    setSalvo(false);
    if (!osId) return;
    let atual = true;
    setCarregando(true);
    osApi.get(osId)
      .then(row => { if (atual) aplicar(row); })
      .catch((e: any) => { if (atual) setErro(e?.message || 'Não foi possível abrir a O.S.'); })
      .finally(() => { if (atual) setCarregando(false); });
    osApi.candidatos(osId)
      .then(lista => { if (atual) setCandidatos(lista); })
      .catch(() => {});
    return () => { atual = false; };
  }, [osId]);

  const recarregar = async () => {
    if (!osId) return;
    const row: any = await osApi.get(osId);
    aplicar(row);
    onAtualizado?.(row);
  };

  const anexos = useMemo(
    () => ((os?.fotos || []) as any[]).filter(f => f && typeof f === 'object'),
    [os]
  );
  const antes = useMemo(() => anexos.filter(f => f.fase !== 'depois'), [anexos]);
  const depois = useMemo(() => anexos.filter(f => f.fase === 'depois'), [anexos]);
  const descricoes = useMemo(
    () => ((os?.historico || []) as any[]).filter(h => h.tipo === 'descricao'),
    [os]
  );

  const pendencias = useMemo(() => {
    const faltando: string[] = [];
    if (!form.descricao.trim()) faltando.push('Descrição do serviço');
    if (!form.local.trim()) faltando.push('Local');
    if (!form.dataPrevisao) faltando.push('Previsão de conclusão');
    if (responsaveis.length === 0) faltando.push('Responsáveis');
    if (antes.length === 0) faltando.push('Fotos do antes');
    if (depois.length === 0) faltando.push('Fotos do depois');
    if (!form.observacoes.trim()) faltando.push('Observações finais');
    return faltando;
  }, [form, responsaveis, antes, depois]);

  const nomesResponsaveis = (os?.responsaveis || []).map((r: any) => r.nome).join(', ');

  const resumo = os ? [
    `*Ordem de Serviço ${os.protocolo || ''}*`,
    `*Título:* ${form.titulo}`,
    `*Status:* ${rotulo(STATUS, form.status)}`,
    `*Prioridade:* ${rotulo(PRIORIDADES, form.prioridade)}`,
    `*Tipo:* ${rotulo(TIPOS, form.tipo)}`,
    `*Local:* ${form.local || '—'}`,
    `*Condomínio:* ${os.condominioNome || '—'}`,
    `*Abertura:* ${dataBR(os.dataAbertura)}`,
    `*Previsão:* ${form.dataPrevisao ? new Date(`${form.dataPrevisao}T12:00:00`).toLocaleDateString('pt-BR') : '—'}`,
    `*Responsáveis:* ${nomesResponsaveis || '—'}`,
    `*Descrição:* ${form.descricao || '—'}`,
  ].join('\n') : '';

  const alternarResponsavel = (chave: string) => {
    setResponsaveis(prev => prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]);
  };

  const abrirSeletor = (fase: Fase, ref: React.RefObject<HTMLInputElement>) => {
    faseAlvo.current = fase;
    ref.current?.click();
  };

  const escolherArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (arquivos.length === 0 || !osId) return;
    const fase = faseAlvo.current;
    setErro('');
    setEnviandoFase(fase);
    try {
      const enviados = [];
      let falha = '';
      for (const arquivo of arquivos.slice(0, 5)) {
        try {
          enviados.push(await enviarAnexo(arquivo));
        } catch (err: any) {
          falha = err?.message || `Falha ao enviar "${arquivo.name}"`;
        }
      }
      if (enviados.length > 0) {
        await osApi.addFotos(osId, enviados, fase);
        await recarregar();
      }
      if (falha) setErro(falha);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao enviar os anexos');
    } finally {
      setEnviandoFase(null);
    }
  };

  const removerAnexo = async (fotoId: string) => {
    if (!osId || !confirm('Remover este anexo?')) return;
    setErro('');
    try {
      await osApi.removerFoto(osId, fotoId);
      await recarregar();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao remover o anexo');
    }
  };

  const salvar = async () => {
    if (!osId || !os) return;
    if (form.titulo.trim().length < 3) { setErro('O título precisa ter pelo menos 3 caracteres.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await osApi.update(osId, {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        prioridade: form.prioridade,
        local: form.local.trim(),
        observacoes: form.observacoes.trim(),
        dataPrevisao: form.dataPrevisao || null,
        custoMaterial: valorPositivo(form.custoMaterial),
        custoMaoObra: valorPositivo(form.custoMaoObra),
        custoExterno: valorPositivo(form.custoExterno),
      } as any);
      if (form.status !== statusOriginal) await osApi.updateStatus(osId, form.status);
      const mudouResp = [...responsaveis].sort().join('|') !== [...responsaveisOriginais].sort().join('|');
      if (mudouResp) {
        const lista = responsaveis
          .map(chave => candidatos.find(c => chaveCandidato(c) === chave))
          .filter((c): c is any => !!c)
          .map(c => (c.id ? { usuarioId: c.id } : { nome: c.nome }));
        await osApi.setResponsaveis(osId, lista);
      }
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 4000);
      await recarregar().catch(() => {});
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar o formulário');
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async (acao: () => Promise<void> | void) => {
    setErro('');
    try {
      await acao();
    } catch {
      setErro('Não foi possível gerar o arquivo. Tente novamente.');
    }
  };

  const galeria = (titulo: string, fase: Fase, itens: any[], dica: string) => (
    <section className={styles.galeriaBloco}>
      <div className={styles.galeriaTopo}>
        <h4 className={fase === 'antes' ? styles.galeriaTituloAntes : styles.galeriaTituloDepois}>{titulo}</h4>
        <span className={styles.galeriaContagem}>{itens.length} anexo(s)</span>
      </div>
      {itens.length === 0 ? (
        <p className={styles.galeriaVazia}>{dica}</p>
      ) : (
        <div className={styles.galeria}>
          {itens.map(f => (
            <figure key={f.id} className={styles.figura}>
              <a href={urlAnexoSegura(f.url)} target="_blank" rel="noreferrer">
                {ehAnexoArquivo(f) ? (
                  <span className={styles.arquivo}>
                    <FileText size={22} />
                    <span className={styles.arquivoNome}>{f.nome || 'Arquivo'}</span>
                  </span>
                ) : (
                  <img src={urlAnexoSegura(f.url)} alt={f.legenda || titulo} className={styles.imagem} loading="lazy" />
                )}
              </a>
              <figcaption className={styles.legenda}>{f.autorNome || f.autor_nome || ''}</figcaption>
              {editavel && (
                <button type="button" className={styles.remover} onClick={() => removerAnexo(f.id)} title="Remover anexo">
                  <Trash2 size={14} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {editavel && (
        <div className={styles.galeriaAcoes}>
          <button
            type="button"
            className={styles.anexoBtn}
            onClick={() => abrirSeletor(fase, inputCamera)}
            disabled={enviandoFase !== null}
          >
            <Camera size={16} /> {enviandoFase === fase ? 'Enviando…' : 'Tirar foto'}
          </button>
          <button
            type="button"
            className={styles.anexoBtn}
            onClick={() => abrirSeletor(fase, inputArquivo)}
            disabled={enviandoFase !== null}
          >
            <Paperclip size={16} /> {enviandoFase === fase ? 'Enviando…' : 'Anexar arquivo'}
          </button>
        </div>
      )}
    </section>
  );

  const linhaImpressao = (rotuloTexto: string, valor: string) => (
    <tr>
      <td style={{ padding: '6px 10px', border: '1px solid #d5d9e0', width: '32%', fontWeight: 700, background: '#f2f5f9' }}>{rotuloTexto}</td>
      <td style={{ padding: '6px 10px', border: '1px solid #d5d9e0' }}>{valor}</td>
    </tr>
  );

  return (
    <Modal
      aberto={!!osId}
      onFechar={onFechar}
      titulo={os?.protocolo ? `Formulário — ${os.protocolo}` : 'Formulário da Ordem de Serviço'}
      largura="lg"
    >
      {carregando || !os ? (
        erro ? <div className={styles.erro}>{erro}</div> : <LoadingSpinner />
      ) : (
        <div className={styles.wrap}>
          <input ref={inputArquivo} type="file" accept={ACCEPT_ANEXOS} multiple hidden onChange={escolherArquivos} />
          <input ref={inputCamera} type="file" accept={ACCEPT_CAMERA} capture="environment" hidden onChange={escolherArquivos} />

          <div className={styles.cabecalho}>
            <div className={styles.badges}>
              <StatusBadge texto={statusOSBadge(form.status).texto} variante={statusOSBadge(form.status).variante} />
              <StatusBadge texto={prioridadeBadge(form.prioridade).texto} variante={prioridadeBadge(form.prioridade).variante} />
              <span className={styles.condominio}>{os.condominioNome || ''}</span>
            </div>
            <div className={styles.acoesTopo}>
              <button type="button" className={styles.acaoBtn} onClick={() => compartilharConteudo(`O.S. ${os.protocolo}`, resumo)}>
                Compartilhar texto
              </button>
              <WhatsAppShare mensagem={resumo} />
              <ShareButton tipo="os" id={os.id} titulo={form.titulo} />
              <button
                type="button"
                className={styles.acaoBtn}
                onClick={() => exportar(() => imprimirElemento(blocoImpressao.current!))}
              >
                <Printer size={14} /> Imprimir
              </button>
              <button
                type="button"
                className={styles.acaoBtn}
                onClick={() => exportar(() => gerarPdfDeElementoPaginado(blocoImpressao.current!, `os-${os.protocolo || os.id}`))}
              >
                <FileDown size={14} /> Gerar PDF
              </button>
            </div>
          </div>

          <div className={styles.campo}>
            <label>Título da O.S.</label>
            <input
              value={form.titulo}
              disabled={!editavel}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              maxLength={255}
            />
          </div>

          {galeria('Fotos do antes', 'antes', antes, 'Nenhuma foto do antes. Registre como o local estava antes do serviço.')}
          {galeria('Fotos do depois', 'depois', depois, 'Nenhuma foto do depois. Registre o resultado ao concluir o serviço.')}

          {pendencias.length > 0 && (
            <div className={styles.pendencias}>
              <AlertTriangle size={16} />
              <div>
                <strong>Aviso (não é obrigatório):</strong> ainda sem preenchimento — {pendencias.join(', ')}.
                <span className={styles.pendenciasNota}>
                  É só um lembrete: preencha o que fizer sentido para esta O.S. e salve normalmente, mesmo com itens em branco.
                </span>
              </div>
            </div>
          )}

          <div className={styles.campo}>
            <label>Descrição do serviço</label>
            <textarea
              rows={4}
              value={form.descricao}
              disabled={!editavel}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="O que precisa ser feito, o que foi encontrado, o que foi executado…"
              maxLength={5000}
            />
          </div>

          <div className={styles.linha}>
            <div className={styles.campo}>
              <label>Status</label>
              <select value={form.status} disabled={!editavel} onChange={e => setForm({ ...form, status: e.target.value })}>
                {statusDisponiveis.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label>Prioridade</label>
              <select value={form.prioridade} disabled={!editavel} onChange={e => setForm({ ...form, prioridade: e.target.value })}>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.linha}>
            <div className={styles.campo}>
              <label>Tipo</label>
              <select value={form.tipo} disabled={!editavel} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label>Previsão de conclusão</label>
              <input
                type="date"
                value={form.dataPrevisao}
                disabled={!editavel}
                onChange={e => setForm({ ...form, dataPrevisao: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.campo}>
            <label>Local</label>
            <input
              value={form.local}
              disabled={!editavel}
              onChange={e => setForm({ ...form, local: e.target.value })}
              placeholder="Ex: Bloco A — 3º andar"
              maxLength={255}
            />
          </div>

          <div className={styles.campo}>
            <label>Responsáveis</label>
            {nomesResponsaveis && <p className={styles.aviso}>Atuais: {nomesResponsaveis}</p>}
            {candidatos.length === 0 ? (
              <p className={styles.aviso}>Nenhuma pessoa disponível neste condomínio.</p>
            ) : (
              <div className={styles.checkLista}>
                {candidatos.map(c => {
                  const chave = chaveCandidato(c);
                  return (
                    <label key={chave} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={responsaveis.includes(chave)}
                        disabled={!editavel}
                        onChange={() => alternarResponsavel(chave)}
                      />
                      <span>{c.nome}</span>
                      <small>{c.cargo || c.role || ''}</small>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.campo}>
            <label>Observações finais</label>
            <textarea
              rows={3}
              value={form.observacoes}
              disabled={!editavel}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Materiais usados, pendências, orientações ao condomínio…"
              maxLength={5000}
            />
          </div>

          <div className={styles.linhaTripla}>
            <div className={styles.campo}>
              <label>Custo material (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.custoMaterial}
                disabled={!editavel}
                onChange={e => setForm({ ...form, custoMaterial: e.target.value })}
              />
            </div>
            <div className={styles.campo}>
              <label>Mão de obra (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.custoMaoObra}
                disabled={!editavel}
                onChange={e => setForm({ ...form, custoMaoObra: e.target.value })}
              />
            </div>
            <div className={styles.campo}>
              <label>Terceiros (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.custoExterno}
                disabled={!editavel}
                onChange={e => setForm({ ...form, custoExterno: e.target.value })}
              />
            </div>
          </div>

          <section className={styles.infoBloco}>
            <div><span>Protocolo</span><strong>{os.protocolo || '—'}</strong></div>
            <div><span>Aberta em</span><strong>{dataBR(os.dataAbertura)}</strong></div>
            <div><span>Aberta por</span><strong>{os.criadoPorNome || '—'}</strong></div>
            <div><span>Concluída em</span><strong>{dataBR(os.dataConclusao)}</strong></div>
          </section>

          {descricoes.length > 0 && (
            <section className={styles.historico}>
              <h4>Descrições registradas</h4>
              {descricoes.map(d => (
                <div key={d.id} className={styles.historicoItem}>
                  <p>{d.texto}</p>
                  <span>{d.autorNome || d.autor_nome} · {dataBR(d.criadoEm || d.criado_em)}</span>
                </div>
              ))}
            </section>
          )}

          {erro && <div className={styles.erro}>{erro}</div>}

          {editavel && (
            <div className={styles.barraSalvar}>
              {salvo && <span className={styles.salvo}><Check size={15} /> Formulário salvo</span>}
              <button type="button" className={styles.salvarBtn} onClick={salvar} disabled={salvando}>
                <Save size={17} /> {salvando ? 'Salvando…' : 'Salvar formulário'}
              </button>
            </div>
          )}

          <div ref={blocoImpressao} className={styles.impressao}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Ordem de Serviço {os.protocolo || ''}</h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#555' }}>
              {os.condominioNome || ''} · Emitido em {new Date().toLocaleString('pt-BR')}
            </p>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{form.titulo}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 14 }}>
              <tbody>
                {linhaImpressao('Status', rotulo(STATUS, form.status))}
                {linhaImpressao('Prioridade', rotulo(PRIORIDADES, form.prioridade))}
                {linhaImpressao('Tipo', rotulo(TIPOS, form.tipo))}
                {linhaImpressao('Local', form.local || '—')}
                {linhaImpressao('Abertura', dataBR(os.dataAbertura))}
                {linhaImpressao('Previsão', form.dataPrevisao ? new Date(`${form.dataPrevisao}T12:00:00`).toLocaleDateString('pt-BR') : '—')}
                {linhaImpressao('Conclusão', dataBR(os.dataConclusao))}
                {linhaImpressao('Aberta por', os.criadoPorNome || '—')}
                {linhaImpressao('Responsáveis', nomesResponsaveis || '—')}
                {linhaImpressao('Descrição', form.descricao || '—')}
                {linhaImpressao('Observações', form.observacoes || '—')}
                {linhaImpressao('Custo material', moeda(form.custoMaterial))}
                {linhaImpressao('Mão de obra', moeda(form.custoMaoObra))}
                {linhaImpressao('Terceiros', moeda(form.custoExterno))}
              </tbody>
            </table>
            {[{ titulo: 'Fotos do antes', itens: antes }, { titulo: 'Fotos do depois', itens: depois }].map(grupo => (
              <div key={grupo.titulo} style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>{grupo.titulo}</h4>
                {grupo.itens.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#777' }}>Nenhum anexo registrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {grupo.itens.map(f => ehAnexoArquivo(f) ? (
                      <span key={f.id} style={{ fontSize: 12 }}>{f.nome || 'Arquivo'}</span>
                    ) : (
                      <img
                        key={f.id}
                        src={urlAbsoluta(f.url)}
                        alt={grupo.titulo}
                        style={{ width: 150, height: 110, objectFit: 'cover', border: '1px solid #d5d9e0' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {descricoes.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>Descrições registradas</h4>
                {descricoes.map(d => (
                  <p key={d.id} style={{ margin: '0 0 6px', fontSize: 12 }}>
                    {d.texto} — <em>{d.autorNome || d.autor_nome}, {dataBR(d.criadoEm || d.criado_em)}</em>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
