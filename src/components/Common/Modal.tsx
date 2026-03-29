import React from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
  largura?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<Props> = ({ aberto, onFechar, titulo, children, largura = 'md' }) => {
  if (!aberto) return null;

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div
        className={`${styles.modal} ${styles[`size_${largura}`]}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 className={styles.titulo}>{titulo}</h3>
          <button className={styles.fechar} onClick={onFechar}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
