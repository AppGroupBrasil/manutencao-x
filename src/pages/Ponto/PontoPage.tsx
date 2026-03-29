import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import Modal from '../../components/Common/Modal';
import EmptyState from '../../components/Common/EmptyState';
import { ponto as pontoApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, LogIn, LogOut, Calendar, Users, Timer, Plus } from 'lucide-react';
import styles from './PontoPage.module.css';

interface RegistroPonto {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  condominioNome: string;
  tipo: 'entrada' | 'saida';
  dataHora: string;
  permanencia: number | null;
  observacao: string | null;
}

interface ResumoPonto {
  totalRegistros: number;
  totalEntradas: number;
  totalSaidas: number;
  horasTrabalhadas: string;
}

const PontoPage: React.FC = () => {
  const { usuario } = useAuth();
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [resumo, setResumo] = useState<ResumoPonto | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalAberto, setModalAberto] = useState(false);
  const [formTipo, setFormTipo] = useState<'entrada' | 'saida'>('entrada');
  const [formObs, setFormObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, res] = await Promise.all([
        pontoApi.list(dataFiltro),
        pontoApi.resumo ? pontoApi.resumo(dataFiltro.slice(0, 7)) : Promise.resolve(null)
      ]);
      setRegistros(regs || []);
      setResumo(res);
    } catch {
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await pontoApi.registrar({ tipo: formTipo, observacao: formObs || undefined });
      setModalAberto(false);
      setFormObs('');
      carregar();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar ponto');
    } finally {
      setSalvando(false);
    }
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatarPermanencia = (minutos: number | null) => {
    if (!minutos) return '—';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h}h${String(m).padStart(2, '0')}min`;
  };

  return (
    <div className={styles.container}>
      <PageHeader
        titulo="Controle de Ponto"
        subtitulo="Registre entradas e saídas dos funcionários"
      />

      {/* Resumo */}
      <div className={styles.resumoGrid}>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.azul}`}><Calendar size={22} /></div>
          <div className={styles.resumoInfo}>
            <h3>Registros</h3>
            <p>{resumo?.totalRegistros ?? registros.length}</p>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.verde}`}><LogIn size={22} /></div>
          <div className={styles.resumoInfo}>
            <h3>Entradas</h3>
            <p>{resumo?.totalEntradas ?? registros.filter(r => r.tipo === 'entrada').length}</p>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.laranja}`}><LogOut size={22} /></div>
          <div className={styles.resumoInfo}>
            <h3>Saídas</h3>
            <p>{resumo?.totalSaidas ?? registros.filter(r => r.tipo === 'saida').length}</p>
          </div>
        </div>
        <div className={styles.resumoCard}>
          <div className={`${styles.resumoIcon} ${styles.roxo}`}><Timer size={22} /></div>
          <div className={styles.resumoInfo}>
            <h3>Horas</h3>
            <p>{resumo?.horasTrabalhadas ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className={styles.acoes}>
        <button className={styles.registrarBtn} onClick={() => setModalAberto(true)}>
          <Plus size={16} /> Registrar Ponto
        </button>
        <input
          type="date"
          className={styles.filtroData}
          value={dataFiltro}
          onChange={e => setDataFiltro(e.target.value)}
        />
      </div>

      {/* Tabela de registros */}
      <Card>
        {loading ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>Carregando...</p>
        ) : registros.length === 0 ? (
          <EmptyState
            icon={<Clock size={48} />}
            titulo="Nenhum registro de ponto"
            descricao="Nenhum registro encontrado para esta data."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Condomínio</th>
                  <th>Tipo</th>
                  <th>Data/Hora</th>
                  <th>Permanência</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id}>
                    <td className={styles.funcNome}>{r.usuarioNome}</td>
                    <td>{r.condominioNome || '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${r.tipo === 'entrada' ? styles.badgeEntrada : styles.badgeSaida}`}>
                        {r.tipo === 'entrada' ? <LogIn size={12} /> : <LogOut size={12} />}
                        &nbsp;{r.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td>{formatarDataHora(r.dataHora)}</td>
                    <td>{formatarPermanencia(r.permanencia)}</td>
                    <td>{r.observacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Registro */}
      {modalAberto && (
        <Modal aberto={modalAberto} titulo="Registrar Ponto" onFechar={() => setModalAberto(false)}>
          <form onSubmit={handleRegistrar}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Funcionário</label>
                <input className={styles.formInput} value={usuario?.nome || ''} disabled />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo</label>
                <select className={styles.formSelect} value={formTipo} onChange={e => setFormTipo(e.target.value as 'entrada' | 'saida')}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel}>Observação (opcional)</label>
                <input className={styles.formInput} value={formObs} onChange={e => setFormObs(e.target.value)} placeholder="Ex: Atraso por trânsito" />
              </div>
              <button type="submit" className={styles.formSubmit} disabled={salvando}>
                {salvando ? 'Registrando...' : 'Registrar Ponto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default PontoPage;
