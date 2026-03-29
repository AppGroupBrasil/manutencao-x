import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '../types';
import { ROLE_HIERARCHY } from '../types';
import { permissoes as permissoesApi } from '../services/api';

interface FuncaoPermissao {
  id: string;
  ativa: boolean;
  perfis: Record<UserRole, boolean>;
}

interface PermissionsContextData {
  podeVer: (funcaoId?: string) => boolean;
  podeCriar: () => boolean;
  podeEditar: () => boolean;
  podeExcluir: () => boolean;
  podeBloquear: () => boolean;
  podeGerenciarFuncoes: () => boolean;
  podeVerGeolocalizacao: () => boolean;
  podeGerenciarTema: () => boolean;
  podeAlterarLogo: () => boolean;
  hierarquiaSuperior: (roleAlvo: UserRole) => boolean;
  roleNivel: number;
}

const PermissionsContext = createContext<PermissionsContextData>({} as PermissionsContextData);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario } = useAuth();
  const [funcoes, setFuncoes] = useState<FuncaoPermissao[]>([]);

  useEffect(() => {
    if (usuario) {
      permissoesApi.list()
        .then((rows: any[]) => setFuncoes(rows))
        .catch(() => {});
    }
  }, [usuario]);

  const perms = useMemo((): PermissionsContextData => {
    const role = usuario?.role || 'funcionario';
    const nivel = ROLE_HIERARCHY[role];

    return {
      roleNivel: nivel,

      podeVer: (funcaoId?: string) => {
        if (role === 'master') return true;
        if (!funcaoId) return nivel >= ROLE_HIERARCHY.supervisor;
        const funcao = funcoes.find(f => f.id === funcaoId);
        if (!funcao) return true; // se não encontrar a função, permite (compatibilidade)
        if (!funcao.ativa) return false;
        return funcao.perfis[role] ?? false;
      },

      podeCriar: () => nivel >= ROLE_HIERARCHY.supervisor,

      podeEditar: () => nivel >= ROLE_HIERARCHY.supervisor,

      podeExcluir: () => nivel >= ROLE_HIERARCHY.administrador,

      podeBloquear: () => role === 'master',

      podeGerenciarFuncoes: () => nivel >= ROLE_HIERARCHY.administrador,

      podeVerGeolocalizacao: () => nivel >= ROLE_HIERARCHY.supervisor,

      podeGerenciarTema: () => nivel >= ROLE_HIERARCHY.administrador,

      podeAlterarLogo: () => role === 'master',

      hierarquiaSuperior: (roleAlvo: UserRole) => nivel > ROLE_HIERARCHY[roleAlvo],
    };
  }, [usuario, funcoes]);

  return (
    <PermissionsContext.Provider value={perms}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx.podeVer) throw new Error('usePermissions deve ser usado dentro de PermissionsProvider');
  return ctx;
};
