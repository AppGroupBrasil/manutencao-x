import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Settings, Save, Trash2, X } from 'lucide-react';
import { moradores as moradoresApi } from '../../services/api';
import styles from './WhatsAppShare.module.css';

interface ContatoWhats {
  id: string;
  nome: string;
  telefone: string;
}

interface WhatsAppShareProps {
  mensagem: string;
}

export default function WhatsAppShare({ mensagem }: WhatsAppShareProps) {
  const [open, setOpen] = useState(false);
  const [contatos, setContatos] = useState<ContatoWhats[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    moradoresApi.listWhatsContatos().then((list: any) => {
      const arr = list as ContatoWhats[];
      setContatos(arr);
      if (arr.length > 0 && !selecionado) setSelecionado(arr[0].id);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowConfig(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const enviar = () => {
    const contato = contatos.find(c => c.id === selecionado);
    if (!contato) { setShowConfig(true); return; }
    const num = contato.telefone.replace(/\D/g, '');
    const texto = encodeURIComponent(mensagem);
    window.open(`https://wa.me/55${num}?text=${texto}`, '_blank');
  };

  const formatarTelefone = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    return v;
  };

  const salvar = async () => {
    if (!nome.trim() || !telefone.trim()) return;
    try {
      const novo = await moradoresApi.addWhatsContato({ nome: nome.trim(), telefone: telefone.trim() }) as ContatoWhats;
      const updated = [...contatos, novo];
      setContatos(updated);
      if (!selecionado) setSelecionado(novo.id);
    } catch { /* ignore */ }
    setNome('');
    setTelefone('');
  };

  const remover = async (id: string) => {
    try {
      await moradoresApi.removeWhatsContato(id);
      const updated = contatos.filter(c => c.id !== id);
      setContatos(updated);
      if (selecionado === id) setSelecionado(updated[0]?.id || '');
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.whatsBtn} onClick={() => setOpen(!open)} title="Enviar via WhatsApp">
        <MessageCircle size={14} /> WhatsApp
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <span className={styles.dropTitle}>Enviar via WhatsApp</span>
            <button className={styles.closeBtn} onClick={() => { setOpen(false); setShowConfig(false); }}>
              <X size={14} />
            </button>
          </div>

          <div className={styles.dropBody}>
            <div className={styles.sendRow}>
              {contatos.length > 0 ? (
                <select className={styles.selectContato} value={selecionado} onChange={e => setSelecionado(e.target.value)}>
                  {contatos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.noContatos}>Nenhum contato cadastrado.</span>
              )}
              <button className={styles.sendBtn} onClick={enviar} disabled={contatos.length === 0}>
                <MessageCircle size={14} /> Enviar
              </button>
              <button
                className={`${styles.configBtn} ${showConfig ? styles.configBtnActive : ''}`}
                onClick={() => setShowConfig(!showConfig)}
                title="Configurar contatos"
              >
                <Settings size={14} />
              </button>
            </div>

            {showConfig && (
              <div className={styles.configPanel}>
                <h5 className={styles.configTitle}>Adicionar Contato</h5>
                <div className={styles.configFields}>
                  <input className={styles.input} placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} />
                  <input className={styles.input} placeholder="(00) 00000-0000" value={telefone} maxLength={15} onChange={e => setTelefone(formatarTelefone(e.target.value))} />
                  <button className={styles.saveBtn} onClick={salvar}><Save size={13} /> Salvar</button>
                </div>

                {contatos.length > 0 && (
                  <div className={styles.contatosList}>
                    <h5 className={styles.configTitle}>Contatos Salvos</h5>
                    {contatos.map((c, i) => (
                      <div key={c.id} className={styles.contatoItem}>
                        <div className={styles.contatoInfo}>
                          <strong>{c.nome}</strong>
                          <span>{c.telefone}</span>
                          {i === 0 && <span className={styles.badge}>Padrão</span>}
                        </div>
                        <button className={styles.removeBtn} onClick={() => remover(c.id)} title="Remover">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
