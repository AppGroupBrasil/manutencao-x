import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    globalThis.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          background: '#f5f7fa',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', color: '#1a1a2e', marginBottom: '0.5rem' }}>
            Algo deu errado
          </h1>
          <p style={{ color: '#65676b', marginBottom: '1.5rem', maxWidth: '400px' }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.75rem 2rem',
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Tentar Novamente
          </button>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 2rem',
              background: 'transparent',
              color: '#1a73e8',
              border: '1px solid #1a73e8',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginTop: '0.75rem',
            }}
          >
            Ir Para O Início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
