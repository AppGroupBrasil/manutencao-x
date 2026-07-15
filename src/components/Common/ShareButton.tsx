import { useState, useEffect, useRef } from 'react';
import { Share2, Copy, Check, MessageCircle, X, AlertTriangle } from 'lucide-react';
import { usuarios as usuariosApi } from '../../services/api';
import styles from './ShareButton.module.css';

type TipoCompartilhavel = 'os' | 'checklist' | 'atividade';

interface ShareButtonProps {
  tipo: TipoCompartilhavel;
  id: string;
  titulo: string;
}

interface Funcionario {
  id: string;
  nome: string;
  telefone?: string;
  role: string;
  ativo?: boolean;
}

const rotulo: Record<TipoCompartilhavel, string> = {
  os: 'Ordem de Serviço',
  checklist: 'Checklist',
  atividade: 'Atividade',
};

export default function ShareButton({ tipo, id, titulo }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const link = `${window.location.origin}/x/${tipo}/${id}`;
  const mensagem = `*${rotulo[tipo]}: ${titulo}*\n\nAcesse para executar:\n${link}`;

  useEffect(() => {
    if (!open) return;
    usuariosApi.list().then((list: any) => {
      const arr = (list as Funcionario[]).filter(
        u => u.ativo !== false && (u.role === 'funcionario' || u.role === 'supervisor')
      );
      setFuncionarios(arr);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignore */ }
  };

  const enviarPara = (f: Funcionario) => {
    const num = (f.telefone || '').replace(/\D/g, '');
    if (!num) return;
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const enviarWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.shareBtn} onClick={() => setOpen(!open)} title="Compartilhar">
        <Share2 size={14} /> Compartilhar
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <span className={styles.dropTitle}>Compartilhar {rotulo[tipo]}</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div className={styles.dropBody}>
            <div className={styles.aviso}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Qualquer pessoa com este link pode ver e executar. Envie apenas a quem for executar.</span>
            </div>

            <div className={styles.linkRow}>
              <input className={styles.linkInput} value={link} readOnly onFocus={e => e.target.select()} />
              <button className={styles.copyBtn} onClick={copiar}>
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>

            <div className={styles.secTitle}>Enviar para funcionário</div>
            {funcionarios.length > 0 ? (
              <div className={styles.lista}>
                {funcionarios.map(f => (
                  <button
                    key={f.id}
                    className={styles.func}
                    onClick={() => enviarPara(f)}
                    disabled={!f.telefone}
                    title={f.telefone ? `Enviar para ${f.nome}` : 'Funcionário sem telefone cadastrado'}
                  >
                    <span className={styles.funcNome}>{f.nome}</span>
                    {f.telefone
                      ? <span className={styles.funcTel}>{f.telefone}</span>
                      : <span className={styles.semTel}>sem telefone</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.vazio}>Nenhum funcionário cadastrado.</div>
            )}

            <button className={styles.whatsBtn} onClick={enviarWhatsApp}>
              <MessageCircle size={14} /> Compartilhar via WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
