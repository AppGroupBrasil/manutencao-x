import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../../contexts/DemoContext';
import { useAuth } from '../../contexts/AuthContext';
import { X, Rocket } from 'lucide-react';
import styles from './DemoBlockModal.module.css';

const DemoBlockModal: React.FC = () => {
  const { mostrarModal, fecharModal, setDemo } = useDemo();
  const { logout } = useAuth();
  const navigate = useNavigate();

  if (!mostrarModal) return null;

  const handleCadastrar = async () => {
    fecharModal();
    setDemo(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.overlay} onClick={fecharModal}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={fecharModal}>
          <X size={20} />
        </button>
        <div className={styles.iconWrapper}>
          <Rocket size={40} />
        </div>
        <h2 className={styles.titulo}>Modo Demonstração</h2>
        <p className={styles.descricao}>
          Esta é uma versão de demonstração. Para criar, editar ou excluir registros,
          cadastre-se e aproveite <strong>7 dias grátis</strong> para testar todas as funcionalidades!
        </p>
        <button className={styles.btnCadastrar} onClick={handleCadastrar}>
          Cadastre-se e Teste Grátis
        </button>
        <button className={styles.btnVoltar} onClick={fecharModal}>
          Continuar Explorando
        </button>
      </div>
    </div>
  );
};

export default DemoBlockModal;
