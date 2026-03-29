import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  titulo?: string;
  descricao?: string;
  acao?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  titulo = 'Nenhum registro encontrado',
  descricao,
  acao,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
      color: 'var(--cor-texto-secundario)',
    }}>
      <div style={{ marginBottom: 16, opacity: 0.5 }}>
        {icon || <Inbox size={52} strokeWidth={1.5} />}
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--cor-texto)' }}>
        {titulo}
      </h3>
      {descricao && <p style={{ margin: 0, fontSize: 13, maxWidth: 360 }}>{descricao}</p>}
      {acao && <div style={{ marginTop: 16 }}>{acao}</div>}
    </div>
  );
};

export default EmptyState;
