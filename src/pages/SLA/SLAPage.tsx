import React, { useEffect, useState } from 'react';
import { sla as slaApi, condominios as condominiosApi } from '../../services/api';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import type { SlaDashboard, SlaViolacao, SlaConfiguracao } from '../../types';
import { ShieldCheck, AlertTriangle, RefreshCw, Settings, Save } from 'lucide-react';
import styles from './SLAPage.module.css';

const prioridadeLabels: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const SLAPage: React.FC = () => {
  const [tab, setTab] = useState<'dashboard' | 'violacoes' | 'config'>('dashboard');
  const [dash, setDash] = useState<SlaDashboard | null>(null);
  const [violacoes, setViolacoes] = useState<SlaViolacao[]>([]);
  const [configs, setConfigs] = useState<SlaConfiguracao[]>([]);
  const [condominiosList, setCondominiosList] = useState<any[]>([]);
  const [condSelecionado, setCondSelecionado] = useState('');
  const [editConfigs, setEditConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErro(null);
    try {
      const [d, v, c, conds] = await Promise.all([
        slaApi.dashboard(),
        slaApi.violacoes(),
        slaApi.configuracoes(),
        condominiosApi.list(),
      ]);
      setDash(d);
      setViolacoes(v);
      setConfigs(c);
      setCondominiosList(Array.isArray(conds) ? conds : []);
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível carregar os dados de SLA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRecalcular = async () => {
    try {
      await slaApi.recalcular();
      await load();
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível recalcular o SLA.');
    }
  };

  const openConfig = (condId: string) => {
    setCondSelecionado(condId);
    const existing = configs.filter((c: any) => c.condominioId === condId);
    if (existing.length > 0) {
      setEditConfigs(existing.map((c: any) => ({
        prioridade: c.prioridade,
        tempoResposta: c.tempoRespostaHoras,
        tempoResolucao: c.tempoResolucaoHoras,
      })));
    } else {
      setEditConfigs([
        { prioridade: 'urgente', tempoResposta: 2, tempoResolucao: 12 },
        { prioridade: 'alta', tempoResposta: 4, tempoResolucao: 24 },
        { prioridade: 'media', tempoResposta: 8, tempoResolucao: 48 },
        { prioridade: 'baixa', tempoResposta: 24, tempoResolucao: 120 },
      ]);
    }
  };

  const handleSaveConfig = async () => {
    if (!condSelecionado) return;
    setSaving(true);
    setErro(null);
    try {
      await slaApi.salvarConfiguracoes(condSelecionado, editConfigs);
      await load();
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível salvar as configurações de SLA.');
    } finally {
      setSaving(false);
    }
  };

  const slaStatusBadge = (s: string) => {
    if (s === 'dentro_prazo') return <span className={`${styles.badge} ${styles.badgeDentro}`}>No prazo</span>;
    if (s === 'em_risco') return <span className={`${styles.badge} ${styles.badgeRisco}`}>Em risco</span>;
    return <span className={`${styles.badge} ${styles.badgeViolado}`}>Violado</span>;
  };

  const prioridadeBadge = (p: string) => {
    const map: Record<string, string> = { urgente: styles.badgeUrgente, alta: styles.badgeAlta, media: styles.badgeMedia, baixa: styles.badgeBaixa };
    return <span className={`${styles.badge} ${map[p] || ''}`}>{prioridadeLabels[p] || p}</span>;
  };

  const updateConfigValue = (index: number, field: 'tempoResposta' | 'tempoResolucao', value: string) => {
    const parsedValue = Number.parseInt(value, 10) || 1;
    setEditConfigs(current => {
      const copy = [...current];
      copy[index] = { ...copy[index], [field]: parsedValue };
      return copy;
    });
  };

  const renderDashboard = () => {
    if (!dash) return null;

    let taxaCumprimentoClass = styles.cardDanger;
    let taxaCumprimentoColor = '#dc2626';

    if (dash.taxaCumprimento >= 80) {
      taxaCumprimentoClass = styles.cardOk;
      taxaCumprimentoColor = '#16a34a';
    } else if (dash.taxaCumprimento >= 50) {
      taxaCumprimentoClass = styles.cardWarn;
      taxaCumprimentoColor = '#f59e0b';
    }

    return (
      <>
        <div className={styles.resumo}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Total Abertas</div>
            <div className={`${styles.cardValue} ${styles.cardPrimary}`}>{dash.totalAbertas}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Dentro do Prazo</div>
            <div className={`${styles.cardValue} ${styles.cardOk}`}>{dash.dentroPrazo}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Em Risco</div>
            <div className={`${styles.cardValue} ${styles.cardWarn}`}>{dash.emRisco}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Violadas</div>
            <div className={`${styles.cardValue} ${styles.cardDanger}`}>{dash.violadas}</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Taxa de Cumprimento SLA</div>
          <div className={`${styles.cardValue} ${taxaCumprimentoClass}`}>
            {dash.taxaCumprimento}%
          </div>
          <div className={styles.taxaBar}>
            <div
              className={styles.taxaFill}
              style={{
                width: `${dash.taxaCumprimento}%`,
                background: taxaCumprimentoColor,
              }}
            />
          </div>
        </div>

        {dash.porPrioridade.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>SLA por Prioridade</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>No Prazo</th>
                  <th>Em Risco</th>
                  <th>Violadas</th>
                </tr>
              </thead>
              <tbody>
                {dash.porPrioridade.map((p: any) => (
                  <tr key={p.prioridade}>
                    <td>{prioridadeBadge(p.prioridade)}</td>
                    <td style={{ color: '#16a34a' }}>{p.dentro_prazo || p.dentroPrazo || 0}</td>
                    <td style={{ color: '#f59e0b' }}>{p.em_risco || p.emRisco || 0}</td>
                    <td style={{ color: '#dc2626' }}>{p.violadas || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderViolacoes = () => {
    if (violacoes.length === 0) {
      return (
        <div className={styles.empty}>
          <ShieldCheck size={40} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>Nenhuma violação de SLA no momento</p>
        </div>
      );
    }

    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Título</th>
            <th>Prioridade</th>
            <th>Status SLA</th>
            <th>Limite Resolução</th>
            <th>Responsável</th>
          </tr>
        </thead>
        <tbody>
          {violacoes.map((v) => (
            <tr key={v.id}>
              <td><strong>{v.protocolo}</strong></td>
              <td>{v.titulo}</td>
              <td>{prioridadeBadge(v.prioridade)}</td>
              <td>{slaStatusBadge(v.slaStatus)}</td>
              <td>{v.slaResolucaoLimite ? new Date(v.slaResolucaoLimite).toLocaleString('pt-BR') : '—'}</td>
              <td>{v.responsavelNome || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderConfig = () => {
    return (
      <>
        <div className={styles.actions}>
          <select
            value={condSelecionado}
            onChange={e => openConfig(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--cor-borda)', fontSize: 13, background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}
          >
            <option value="">Selecione um condomínio...</option>
            {condominiosList.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          {condSelecionado && (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveConfig} disabled={saving}>
              <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>

        {condSelecionado ? (
          <div className={styles.configGrid}>
            {editConfigs.map((cfg, i) => (
              <div className={styles.configCard} key={cfg.prioridade}>
                <div className={styles.configTitle}>
                  {prioridadeBadge(cfg.prioridade)}
                </div>
                <div className={styles.configRow}>
                  <span>Resposta:</span>
                  <input
                    type="number"
                    min={1}
                    value={cfg.tempoResposta}
                    onChange={e => updateConfigValue(i, 'tempoResposta', e.target.value)}
                  />
                  <span>horas</span>
                </div>
                <div className={styles.configRow}>
                  <span>Resolução:</span>
                  <input
                    type="number"
                    min={1}
                    value={cfg.tempoResolucao}
                    onChange={e => updateConfigValue(i, 'tempoResolucao', e.target.value)}
                  />
                  <span>horas</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>Selecione um condomínio para configurar os prazos de SLA</div>
        )}
      </>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className={styles.empty}>Carregando...</div>;
    }

    if (tab === 'dashboard' && dash) {
      return renderDashboard();
    }

    if (tab === 'violacoes') {
      return renderViolacoes();
    }

    if (tab === 'config') {
      return renderConfig();
    }

    return null;
  };

  return (
    <div className={styles.slaPage}>
      <PageHeader
        titulo="Controle de SLA"
        subtitulo="Acordo de nível de serviço para ordens de serviço"
        acoes={
          <button className={`${styles.btn} ${styles.btnOutline}`} onClick={handleRecalcular}>
            <RefreshCw size={14} /> Recalcular SLA
          </button>
        }
      />

      {erro ? <div className={styles.empty}>{erro}</div> : null}

      <Card>
        <div className={styles.tabBar}>
          <button className={`${styles.tab} ${tab === 'dashboard' ? styles.tabActive : ''}`} onClick={() => setTab('dashboard')}>
            <ShieldCheck size={14} /> Dashboard
          </button>
          <button className={`${styles.tab} ${tab === 'violacoes' ? styles.tabActive : ''}`} onClick={() => setTab('violacoes')}>
            <AlertTriangle size={14} /> Violações ({violacoes.length})
          </button>
          <button className={`${styles.tab} ${tab === 'config' ? styles.tabActive : ''}`} onClick={() => setTab('config')}>
            <Settings size={14} /> Configurações
          </button>
        </div>

        {renderContent()}
      </Card>
    </div>
  );
};

export default SLAPage;

