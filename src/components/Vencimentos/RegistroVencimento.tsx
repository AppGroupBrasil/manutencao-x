import { useEffect, useRef, useState } from 'react';
import { Camera, Check, FileText, Paperclip, Save, Trash2 } from 'lucide-react';
import Modal from '../Common/Modal';
import LoadingSpinner from '../Common/LoadingSpinner';
import { vencimentos as vencimentosApi } from '../../services/api';
import { ACCEPT_ANEXOS, ACCEPT_CAMERA, ehAnexoArquivo, enviarAnexo, urlAnexoSegura } from '../../utils/anexos';
import styles from './RegistroVencimento.module.css';

type Fase = 'antes' | 'depois';

interface Anexo {
  id: string;
  url: string;
  nome?: string | null;
  tipo?: 'imagem' | 'arquivo';
  fase?: Fase;
  autorNome?: string;
  criadoEm?: string;
}

interface Props {
  vencimento: { id: string; titulo: string; condominio?: string } | null;
  onFechar: () => void;
  onAtualizado?: (dados: { id: string; totalAnexos: number; descricao: string }) => void;
}

export default function RegistroVencimento({ vencimento, onFechar, onAtualizado }: Props) {
  const [descricao, setDescricao] = useState('');
  const [descricaoSalva, setDescricaoSalva] = useState('');
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const [enviandoFase, setEnviandoFase] = useState<Fase | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const faseAlvo = useRef<Fase>('antes');

  const vencimentoId = vencimento?.id ?? null;

  useEffect(() => {
    setDescricao('');
    setDescricaoSalva('');
    setAnexos([]);
    setErro('');
    setSalvo(false);
    if (!vencimentoId) return;
    let atual = true;
    setCarregando(true);
    vencimentosApi.getRegistro(vencimentoId)
      .then(dados => {
        if (!atual) return;
        setDescricao(dados?.descricao || '');
        setDescricaoSalva(dados?.descricao || '');
        setAnexos(Array.isArray(dados?.anexos) ? dados.anexos : []);
      })
      .catch((e: any) => { if (atual) setErro(e?.message || 'Não foi possível carregar o registro.'); })
      .finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [vencimentoId]);

  const antes = anexos.filter(a => a.fase !== 'depois');
  const depois = anexos.filter(a => a.fase === 'depois');

  const avisar = (lista: Anexo[], texto: string) => {
    if (!vencimentoId) return;
    onAtualizado?.({ id: vencimentoId, totalAnexos: lista.length, descricao: texto });
  };

  const salvarDescricao = async () => {
    if (!vencimentoId) return;
    setSalvando(true);
    setErro('');
    try {
      await vencimentosApi.setRegistroDescricao(vencimentoId, descricao.trim());
      setDescricaoSalva(descricao.trim());
      avisar(anexos, descricao.trim());
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 4000);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar a descrição');
    } finally {
      setSalvando(false);
    }
  };

  const abrirSeletor = (fase: Fase, ref: React.RefObject<HTMLInputElement>) => {
    faseAlvo.current = fase;
    ref.current?.click();
  };

  const escolherArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (arquivos.length === 0 || !vencimentoId) return;
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
        const dados = await vencimentosApi.addAnexos(vencimentoId, enviados, fase);
        const lista = Array.isArray(dados?.anexos) ? dados.anexos : [];
        setAnexos(lista);
        avisar(lista, descricaoSalva);
      }
      if (falha) setErro(falha);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao enviar os anexos');
    } finally {
      setEnviandoFase(null);
    }
  };

  const removerAnexo = async (anexoId: string) => {
    if (!vencimentoId || !confirm('Remover este anexo?')) return;
    setErro('');
    try {
      const dados = await vencimentosApi.removerAnexo(vencimentoId, anexoId);
      const lista = Array.isArray(dados?.anexos) ? dados.anexos : [];
      setAnexos(lista);
      avisar(lista, descricaoSalva);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao remover o anexo');
    }
  };

  const galeria = (titulo: string, fase: Fase, itens: Anexo[], dica: string) => (
    <section className={styles.galeriaBloco}>
      <div className={styles.galeriaTopo}>
        <h4 className={fase === 'antes' ? styles.tituloAntes : styles.tituloDepois}>{titulo}</h4>
        <span className={styles.contagem}>{itens.length} anexo(s)</span>
      </div>
      {itens.length === 0 ? (
        <p className={styles.vazio}>{dica}</p>
      ) : (
        <div className={styles.galeria}>
          {itens.map(a => (
            <figure key={a.id} className={styles.figura}>
              <a href={urlAnexoSegura(a.url)} target="_blank" rel="noreferrer">
                {ehAnexoArquivo(a) ? (
                  <span className={styles.arquivo}>
                    <FileText size={22} />
                    <span className={styles.arquivoNome}>{a.nome || 'Arquivo'}</span>
                  </span>
                ) : (
                  <img src={urlAnexoSegura(a.url)} alt={titulo} className={styles.imagem} loading="lazy" />
                )}
              </a>
              <figcaption className={styles.legenda}>{a.autorNome || ''}</figcaption>
              <button type="button" className={styles.remover} onClick={() => removerAnexo(a.id)} title="Remover anexo">
                <Trash2 size={14} />
              </button>
            </figure>
          ))}
        </div>
      )}
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
    </section>
  );

  return (
    <Modal
      aberto={!!vencimento}
      onFechar={onFechar}
      titulo={vencimento ? `Antes e depois — ${vencimento.titulo}` : 'Antes e depois'}
      largura="lg"
    >
      {carregando ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.wrap}>
          <input ref={inputArquivo} type="file" accept={ACCEPT_ANEXOS} multiple hidden onChange={escolherArquivos} />
          <input ref={inputCamera} type="file" accept={ACCEPT_CAMERA} capture="environment" hidden onChange={escolherArquivos} />

          {vencimento?.condominio && <p className={styles.condominio}>{vencimento.condominio}</p>}

          {erro && <div className={styles.erro}>{erro}</div>}

          {galeria('Fotos do antes', 'antes', antes, 'Nenhuma foto do antes. Registre como estava antes da manutenção.')}
          {galeria('Fotos do depois', 'depois', depois, 'Nenhuma foto do depois. Registre como ficou depois da manutenção realizada.')}

          <div className={styles.campo}>
            <label>Descrição do serviço realizado</label>
            <textarea
              rows={4}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="O que foi feito, peças trocadas, empresa responsável, pendências…"
              maxLength={5000}
            />
            <span className={styles.nota}>Preencha o que fizer sentido — nada aqui é obrigatório.</span>
          </div>

          <div className={styles.barra}>
            {salvo && <span className={styles.salvo}><Check size={15} /> Registro salvo</span>}
            <button
              type="button"
              className={styles.salvarBtn}
              onClick={salvarDescricao}
              disabled={salvando || descricao.trim() === descricaoSalva}
            >
              <Save size={17} /> {salvando ? 'Salvando…' : 'Salvar descrição'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
