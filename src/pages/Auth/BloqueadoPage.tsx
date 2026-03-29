import React from 'react';
import { ShieldOff, MessageCircle } from 'lucide-react';
import styles from './Auth.module.css';

interface Props {
  mensagem?: string;
}

const BloqueadoPage: React.FC<Props> = ({ mensagem }) => {
  const abrirSuporte = () => {
    window.open('mailto:suporte@manutencaox.com.br?subject=Conta%20Bloqueada%20-%20Suporte', '_blank');
  };

  return (
    <div className={styles.rightPanel} style={{ width: '100vw', height: '100vh' }}>
      <div className={styles.formContainer} style={{ textAlign: 'center' }}>
        <ShieldOff size={64} color="#d32f2f" style={{ marginBottom: 24 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--cor-texto)', marginBottom: 12 }}>
          Conta Bloqueada
        </h1>
        <p style={{ fontSize: 15, color: 'var(--cor-texto-secundario)', lineHeight: 1.7, marginBottom: 32 }}>
          {mensagem || 'Sua conta foi bloqueada por inadimplência. Entre em contato com o suporte para regularizar sua situação.'}
        </p>
        <button className={styles.submitBtn} onClick={abrirSuporte} style={{ maxWidth: 300, margin: '0 auto' }}>
          <MessageCircle size={18} style={{ marginRight: 8 }} />
          Entrar em Contato com o Suporte
        </button>
      </div>
    </div>
  );
};

export default BloqueadoPage;
