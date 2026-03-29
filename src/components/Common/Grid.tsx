import React from 'react';
import styles from './Grid.module.css';

interface Props {
  children: React.ReactNode;
  colunas?: number;
  gap?: 'sm' | 'md' | 'lg';
}

const Grid: React.FC<Props> = ({ children, colunas = 3, gap = 'md' }) => {
  return (
    <div
      className={`${styles.grid} ${styles[`gap_${gap}`]}`}
      style={{ '--grid-cols': colunas } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default Grid;
