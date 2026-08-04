import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Users, MessageSquarePlus, History, FileText } from 'lucide-react';
import { ehAnexoArquivo, urlAnexoSegura, ACCEPT_ANEXOS } from '../../utils/anexos';
import styles from './ColaboracaoOS.module.css';

export interface CandidatoOS {
  id: string | null;
  nome: string;
  role?: string;
  cargo?: string | null;
  tipo?: string;
}

export interface FotoOS {
  id: string;
  url: string;
  legenda?: string | null;
  nome?: string | null;
  tipo?: 'imagem' | 'arquivo';
  autor_nome?: string;
  autorNome?: string;
  criado_em?: string;
}


export interface ResponsavelOS {
  id: string;
  usuario_id?: string | null;
  usuarioId?: string | null;
  nome: string;
  papel?: string;
}

export interface EventoOS {
  id: string;
  tipo: string;
  texto?: string | null;
  dados?: any;
  autor_nome?: string;
  origem?: string;
  criado_em?: string;
}

interface Props {
  responsaveis: ResponsavelOS[];
  fotos: FotoOS[];
  historico: EventoOS[];
  carregarCandidatos: () => Promise<CandidatoOS[]>;
  onSalvarResponsaveis: (lista: Array<{ usuarioId?: string | null; nome?: string | null }>) => Promise<void>;
  onAdicionarDescricao: (texto: string) => Promise<void>;
  onEnviarFotos: (arquivos: File[]) => Promise<void>;
  onRemoverFoto: (fotoId: string) => Promise<void>;
  somenteLeitura?: boolean;
  avisoAcao?: string;
  aceitaArquivos?: boolean;
}

const ROTULO_TIPO: Record<string, string> = {
  descricao: 'Descrição',
  edicao: 'Edição',
  responsaveis: 'Responsáveis',
  fotos: 'Imagens',
  status: 'Status',
};

function formatarData(valor?: string) {
  if (!valor) return '';
  const d = new Date(valor);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function chaveDe(c: CandidatoOS) {
  return c.id ? `id:${c.id}` : `nome:${c.nome.trim().toLowerCase()}`;
}

export default function ColaboracaoOS({
  responsaveis, fotos, historico,
  carregarCandidatos, onSalvarResponsaveis, onAdicionarDescricao, onEnviarFotos, onRemoverFoto,
  somenteLeitura, avisoAcao, aceitaArquivos,
}: Props) {
  const [candidatos, setCandidatos] = useState<CandidatoOS[]>([]);
  const [carregandoCand, setCarregandoCand] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviandoDesc, setEnviandoDesc] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState('');
  const [verHistorico, setVerHistorico] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCarregandoCand(true);
    carregarCandidatos()
      .then(setCandidatos)
      .catch(() => {})
      .finally(() => setCarregandoCand(false));
  }, []);

  useEffect(() => {
    setSelecionados(responsaveis.map(r => {
      const uid = r.usuario_id ?? r.usuarioId;
      return uid ? `id:${uid}` : `nome:${r.nome.trim().toLowerCase()}`;
    }));
  }, [responsaveis]);

  const alternar = (chave: string) => {
    setSelecionados(prev => prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]);
  };

  const salvarResponsaveis = async () => {
    setErro('');
    setSalvandoResp(true);
    try {
      const lista = selecionados.map(chave => {
        const cand = candidatos.find(c => chaveDe(c) === chave);
        return cand?.id ? { usuarioId: cand.id } : { nome: cand?.nome ?? chave.replace(/^nome:/, '') };
      });
      await onSalvarResponsaveis(lista);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar responsáveis');
    } finally {
      setSalvandoResp(false);
    }
  };

  const enviarDescricao = async () => {
    if (texto.trim().length < 2) return;
    setErro('');
    setEnviandoDesc(true);
    try {
      await onAdicionarDescricao(texto.trim());
      setTexto('');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar descrição');
    } finally {
      setEnviandoDesc(false);
    }
  };

  const escolherArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    if (inputFile.current) inputFile.current.value = '';
    if (arquivos.length === 0) return;
    setErro('');
    setEnviandoFoto(true);
    try {
      await onEnviarFotos(arquivos.slice(0, 5));
    } catch (err: any) {
      setErro(err?.message || 'Erro ao enviar anexos');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const remover = async (fotoId: string) => {
    if (!confirm('Remover este anexo?')) return;
    setErro('');
    try {
      await onRemoverFoto(fotoId);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao remover anexo');
    }
  };

  const descricoes = historico.filter(h => h.tipo === 'descricao');

  return (
    <div className={styles.wrap}>
      <section className={styles.bloco}>
        <div className={styles.blocoTitulo}><Users size={16} /> Responsáveis</div>
        {responsaveis.length > 0 ? (
          <div className={styles.chips}>
            {responsaveis.map(r => (
              <span key={r.id} className={styles.chip}>{r.nome}</span>
            ))}
          </div>
        ) : (
          <div className={styles.vazio}>Nenhum responsável definido.</div>
        )}

        {!somenteLeitura && (
          <>
            {carregandoCand ? (
              <div className={styles.vazio}>Carregando pessoas…</div>
            ) : candidatos.length === 0 ? (
              <div className={styles.vazio}>Nenhuma pessoa disponível neste condomínio.</div>
            ) : (
              <div className={styles.lista}>
                {candidatos.map(c => {
                  const chave = chaveDe(c);
                  return (
                    <label key={chave} className={styles.opcao}>
                      <input
                        type="checkbox"
                        checked={selecionados.includes(chave)}
                        onChange={() => alternar(chave)}
                      />
                      <span className={styles.opcaoNome}>{c.nome}</span>
                      <span className={styles.opcaoCargo}>{c.cargo || c.role || ''}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <button type="button" className={styles.btn} onClick={salvarResponsaveis} disabled={salvandoResp}>
              {salvandoResp ? 'Salvando…' : 'Salvar responsáveis'}
            </button>
          </>
        )}
      </section>

      <section className={styles.bloco}>
        <div className={styles.blocoTitulo}><MessageSquarePlus size={16} /> Descrições</div>
        {descricoes.length === 0 && <div className={styles.vazio}>Nenhuma descrição adicionada.</div>}
        {descricoes.map(d => (
          <div key={d.id} className={styles.comentario}>
            <div className={styles.comentarioTexto}>{d.texto}</div>
            <div className={styles.comentarioAutor}>
              {d.autor_nome}{d.origem === 'publico' ? ' (link público)' : ''} · {formatarData(d.criado_em)}
            </div>
          </div>
        ))}
        {!somenteLeitura && (
          <>
            <textarea
              className={styles.textarea}
              rows={3}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Adicionar descrição — seu nome fica registrado"
              maxLength={5000}
            />
            <button type="button" className={styles.btn} onClick={enviarDescricao} disabled={enviandoDesc || texto.trim().length < 2}>
              {enviandoDesc ? 'Enviando…' : 'Adicionar descrição'}
            </button>
          </>
        )}
      </section>

      <section className={styles.bloco}>
        <div className={styles.blocoTitulo}>
          <ImagePlus size={16} /> {aceitaArquivos ? 'Arquivos e imagens' : 'Galeria de imagens'}
        </div>
        {fotos.length === 0 && <div className={styles.vazio}>Nenhum anexo adicionado.</div>}
        {fotos.length > 0 && (
          <div className={styles.galeria}>
            {fotos.map(f => (
              <figure key={f.id} className={styles.figura}>
                <a href={urlAnexoSegura(f.url)} target="_blank" rel="noreferrer">
                  {ehAnexoArquivo(f) ? (
                    <span className={styles.arquivo}>
                      <FileText size={22} />
                      <span className={styles.arquivoNome}>{f.nome || 'Arquivo'}</span>
                    </span>
                  ) : (
                    <img src={urlAnexoSegura(f.url)} alt={f.legenda || 'Imagem da O.S.'} className={styles.imagem} />
                  )}
                </a>
                <figcaption className={styles.legenda}>{f.autor_nome ?? f.autorNome}</figcaption>
                {!somenteLeitura && (
                  <button type="button" className={styles.remover} onClick={() => remover(f.id)} title="Remover">
                    <Trash2 size={14} />
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
        {!somenteLeitura && (
          <>
            <input
              ref={inputFile}
              type="file"
              accept={aceitaArquivos ? ACCEPT_ANEXOS : 'image/png,image/jpeg,image/webp'}
              multiple
              hidden
              onChange={escolherArquivos}
            />
            <button type="button" className={styles.btn} onClick={() => inputFile.current?.click()} disabled={enviandoFoto}>
              {enviandoFoto ? 'Enviando…' : aceitaArquivos ? 'Anexar arquivos / imagens' : 'Anexar imagens'}
            </button>
          </>
        )}
      </section>

      <section className={styles.bloco}>
        <button type="button" className={styles.linkBtn} onClick={() => setVerHistorico(v => !v)}>
          <History size={15} /> {verHistorico ? 'Ocultar histórico' : `Histórico de alterações (${historico.length})`}
        </button>
        {verHistorico && (
          <div className={styles.historico}>
            {historico.length === 0 && <div className={styles.vazio}>Sem registros.</div>}
            {historico.map(h => (
              <div key={h.id} className={styles.evento}>
                <span className={styles.eventoTipo}>{ROTULO_TIPO[h.tipo] || h.tipo}</span>
                <span className={styles.eventoTexto}>{h.texto}</span>
                <span className={styles.eventoAutor}>
                  {h.autor_nome}{h.origem === 'publico' ? ' (link público)' : ''} · {formatarData(h.criado_em)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {avisoAcao && <div className={styles.aviso}>{avisoAcao}</div>}
      {erro && <div className={styles.erro}>{erro}</div>}
    </div>
  );
}
