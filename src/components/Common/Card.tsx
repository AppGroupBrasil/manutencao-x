import React from 'react';
import styles from './Card.module.css';

interface Props {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

const Card: React.FC<Props> = ({ children, className = '', onClick, hover = false, padding = 'md', style }) => {
  return (
    <div
      className={`${styles.card} ${hover ? styles.hover : ''} ${styles[`pad_${padding}`]} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
    >
      {children}
    </div>
  );
};

export default Card;
