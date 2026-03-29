import React from 'react';
import { Share2, Printer, FileText } from 'lucide-react';
import styles from './ActionBar.module.css';

interface Props {
  onCompartilhar: () => void;
  onImprimir: () => void;
  onGerarPdf: () => void;
}

const ActionBar: React.FC<Props> = ({ onCompartilhar, onImprimir, onGerarPdf }) => {
  return (
    <div className={styles.bar}>
      <button className={styles.btn} onClick={onCompartilhar} title="Compartilhar">
        <Share2 size={16} />
        <span>Compartilhar</span>
      </button>
      <button className={styles.btn} onClick={onImprimir} title="Imprimir">
        <Printer size={16} />
        <span>Imprimir</span>
      </button>
      <button className={`${styles.btn} ${styles.pdfBtn}`} onClick={onGerarPdf} title="Gerar PDF">
        <FileText size={16} />
        <span>Gerar PDF</span>
      </button>
    </div>
  );
};

export default ActionBar;
