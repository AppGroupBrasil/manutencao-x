import React, { useEffect, useState } from 'react';
import { whatsapp as whatsappApi, condominios as condominiosApi } from '../../services/api';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import type { WhatsAppConfig, WhatsAppMensagem } from '../../types';
import { MessageCircle, Settings, Send, TestTube2, Save, CheckCircle, XCircle } from 'lucide-react';
import styles from './WhatsAppPage.module.css';

const WhatsAppPage: React.FC = () => {
  const [tab, setTab] = useState<'config' | 'enviar' | 'log'>('config');
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [condSelecionado, setCondSelecionado] = useState('');
  const [config, setConfig] = useState<Partial<WhatsAppConfig>>({});
  const [mensagens, setMensagens] = useState<WhatsAppMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Send form
  const [sendDest, setSendDest] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const conds = await condominiosApi.list();
        const list = Array.isArray(conds) ? conds : [];
        setCondominiosList(list);
        if (list.length > 0) setCondSelecionado(list[0].id);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!condSelecionado) return;
    loadConfig();
    loadMensagens();
  }, [condSelecionado]);

  const loadConfig = async () => {
    try {
      const c = await whatsappApi.getConfig(condSelecionado);
      setConfig(c || {});
    } catch { setConfig({}); }
  };

  const loadMensagens = async () => {
    try {
      const m = await whatsappApi.mensagens(condSelecionado);
      setMensagens(Array.isArray(m) ? m : []);
    } catch { setMensagens([]); }
  };

  const handleSaveConfig = async () => {
    if (!condSelecionado) return;
    setSaving(true);
    setTestResult(null);
    try {
      await whatsappApi.saveConfig(condSelecionado, {
        api_url: config.apiUrl || '',
        api_token: config.apiToken || '',
        numero_remetente: config.numeroRemetente || '',
        ativo: config.ativo === true,
        notificar_os_criada: config.notificarOsCriada !== false,
        notificar_os_concluida: config.notificarOsConcluida !== false,
        notificar_vencimentos: config.notificarVencimentos !== false,
        notificar_comunicados: config.notificarComunicados !== false,
      });
      await loadConfig();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!condSelecionado) return;
    setTestResult(null);
    try {
      const r = await whatsappApi.testar(condSelecionado);
      setTestResult({ ok: r.ok, message: r.ok ? r.message : r.error });
    } catch {
      setTestResult({ ok: false, message: 'Erro ao testar conexão' });
    }
  };

  const handleSend = async () => {
    if (!sendDest || !sendMsg || !condSelecionado) return;
    setSending(true);
    try {
      await whatsappApi.enviarMensagem({
        condominio_id: condSelecionado,
        destinatario: sendDest,
        mensagem: sendMsg,
        tipo: 'texto',
      });
      setSendDest('');
      setSendMsg('');
      loadMensagens();
    } catch { /* ignore */ }
    setSending(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      enviado: styles.statusEnviado,
      pendente: styles.statusPendente,
      erro: styles.statusErro,
    };
    return <span className={`${styles.statusBadge} ${map[status] || styles.statusPendente}`}>{status}</span>;
  };

  if (loading) return <div className={styles.empty}>Carregando...</div>;

  return (
    <div className={styles.page}>
      <PageHeader
        titulo="WhatsApp"
        subtitulo="Configuração e envio de mensagens via WhatsApp"
      />

      <div className={styles.selectCond}>
        <label>Condomínio:</label>
        <select value={condSelecionado} onChange={(e) => setCondSelecionado(e.target.value)}>
          {condominiosList.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      <Card>
        <div className={styles.tabBar}>
          <button className={`${styles.tab} ${tab === 'config' ? styles.tabActive : ''}`} onClick={() => setTab('config')}>
            <Settings size={14} /> Configurações
          </button>
          <button className={`${styles.tab} ${tab === 'enviar' ? styles.tabActive : ''}`} onClick={() => setTab('enviar')}>
            <Send size={14} /> Enviar Mensagem
          </button>
          <button className={`${styles.tab} ${tab === 'log' ? styles.tabActive : ''}`} onClick={() => { setTab('log'); loadMensagens(); }}>
            <MessageCircle size={14} /> Log ({mensagens.length})
          </button>
        </div>

        {tab === 'config' && (
          <>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>URL da API (provedor)</label>
                <input
                  type="text"
                  placeholder="https://api.provedor.com/v1/send"
                  value={config.apiUrl || ''}
                  onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Token da API</label>
                <input
                  type="password"
                  placeholder="Seu token de acesso"
                  value={config.apiToken || ''}
                  onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Número Remetente</label>
                <input
                  type="text"
                  placeholder="+55 11 99999-9999"
                  value={config.numeroRemetente || ''}
                  onChange={(e) => setConfig({ ...config, numeroRemetente: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.sectionTitle}>Notificações Automáticas</div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>Ativo</div>
                <div className={styles.toggleDesc}>Habilitar envio de mensagens WhatsApp para este condomínio</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={config.ativo === true} onChange={(e) => setConfig({ ...config, ativo: e.target.checked })} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>OS Criada</div>
                <div className={styles.toggleDesc}>Notificar quando uma nova ordem de serviço for criada</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={config.notificarOsCriada !== false} onChange={(e) => setConfig({ ...config, notificarOsCriada: e.target.checked })} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>OS Concluída</div>
                <div className={styles.toggleDesc}>Notificar quando uma OS for finalizada</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={config.notificarOsConcluida !== false} onChange={(e) => setConfig({ ...config, notificarOsConcluida: e.target.checked })} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>Vencimentos</div>
                <div className={styles.toggleDesc}>Alertar sobre documentos e certidões próximos ao vencimento</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={config.notificarVencimentos !== false} onChange={(e) => setConfig({ ...config, notificarVencimentos: e.target.checked })} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.toggleLabel}>Comunicados</div>
                <div className={styles.toggleDesc}>Enviar comunicados gerais via WhatsApp</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={config.notificarComunicados !== false} onChange={(e) => setConfig({ ...config, notificarComunicados: e.target.checked })} />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.actions} style={{ marginTop: 20 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveConfig} disabled={saving}>
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              <button className={`${styles.btn} ${styles.btnOutline}`} onClick={handleTest}>
                <TestTube2 size={14} /> Testar Conexão
              </button>
            </div>

            {testResult && (
              <div className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testFail}`}>
                {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {' '}{testResult.message}
              </div>
            )}
          </>
        )}

        {tab === 'enviar' && (
          <>
            <div className={styles.sendForm}>
              <div className={styles.formGroup}>
                <label>Destinatário (número)</label>
                <input
                  type="text"
                  placeholder="+55 11 99999-9999"
                  value={sendDest}
                  onChange={(e) => setSendDest(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Mensagem</label>
                <input
                  type="text"
                  placeholder="Digite a mensagem..."
                  value={sendMsg}
                  onChange={(e) => setSendMsg(e.target.value)}
                />
              </div>
              <button
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={handleSend}
                disabled={sending || !sendDest || !sendMsg}
              >
                <Send size={14} /> {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>

            {!config.ativo && (
              <div className={`${styles.testResult} ${styles.testFail}`}>
                <XCircle size={14} /> WhatsApp não está ativo para este condomínio. Ative nas Configurações.
              </div>
            )}
          </>
        )}

        {tab === 'log' && (
          mensagens.length === 0 ? (
            <div className={styles.empty}>
              <MessageCircle size={40} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p>Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Destinatário</th>
                  <th>Mensagem</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {mensagens.map((m) => (
                  <tr key={m.id}>
                    <td>{m.criadoEm ? new Date(m.criadoEm).toLocaleString('pt-BR') : '-'}</td>
                    <td>{m.destinatario}</td>
                    <td className={styles.msgText} title={m.mensagem}>{m.mensagem}</td>
                    <td>{m.tipo}</td>
                    <td>{statusBadge(m.status)}</td>
                    <td className={styles.errText}>{m.erro || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </Card>
    </div>
  );
};

export default WhatsAppPage;
