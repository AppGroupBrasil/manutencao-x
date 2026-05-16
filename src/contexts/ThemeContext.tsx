import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { TemaConfig } from '../types';
import { configuracoes as configApi } from '../services/api';
import { useAuth } from './AuthContext';
import { safeStorage } from '../utils/storage';

interface ThemeContextData {
  tema: TemaConfig;
  atualizarTema: (config: Partial<TemaConfig>) => void;
  toggleModoEscuro: () => void;
  cssVars: Record<string, string>;
}

const TEMA_PADRAO: TemaConfig = {
  corPrimaria: '#f57c00',
  corSecundaria: '#e06500',
  corMenu: '#1a1a2e',
  corBotao: '#f57c00',
  corFundo: '#f5f7fa',
  modoEscuro: false,
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function lighten(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(255 * pct);
  const nr = Math.min(255, r + amt);
  const ng = Math.min(255, g + amt);
  const nb = Math.min(255, b + amt);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function darken(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(255 * pct);
  const nr = Math.max(0, r - amt);
  const ng = Math.max(0, g - amt);
  const nb = Math.max(0, b - amt);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario } = useAuth();
  const [tema, setTema] = useState<TemaConfig>(() => {
    const saved = safeStorage.getItem('manutencao_tema');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrar tema azul antigo para novo padrão laranja
        if (parsed.corPrimaria === '#1a73e8') {
          safeStorage.removeItem('manutencao_tema');
          return TEMA_PADRAO;
        }
        return parsed;
      } catch { return TEMA_PADRAO; }
    }
    return TEMA_PADRAO;
  });

  const cssVars = useMemo((): Record<string, string> => {
    const textOnPrimary = luminance(tema.corPrimaria) > 0.5 ? '#1a1a2e' : '#ffffff';
    const textOnMenu = luminance(tema.corMenu) > 0.5 ? '#1a1a2e' : '#ffffff';

    return {
      '--cor-primaria': tema.corPrimaria,
      '--cor-primaria-hover': darken(tema.corPrimaria, 0.1),
      '--cor-primaria-light': lighten(tema.corPrimaria, 0.35),
      '--cor-primaria-rgb': `${hexToRgb(tema.corPrimaria).r}, ${hexToRgb(tema.corPrimaria).g}, ${hexToRgb(tema.corPrimaria).b}`,
      '--cor-secundaria': tema.corSecundaria,
      '--cor-menu': tema.corMenu,
      '--cor-menu-hover': lighten(tema.corMenu, 0.08),
      '--cor-botao': tema.corBotao,
      '--cor-botao-hover': darken(tema.corBotao, 0.1),
      '--cor-fundo': tema.modoEscuro ? '#121212' : '#f5f7fa',
      '--cor-superficie': tema.modoEscuro ? '#1e1e1e' : '#ffffff',
      '--cor-superficie-hover': tema.modoEscuro ? '#2a2a2a' : '#f0f2f5',
      '--cor-borda': tema.modoEscuro ? '#333333' : '#e0e4e8',
      '--cor-texto': tema.modoEscuro ? '#e4e6eb' : '#1a1a2e',
      '--cor-texto-secundario': tema.modoEscuro ? '#b0b3b8' : '#65676b',
      '--cor-texto-sobre-primaria': textOnPrimary,
      '--cor-texto-sobre-menu': textOnMenu,
      '--cor-perigo': '#d32f2f',
      '--cor-sucesso': '#2e7d32',
      '--cor-aviso': '#f57c00',
      '--cor-info': '#0288d1',
      '--sombra-card': tema.modoEscuro
        ? '0 2px 8px rgba(0,0,0,0.4)'
        : '0 2px 12px rgba(0,0,0,0.08)',
      '--sombra-elevada': tema.modoEscuro
        ? '0 8px 32px rgba(0,0,0,0.6)'
        : '0 8px 32px rgba(0,0,0,0.12)',
      '--raio-borda': '12px',
      '--raio-borda-sm': '8px',
      '--espacamento-lista': '0.5cm',
      '--espacamento-secao': '1cm',
    };
  }, [tema]);

  const [themeSyncReady, setThemeSyncReady] = useState(false);

  useEffect(() => {
    safeStorage.setItem('manutencao_tema', JSON.stringify(tema));
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, val]) => root.style.setProperty(key, val));
    document.body.style.backgroundColor = cssVars['--cor-fundo'];
    document.body.style.color = cssVars['--cor-texto'];
  }, [cssVars, tema]);

  useEffect(() => {
    let cancelled = false;

    if (!usuario) {
      setThemeSyncReady(false);
      return () => {
        cancelled = true;
      };
    }

    setThemeSyncReady(false);
    configApi.getTema()
      .then((apiTema: any) => {
        if (!cancelled && apiTema && apiTema.corPrimaria) {
          setTema(apiTema);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setThemeSyncReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [usuario]);

  useEffect(() => {
    if (!usuario || !themeSyncReady) return;
    configApi.setTema(tema).catch(() => {});
  }, [tema, themeSyncReady, usuario]);

  const atualizarTema = (config: Partial<TemaConfig>) => {
    setTema(prev => ({ ...prev, ...config }));
  };

  const toggleModoEscuro = () => {
    setTema(prev => ({ ...prev, modoEscuro: !prev.modoEscuro }));
  };

  return (
    <ThemeContext.Provider value={{ tema, atualizarTema, toggleModoEscuro, cssVars }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx.atualizarTema) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
};
