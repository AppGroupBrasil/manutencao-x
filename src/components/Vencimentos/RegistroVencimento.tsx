import { useEffect, useRef, useState } from 'react';
import { Camera, Check, FileText, Paperclip, Save, Trash2 } from 'lucide-react';
import Modal from '../Common/Modal';
import LoadingSpinner from '../Common/LoadingSpinner';
import { vencimentos as vencimentosApi } from '../../services/api';
import { ACCEPT_ANEXOS, ACCEPT_CAMERA, ehAnexoArquivo, enviarAnexo, urlAnexoSegura } from '../../utils/anexos';
import styles from './RegistroVencimento.module.css';

type Fase = 'antes' | 'depois';

export type StatusRegistro = '' | 'concluido' | 'postergado' | 'no_prazo' | 'em_atraso' | 'adiado';

export const STATUS_REGISTRO: { valor: Exclude<StatusRegistro, ''>; label: string; cor: string; bg: string }[] = [
  { valor: 'concluido', label: 'Concluído', cor: '#1e8e3e', bg: '#e6f4ea' },
  { valor: 'postergado', label: 'Postergado', cor: '#b26a00', bg: '#fef7e0' },
  { valor: 'no_prazo', label: 'No prazo', cor: '#1a73e8', bg: '#e8f0fe' },
  { valor: 'em_atraso', label: 'Em atraso', cor: '#c5221f', bg: '#fce8e6' },
  { valor: 'adiado', label: 'Adiado', cor: '#5f6368', bg: '#f1f3f4' },
];

export function statusRegistroInfo(valor?: string | null) {
  return STATUS_REGISTRO.find(s => s.valor === valor) || null;
}

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
  onAtualizado?: (dados: { id: string; totalAnexos: number; descricao: string; status: StatusRegistro }) => void;
}

export default function RegistroVencimento({ vencimento, onFechar, onAtualizado }: Props) {
  const [descricao, setDescricao] = useState('');
  const [descricaoSalva, setDescricaoSalva] = useState('');
  const [status, setStatus] = useState<StatusRegistro>('');
  const [statusSalvo, setStatusSalvo] = useState<StatusRegistro>('');
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
    setStatus('');
    setStatusSalvo('');
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
        setStatus((dados?.status || '') as StatusRegistro);
        setStatusSalvo((dados?.status || '') as StatusRegistro);
        setAnexos(Array.isArray(dados?.anexos) ? dados.anexos : []);
      })
      .catch((e: any) => { if (atual) setErro(e?.message || 'Não foi possível carregar o registro.'); })
      .finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [vencimentoId]);

  const antes = anexos.filter(a => a.fase !== 'depois');
  const depois = anexos.filter(a => a.fase === 'depois');
  const semSalvar = descricao.trim() !== descricaoSalva || status !== statusSalvo;

  const fechar = () => {
    if (semSalvar && !confirm('O status ou a descrição ainda não foram salvos. Fechar mesmo assim?')) return;
    onFechar();
  };

  const avisar = (lista: Anexo[], texto: string, situacao: StatusRegistro) => {
    if (!vencimentoId) return;
    onAtualizado?.({ id: vencimentoId, totalAnexos: lista.length, descricao: texto, status: situacao });
  };

  const salvarRegistro = async () => {
    if (!vencimentoId) return;
    setSalvando(true);
    setErro('');
    try {
      await vencimentosApi.setRegistroDescricao(vencimentoId, descricao.trim(), status);
      setDescricaoSalva(descricao.trim());
      setStatusSalvo(status);
      avisar(anexos, descricao.trim(), status);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 4000);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar o registro');
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
        avisar(lista, descricaoSalva, statusSalvo);
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
      avisar(lista, descricaoSalva, statusSalvo);
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
      onFechar={fechar}
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
            <label>Status do vencimento</label>
            <div className={styles.statusLista}>
              {STATUS_REGISTRO.map(op => (
                <button
                  key={op.valor}
                  type="button"
                  className={`${styles.statusBtn} ${status === op.valor ? styles.statusBtnAtivo : ''}`}
                  style={status === op.valor ? { background: op.bg, color: op.cor, borderColor: op.cor } : undefined}
                  onClick={() => setStatus(status === op.valor ? '' : op.valor)}
                >
                  {status === op.valor && <Check size={14} />} {op.label}
                </button>
              ))}
            </div>
            <span className={styles.nota}>Toque de novo no status escolhido para deixar sem status.</span>
          </div>

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
              onClick={salvarRegistro}
              disabled={salvando || !semSalvar}
            >
              <Save size={17} /> {salvando ? 'Salvando…' : 'Salvar registro'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
