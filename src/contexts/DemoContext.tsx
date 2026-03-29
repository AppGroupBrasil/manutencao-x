import React, { createContext, useContext, useState, useCallback } from 'react';

const DEMO_KEY = 'manutencao_demo_mode';

interface DemoContextData {
  isDemo: boolean;
  setDemo: (value: boolean) => void;
  tentarAcao: () => boolean;
  mostrarModal: boolean;
  fecharModal: () => void;
}

const DemoContext = createContext<DemoContextData>({
  isDemo: false,
  setDemo: () => {},
  tentarAcao: () => true,
  mostrarModal: false,
  fecharModal: () => {},
});

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemo, setDemoState] = useState(() => sessionStorage.getItem(DEMO_KEY) === 'true');
  const [mostrarModal, setMostrarModal] = useState(false);

  const setDemo = useCallback((value: boolean) => {
    setDemoState(value);
    if (value) {
      sessionStorage.setItem(DEMO_KEY, 'true');
    } else {
      sessionStorage.removeItem(DEMO_KEY);
    }
  }, []);

  const tentarAcao = useCallback(() => {
    if (!isDemo) return true;
    setMostrarModal(true);
    return false;
  }, [isDemo]);

  const fecharModal = useCallback(() => setMostrarModal(false), []);

  return (
    <DemoContext.Provider value={{ isDemo, setDemo, tentarAcao, mostrarModal, fecharModal }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);
