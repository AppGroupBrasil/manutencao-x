import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import styles from './HowItWorks.module.css';

interface Props {
  titulo: string;
  descricao: string;
  passos: string[];
}

const HowItWorks: React.FC<Props> = ({ titulo, descricao, passos }) => {
  const [aberto, setAberto] = useState(false);

  return (
    <div className={styles.container}>
      <button className={styles.toggle} onClick={() => setAberto(!aberto)}>
        <div className={styles.left}>
          <HelpCircle size={18} />
          <span>Como funciona</span>
        </div>
        {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {aberto && (
        <div className={styles.content}>
          <h4 className={styles.title}>{titulo}</h4>
          <p className={styles.desc}>{descricao}</p>
          <ol className={styles.steps}>
            {passos.map((passo, i) => (
              <li key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default HowItWorks;
