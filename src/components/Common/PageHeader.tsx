import React from 'react';
import ActionBar from './ActionBar';
import styles from './PageHeader.module.css';

interface Props {
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
  onCompartilhar?: () => void;
  onImprimir?: () => void;
  onGerarPdf?: () => void;
}

const PageHeader: React.FC<Props> = ({ titulo, subtitulo, acoes, onCompartilhar, onImprimir, onGerarPdf }) => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.titulo}>{titulo}</h1>
        {subtitulo && <p className={styles.subtitulo}>{subtitulo}</p>}
      </div>
      <div className={styles.right}>
        {onCompartilhar && onImprimir && onGerarPdf && (
          <ActionBar
            onCompartilhar={onCompartilhar}
            onImprimir={onImprimir}
            onGerarPdf={onGerarPdf}
          />
        )}
        {acoes}
      </div>
    </div>
  );
};

export default PageHeader;
