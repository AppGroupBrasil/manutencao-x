import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, CheckCheck } from 'lucide-react';
import { publico as publicoApi } from '../../services/api';
import ColaboracaoOS from '../../components/OS/ColaboracaoOS';
import styles from './ExecucaoPublica.module.css';

type Tipo = 'os' | 'checklist' | 'atividade';

interface ItemChecklist {
  id: string;
  descricao: string;
  concluido: boolean;
}

const rotulo: Record<Tipo, string> = {
  os: 'Ordem de Serviço',
  checklist: 'Checklist',
  atividade: 'Atividade',
};

const statusFinal: Record<Tipo, string> = {
  os: 'concluida',
  checklist: 'concluido',
  atividade: 'concluido',
};

const statusAndamento: Record<Tipo, string> = {
  os: 'em_andamento',
  checklist: 'em_andamento',
  atividade: 'em_andamento',
};

function estaEncerrado(tipo: Tipo, status: string): boolean {
  if (tipo === 'os') return status === 'concluida' || status === 'cancelada';
  return status === 'concluido';
}

function formatarData(valor?: string): string {
  if (!valor) return '—';
  const d = new Date(valor);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ExecucaoPublicaPage() {
  const { tipo, id } = useParams<{ tipo: Tipo; id: string }>();
  const [dados, setDados] = useState<any>(null);
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const [nome, setNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [edicao, setEdicao] = useState({ titulo: '', descricao: '', local: '', prioridade: 'media' });

  const tipoValido = tipo === 'os' || tipo === 'checklist' || tipo === 'atividade';

  useEffect(() => {
    if (!tipoValido || !id) { setErro('Link inválido'); setLoading(false); return; }
    publicoApi.get(tipo, id)
      .then(row => {
        setDados(row);
        if (Array.isArray(row.itens)) setItens(row.itens);
        if (row.executado_por_nome) setNome(row.executado_por_nome);
        if (row.observacoes) setObservacoes(row.observacoes);
        setEdicao({
          titulo: row.titulo || '',
          descricao: row.descricao || '',
          local: row.local || '',
          prioridade: row.prioridade || 'media',
        });
      })
      .catch(e => setErro(e.message || 'Não foi possível carregar'))
      .finally(() => setLoading(false));
  }, [tipo, id, tipoValido]);

  const enviar = async (status: string) => {
    if (!tipoValido || !id) return;
    if (nome.trim().length < 3) { setErro('Informe seu nome completo'); return; }
    setSalvando(true);
    setErro('');
    try {
      const payload: Record<string, unknown> = { status, executadoPor: nome.trim() };
      if (tipo === 'os' && observacoes.trim()) payload.observacoes = observacoes.trim();
      if (tipo === 'checklist') payload.itens = itens;
      await publicoApi.updateStatus(tipo, id, payload);
      if (status === statusFinal[tipo]) setPronto(true);
      else setDados({ ...dados, status });
    } catch (e: any) {
      setErro(e.message || 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  const recarregar = async () => {
    if (!tipoValido || !id) return;
    const row = await publicoApi.get(tipo!, id);
    setDados(row);
  };

  const nomeValido = nome.trim().length >= 3;

  const salvarEdicaoPublica = async () => {
    if (!id || !nomeValido) { setErro('Informe seu nome completo'); return; }
    setSalvando(true);
    setErro('');
    try {
      const row = await publicoApi.editarOS(id, nome.trim(), {
        titulo: edicao.titulo.trim(),
        descricao: edicao.descricao.trim(),
        local: edicao.local.trim(),
        prioridade: edicao.prioridade,
      });
      setDados(row);
      setEditando(false);
    } catch (e: any) {
      setErro(e.message || 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setItens(itens.map(i => i.id === itemId ? { ...i, concluido: !i.concluido } : i));
  };

  if (loading) {
    return <div className={styles.page}><div className={styles.card}><div className={styles.centro}>Carregando…</div></div></div>;
  }

  if (erro && !dados) {
    return <div className={styles.page}><div className={styles.card}><div className={styles.centro}>{erro}</div></div></div>;
  }

  if (pronto) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.sucesso}>
            <CheckCheck size={44} color="#137333" />
            <div className={styles.sucessoTitulo}>Registrado com sucesso</div>
            <div className={styles.sucessoTexto}>
              Obrigado, {nome.trim()}. A conclusão foi enviada ao gestor do condomínio.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const t = tipo as Tipo;
  const encerrado = estaEncerrado(t, dados.status);
  const titulo = dados.titulo || dados.local || rotulo[t];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.marca}>Manutenção X · {rotulo[t]}</div>
          <div className={styles.titulo}>{titulo}</div>
          {dados.protocolo && <div className={styles.protocolo}>Protocolo {dados.protocolo}</div>}
          <div className={styles.badges}>
            <span className={styles.badge}>{String(dados.status).replace(/_/g, ' ')}</span>
            {dados.prioridade && (
              <span className={`${styles.badge} ${dados.prioridade === 'alta' || dados.prioridade === 'urgente' ? styles.badgeAlta : ''}`}>
                {dados.prioridade}
              </span>
            )}
            {dados.tipo && <span className={styles.badge}>{dados.tipo}</span>}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.linha}>
            <span className={styles.rotulo}>Condomínio</span>
            <span className={styles.valor}>{dados.condominio_nome || '—'}</span>
          </div>
          {(dados.local && dados.titulo) && (
            <div className={styles.linha}>
              <span className={styles.rotulo}>Local</span>
              <span className={styles.valor}>{dados.local}</span>
            </div>
          )}
          {(Array.isArray(dados.responsaveis) && dados.responsaveis.length > 0) ? (
            <div className={styles.linha}>
              <span className={styles.rotulo}>Responsáveis</span>
              <span className={styles.valor}>{dados.responsaveis.map((r: any) => r.nome).join(', ')}</span>
            </div>
          ) : dados.responsavel_nome ? (
            <div className={styles.linha}>
              <span className={styles.rotulo}>Responsável</span>
              <span className={styles.valor}>{dados.responsavel_nome}</span>
            </div>
          ) : null}
          {t === 'os' && (
            <>
              <div className={styles.linha}>
                <span className={styles.rotulo}>Aberta em</span>
                <span className={styles.valor}>{formatarData(dados.data_abertura)}</span>
              </div>
              {dados.data_previsao && (
                <div className={styles.linha}>
                  <span className={styles.rotulo}>Previsão</span>
                  <span className={styles.valor}>{formatarData(dados.data_previsao)}</span>
                </div>
              )}
            </>
          )}
          {dados.data && (
            <div className={styles.linha}>
              <span className={styles.rotulo}>Data</span>
              <span className={styles.valor}>{new Date(dados.data).toLocaleDateString('pt-BR')}</span>
            </div>
          )}

          {dados.descricao && !editando && <div className={styles.descricao}>{dados.descricao}</div>}

          {t !== 'os' && Array.isArray(dados.fotos) && dados.fotos.length > 0 && (
            <div className={styles.fotos}>
              {dados.fotos.map((f: any, i: number) => (
                <img key={i} src={typeof f === 'string' ? f : f.url} alt={`Foto ${i + 1}`} className={styles.foto} />
              ))}
            </div>
          )}

          {t === 'os' && (
            <div className={styles.secao}>
              <div className={styles.secTitulo}>Colaborar nesta O.S.</div>
              <div className={styles.campo}>
                <label className={styles.label}>Seu nome *</label>
                <input
                  className={styles.input}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Fica registrado em tudo que você alterar"
                  maxLength={255}
                />
              </div>

              {editando ? (
                <>
                  <div className={styles.campo}>
                    <label className={styles.label}>Título</label>
                    <input className={styles.input} value={edicao.titulo} onChange={e => setEdicao({ ...edicao, titulo: e.target.value })} maxLength={255} />
                  </div>
                  <div className={styles.campo}>
                    <label className={styles.label}>Descrição</label>
                    <textarea className={styles.textarea} value={edicao.descricao} onChange={e => setEdicao({ ...edicao, descricao: e.target.value })} maxLength={5000} />
                  </div>
                  <div className={styles.campo}>
                    <label className={styles.label}>Local</label>
                    <input className={styles.input} value={edicao.local} onChange={e => setEdicao({ ...edicao, local: e.target.value })} maxLength={255} />
                  </div>
                  <div className={styles.campo}>
                    <label className={styles.label}>Prioridade</label>
                    <select className={styles.input} value={edicao.prioridade} onChange={e => setEdicao({ ...edicao, prioridade: e.target.value })}>
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div className={styles.acoes}>
                    <button className={`${styles.btn} ${styles.btnConcluir}`} onClick={salvarEdicaoPublica} disabled={salvando || !nomeValido}>
                      {salvando ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                    <button className={`${styles.btn} ${styles.btnIniciar}`} onClick={() => setEditando(false)}>Cancelar</button>
                  </div>
                </>
              ) : (
                <button className={`${styles.btn} ${styles.btnIniciar}`} onClick={() => setEditando(true)} disabled={!nomeValido}>
                  Editar dados da O.S.
                </button>
              )}

              <ColaboracaoOS
                responsaveis={dados.responsaveis || []}
                fotos={(dados.fotos || []).filter((f: any) => f && typeof f === 'object')}
                historico={dados.historico || []}
                carregarCandidatos={() => publicoApi.candidatosOS(id!)}
                onSalvarResponsaveis={async lista => { await publicoApi.setResponsaveisOS(id!, nome.trim(), lista); await recarregar(); }}
                onAdicionarDescricao={async texto => { await publicoApi.addDescricaoOS(id!, nome.trim(), texto); await recarregar(); }}
                onEnviarFotos={async arquivos => { await publicoApi.enviarFotosOS(id!, nome.trim(), arquivos); await recarregar(); }}
                onRemoverFoto={async fotoId => { await publicoApi.removerFotoOS(id!, fotoId, nome.trim()); await recarregar(); }}
                somenteLeitura={!nomeValido}
                avisoAcao={!nomeValido ? 'Informe seu nome acima para editar, comentar ou anexar imagens.' : undefined}
              />
            </div>
          )}

          {encerrado ? (
            <div className={styles.secao}>
              <div className={styles.encerrado}>
                {t === 'os' && dados.status === 'cancelada'
                  ? 'Esta ordem de serviço foi cancelada.'
                  : `Já concluído${dados.executado_por_nome ? ` por ${dados.executado_por_nome}` : ''}.`}
              </div>
            </div>
          ) : (
            <div className={styles.secao}>
              <div className={styles.secTitulo}>Executar</div>

              {t === 'checklist' && itens.length > 0 && (
                <div className={styles.itens}>
                  {itens.map(item => (
                    <div
                      key={item.id}
                      className={`${styles.item} ${item.concluido ? styles.itemFeito : ''}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      {item.concluido ? <CheckCircle2 size={17} /> : <Circle size={17} color="#9aa0a6" />}
                      <span>{item.descricao}</span>
                    </div>
                  ))}
                </div>
              )}

              {t !== 'os' && (
                <div className={styles.campo}>
                  <label className={styles.label}>Seu nome *</label>
                  <input
                    className={styles.input}
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Quem está executando"
                    maxLength={255}
                  />
                </div>
              )}

              {t === 'os' && (
                <div className={styles.campo}>
                  <label className={styles.label}>Observações</label>
                  <textarea
                    className={styles.textarea}
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="O que foi feito, materiais usados, pendências…"
                    maxLength={2000}
                  />
                </div>
              )}

              {erro && <div className={styles.erro}>{erro}</div>}

              <div className={styles.acoes}>
                {dados.status !== statusAndamento[t] && (
                  <button
                    className={`${styles.btn} ${styles.btnIniciar}`}
                    onClick={() => enviar(statusAndamento[t])}
                    disabled={salvando}
                  >
                    Iniciar
                  </button>
                )}
                <button
                  className={`${styles.btn} ${styles.btnConcluir}`}
                  onClick={() => enviar(statusFinal[t])}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando…' : 'Concluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
