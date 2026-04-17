import React from 'react';
import { Download, RefreshCw, Wifi } from 'lucide-react';
import { usePwa } from '../../hooks/usePwa';

const cardStyle: React.CSSProperties = {
  width: 'min(360px, calc(100vw - 32px))',
  background: 'var(--cor-superficie)',
  border: '1px solid var(--cor-borda)',
  borderRadius: 16,
  boxShadow: 'var(--sombra-elevada)',
  padding: 16,
};

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--cor-texto)',
  marginBottom: 6,
};

const textStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--cor-texto-secundario)',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 14,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--cor-borda)',
  background: 'transparent',
  color: 'var(--cor-texto)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--cor-primaria)',
  color: 'var(--cor-texto-sobre-primaria)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const PwaManager: React.FC = () => {
  const {
    canInstall,
    needRefresh,
    offlineReady,
    showIosInstallHint,
    promptInstall,
    applyUpdate,
    dismissOfflineReady,
    dismissIosInstallHint,
  } = usePwa();
  const isDev = import.meta.env.DEV;

  React.useEffect(() => {
    if (!offlineReady) return undefined;

    const timeoutId = globalThis.setTimeout(() => {
      dismissOfflineReady();
    }, 4500);

    return () => globalThis.clearTimeout(timeoutId);
  }, [dismissOfflineReady, offlineReady]);

  if (isDev) return null;

  if (!canInstall && !needRefresh && !offlineReady && !showIosInstallHint) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        display: 'grid',
        gap: 12,
        zIndex: 10001,
      }}
    >
      {canInstall ? (
        <section style={cardStyle} aria-live="polite">
          <div style={titleStyle}>
            <Download size={18} color="var(--cor-primaria)" />
            Instalar aplicativo
          </div>
          <p style={textStyle}>
            Instale o Manutenção X para abrir em tela cheia, receber atualizações mais rápido e usar a base do app offline.
          </p>
          <div style={actionsStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => { void promptInstall(); }}>
              Instalar agora
            </button>
          </div>
        </section>
      ) : null}

      {showIosInstallHint ? (
        <section style={cardStyle} aria-live="polite">
          <div style={titleStyle}>
            <Download size={18} color="var(--cor-primaria)" />
            Instalar no iPhone ou iPad
          </div>
          <p style={textStyle}>
            No Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio para instalar o app como PWA.
          </p>
          <div style={actionsStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={dismissIosInstallHint}>
              Fechar
            </button>
          </div>
        </section>
      ) : null}

      {needRefresh ? (
        <section style={cardStyle} aria-live="assertive">
          <div style={titleStyle}>
            <RefreshCw size={18} color="var(--cor-info)" />
            Atualização disponível
          </div>
          <p style={textStyle}>
            Uma nova versão do sistema foi baixada. Recarregue para aplicar a atualização do PWA.
          </p>
          <div style={actionsStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => { void applyUpdate(); }}>
              Atualizar
            </button>
          </div>
        </section>
      ) : null}

      {offlineReady ? (
        <section style={cardStyle} aria-live="polite">
          <div style={titleStyle}>
            <Wifi size={18} color="var(--cor-sucesso)" />
            App pronto para uso offline
          </div>
          <p style={textStyle}>
            Os arquivos principais do sistema ja foram armazenados no dispositivo para melhorar carregamento e resiliencia.
          </p>
          <div style={actionsStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={dismissOfflineReady}>
              Fechar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default PwaManager;