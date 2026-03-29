import React from 'react';
import styles from './StatusBadge.module.css';

type Variante = 'sucesso' | 'perigo' | 'aviso' | 'info' | 'neutro';

interface Props {
  texto: string;
  variante?: Variante;
}

const StatusBadge: React.FC<Props> = ({ texto, variante = 'neutro' }) => {
  return (
    <span className={`${styles.badge} ${styles[variante]}`}>
      {texto}
    </span>
  );
};

export default StatusBadge;

export function statusOSBadge(status: string): { texto: string; variante: Variante } {
  const map: Record<string, { texto: string; variante: Variante }> = {
    aberta: { texto: 'Aberta', variante: 'info' },
    em_andamento: { texto: 'Em Andamento', variante: 'aviso' },
    concluida: { texto: 'Concluída', variante: 'sucesso' },
    cancelada: { texto: 'Cancelada', variante: 'perigo' },
    aguardando: { texto: 'Aguardando', variante: 'neutro' },
  };
  return map[status] || { texto: status, variante: 'neutro' };
}

export function prioridadeBadge(prioridade: string): { texto: string; variante: Variante } {
  const map: Record<string, { texto: string; variante: Variante }> = {
    baixa: { texto: 'Baixa', variante: 'sucesso' },
    media: { texto: 'Média', variante: 'info' },
    alta: { texto: 'Alta', variante: 'aviso' },
    urgente: { texto: 'Urgente', variante: 'perigo' },
  };
  return map[prioridade] || { texto: prioridade, variante: 'neutro' };
}
