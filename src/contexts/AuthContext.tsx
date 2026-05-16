import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth as apiAuth, setToken, getToken } from '../services/api';
import { safeStorage } from '../utils/storage';
import type { User, UserRole } from '../types';

interface AuthContextData {
  usuario: User | null;
  carregando: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  cadastrar: (email: string, senha: string, nome: string, role: UserRole, extras?: { administradorId?: string; supervisorId?: string; condominioId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  atualizarUsuario: (dados: Partial<User>) => Promise<void>;
  loginDireto: (user: User) => void;
  limparErro: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

function persistUsuario(user: User | null) {
  if (user) {
    const serialized = JSON.stringify(user);
    safeStorage.setItem('manutencao_user', serialized);
    safeStorage.setItem('manutencao-usuario', serialized);
    if (user.condominioId) {
      safeStorage.setItem('manutencao-ultimo-condo', user.condominioId);
    }
    return;
  }

  safeStorage.removeItem('manutencao_user');
  safeStorage.removeItem('manutencao-usuario');
}

// Mock data para desenvolvimento sem API configurada
const MOCK_USERS: Record<string, User> = {
  'eduardodominikus@hotmail.com': {
    id: 'eduardo-001',
    email: 'eduardodominikus@hotmail.com',
    nome: 'Eduardo Dominikus',
    role: 'master',
    ativo: true,
    bloqueado: false,
    criadoPor: 'system',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  'master@manutencao.com': {
    id: 'master-001',
    email: 'master@manutencao.com',
    nome: 'Master Admin',
    role: 'master',
    ativo: true,
    bloqueado: false,
    criadoPor: 'system',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  'admin@manutencao.com': {
    id: 'admin-001',
    email: 'admin@manutencao.com',
    nome: 'Administrador',
    role: 'administrador',
    ativo: true,
    bloqueado: false,
    criadoPor: 'master-001',
    administradorId: 'master-001',
    condominioId: 'c1',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  'supervisor@manutencao.com': {
    id: 'sup-001',
    email: 'supervisor@manutencao.com',
    nome: 'Supervisor Silva',
    role: 'supervisor',
    ativo: true,
    bloqueado: false,
    criadoPor: 'admin-001',
    administradorId: 'admin-001',
    supervisorId: 'admin-001',
    condominioId: 'c1',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  'func@manutencao.com': {
    id: 'func-001',
    email: 'func@manutencao.com',
    nome: 'João Funcionário',
    role: 'funcionario',
    ativo: true,
    bloqueado: false,
    criadoPor: 'sup-001',
    administradorId: 'admin-001',
    supervisorId: 'sup-001',
    condominioId: 'c1',
    cargo: 'Auxiliar de Manutenção',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  'aurora@cond.com': {
    id: 'aurora-001',
    email: 'aurora@cond.com',
    nome: 'Admin Aurora',
    role: 'administrador',
    ativo: true,
    bloqueado: false,
    criadoPor: 'master-001',
    administradorId: 'master-001',
    condominioId: 'c1',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
};

const useMockMode = () => {
  try {
    return import.meta.env.VITE_USE_MOCK_AUTH === 'true';
  } catch {
    return false;
  }
};

const useApiMode = () => {
  try {
    return import.meta.env.VITE_USE_MOCK_AUTH !== 'true';
  } catch {
    return true;
  }
};

function isSessionRestoreAbortError(message?: string) {
  if (!message) return false;

  return (
    message.includes('Muitas requisições')
    || message.includes('Sem conexão com o servidor')
    || message.includes('Servidor temporariamente indisponível')
    || message.includes('Servidor demorou para responder')
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const mockMode = useMockMode();
  const apiMode = useApiMode();

  const limparErro = useCallback(() => setErro(null), []);

  const apiToUser = useCallback((data: any): User => ({
    id: data.id,
    email: data.email,
    nome: data.nome,
    role: data.role,
    ativo: data.ativo ?? true,
    bloqueado: data.bloqueado ?? false,
    motivoBloqueio: data.motivoBloqueio || data.motivo_bloqueio,
    criadoPor: data.criadoPor || data.criado_por || '',
    administradorId: data.administradorId || data.administrador_id,
    supervisorId: data.supervisorId || data.supervisor_id,
    condominioId: data.condominioId || data.condominio_id,
    avatarUrl: data.avatarUrl || data.avatar_url,
    telefone: data.telefone,
    cargo: data.cargo,
    criadoEm: data.criadoEm || data.criado_em || Date.now(),
    atualizadoEm: data.atualizadoEm || data.atualizado_em || Date.now(),
  }), []);

  const handleUnauthorized = useCallback(() => {
    setToken(null);
    setUsuario(null);
    persistUsuario(null);
    setErro('Sessão expirada. Faça login novamente.');
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUsuario(null);
    persistUsuario(null);
  }, []);

  const restoreSession = useCallback(async (attempts: number) => {
    const tokenAtStart = getToken();
    for (let currentAttempt = attempts; currentAttempt >= 0; currentAttempt -= 1) {
      try {
        const data = await apiAuth.me();
        const user = apiToUser(data);
        setUsuario(user);
        persistUsuario(user);
        setCarregando(false);
        return;
      } catch (err: any) {
        if (getToken() !== tokenAtStart) {
          setCarregando(false);
          return;
        }
        if (err.message?.includes('expirada') || err.message?.includes('inválido') || err.message?.includes('não encontrado')) {
          handleUnauthorized();
          setCarregando(false);
          return;
        }

        if (isSessionRestoreAbortError(err.message)) {
          clearSession();
          setCarregando(false);
          return;
        }

        if (currentAttempt === 0) {
          setCarregando(false);
          return;
        }

        await new Promise(resolve => globalThis.setTimeout(resolve, 2000));
      }
    }
  }, [apiToUser, clearSession, handleUnauthorized]);

  useEffect(() => {
    globalThis.addEventListener('auth:unauthorized', handleUnauthorized);
    
    if (apiMode) {
      const token = getToken();
      if (token) {
        void restoreSession(2);
      } else {
        persistUsuario(null);
        setCarregando(false);
      }
      return () => globalThis.removeEventListener('auth:unauthorized', handleUnauthorized);
    }

    if (mockMode) {
      const saved = safeStorage.getItem('manutencao_user');
      if (saved) {
        try { setUsuario(JSON.parse(saved)); } catch { /* ignore */ }
      }
      setCarregando(false);
      return () => globalThis.removeEventListener('auth:unauthorized', handleUnauthorized);
    }
    setCarregando(false);
    return () => globalThis.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [apiMode, handleUnauthorized, mockMode, restoreSession]);

  const login = async (email: string, senha: string) => {
    setErro(null);
    setCarregando(true);
    try {
      if (apiMode) {
        const { token, user } = await apiAuth.login(email, senha);
        setToken(token);
        const normalizedUser = apiToUser(user);
        setUsuario(normalizedUser);
        persistUsuario(normalizedUser);
      } else if (mockMode) {
        const mockUser = MOCK_USERS[email.toLowerCase()];
        if (mockUser && senha.length >= 6) {
          if (mockUser.bloqueado) {
            throw new Error(mockUser.motivoBloqueio || 'Conta bloqueada. Entre em contato com o suporte.');
          }
          setUsuario(mockUser);
          persistUsuario(mockUser);
        } else {
          throw new Error('E-mail ou senha inválidos.');
        }
      }
    } catch (e: any) {
      const msg = e.message || 'Erro ao fazer login.';
      setErro(msg);
      throw new Error(msg);
    } finally {
      setCarregando(false);
    }
  };

  const cadastrar = async (email: string, senha: string, nome: string, role: UserRole, extras?: { administradorId?: string; supervisorId?: string; condominioId?: string }) => {
    setErro(null);
    setCarregando(true);
    try {
      if (apiMode) {
        await apiAuth.register({ email, senha, nome, role, condominioId: extras?.condominioId, supervisorId: extras?.supervisorId });
      } else if (mockMode) {
        const newUser: User = {
          id: `user-${Date.now()}`,
          email,
          nome,
          role,
          ativo: true,
          bloqueado: false,
          criadoPor: usuario?.id || 'system',
          administradorId: extras?.administradorId || (usuario?.role === 'administrador' ? usuario.id : usuario?.administradorId),
          supervisorId: extras?.supervisorId || (usuario?.role === 'supervisor' ? usuario.id : undefined),
          condominioId: extras?.condominioId || usuario?.condominioId,
          criadoEm: Date.now(),
          atualizadoEm: Date.now(),
        };
        MOCK_USERS[email.toLowerCase()] = newUser;
      }
    } catch (e: any) {
      const msg = e.message || 'Erro ao cadastrar.';
      setErro(msg);
      throw new Error(msg);
    } finally {
      setCarregando(false);
    }
  };

  const loginDireto = (user: User) => {
    setUsuario(user);
    persistUsuario(user);
    setCarregando(false);
  };

  const logout = async () => {
    if (apiMode) {
      setUsuario(null);
      setToken(null);
      persistUsuario(null);
    } else if (mockMode) {
      setUsuario(null);
      persistUsuario(null);
    }
  };

  const atualizarUsuario = async (dados: Partial<User>) => {
    if (!usuario) return;
    if (apiMode || mockMode) {
      const updated = { ...usuario, ...dados, atualizadoEm: Date.now() };
      setUsuario(updated);
      persistUsuario(updated);
    }
  };

  const contextValue = useMemo(() => ({
    usuario,
    carregando,
    erro,
    login,
    cadastrar,
    logout,
    atualizarUsuario,
    loginDireto,
    limparErro,
  }), [usuario, carregando, erro, login, cadastrar, logout, atualizarUsuario, loginDireto, limparErro]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx.login) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};


