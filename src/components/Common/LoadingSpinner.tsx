import React from 'react';

interface LoadingSpinnerProps {
  texto?: string;
  tamanho?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 24, md: 40, lg: 56 };

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ texto = 'Carregando...', tamanho = 'md' }) => {
  const size = SIZES[tamanho];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: tamanho === 'sm' ? 16 : 40, gap: 12 }}>
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid var(--cor-borda)`,
          borderTop: `3px solid var(--cor-primaria)`,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {texto && <p style={{ color: 'var(--cor-texto-secundario)', fontSize: tamanho === 'sm' ? 12 : 14, margin: 0 }}>{texto}</p>}
    </div>
  );
};

export default LoadingSpinner;
