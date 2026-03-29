import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import type { UserRole } from '../../types';
import { Shield, ToggleLeft, ToggleRight, Users, Lock } from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { permissoes as permissoesApi } from '../../services/api';
import styles from '../Usuarios/Usuarios.module.css';

interface FuncaoPermissao {
  id: string;
  nome: string;
  ativa: boolean;
  perfis: Record<UserRole, boolean>;
}

const FUNCOES_PADRAO: FuncaoPermissao[] = [
  { id: 'dashboard', nome: 'Dashboard', ativa: true, perfis: { master: true, administrador: true, supervisor: true, funcionario: true } },
  { id: 'condominios', nome: 'Condomínios', ativa: true, perfis: { master: true, administrador: true, supervisor: true, funcionario: false } },
];

const PermissoesPage: React.FC = () => {
  const { usuario } = useAuth();
  const { podeGerenciarFuncoes } = usePermissions();
  const { tentarAcao } = useDemo();
  const [funcoes, setFuncoes] = useState<FuncaoPermissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    permissoesApi.list()
      .then(rows => setFuncoes(rows as FuncaoPermissao[]))
      .catch(() => setFuncoes(FUNCOES_PADRAO))
      .finally(() => setLoading(false));
  }, []);

  const toggleFuncao = async (funcaoId: string) => {
    if (!tentarAcao()) return;
    const funcao = funcoes.find(f => f.id === funcaoId);
    if (!funcao) return;
    try {
      await permissoesApi.update(funcaoId, { ativa: !funcao.ativa });
      setFuncoes(prev => prev.map(f => f.id === funcaoId ? { ...f, ativa: !f.ativa } : f));
    } catch (err) { console.error(err); }
  };

  const togglePerfil = async (funcaoId: string, perfil: UserRole) => {
    if (!tentarAcao()) return;
    if (perfil === 'master') return;
    const funcao = funcoes.find(f => f.id === funcaoId);
    if (!funcao) return;
    const novosPerfis = { ...funcao.perfis, [perfil]: !funcao.perfis[perfil] };
    try {
      await permissoesApi.update(funcaoId, { perfis: novosPerfis });
      setFuncoes(prev => prev.map(f =>
        f.id === funcaoId ? { ...f, perfis: novosPerfis } : f
      ));
    } catch (err) { console.error(err); }
  };

  const perfis: UserRole[] = ['master', 'administrador', 'supervisor', 'funcionario'];
  const perfilLabels: Record<string, string> = {
    master: 'Master',
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    funcionario: 'Funcionário',
  };

  return (
    <div id="permissoes-content">
      <HowItWorks
        titulo="Gestão de Permissões"
        descricao="Configure quai funções estão disponíveis para cada perfil de usuário. Master e Administrador podem ativar/desativar funções."
        passos={[
          'Veja a tabela de funções x perfis',
          'Ative ou desative funções do sistema com o toggle',
          'Defina quais perfis têm acesso a cada função',
          'Master tem acesso irrestrito a todas as funções',
          'Supervisor e Funcionário só veem funções habilitadas',
          'As alterações são aplicadas imediatamente',
        ]}
      />

      <PageHeader
        titulo="Permissões"
        subtitulo="Controle de acesso por perfil"
        onCompartilhar={() => compartilharConteudo('Permissões', 'Tabela de permissões')}
        onImprimir={() => imprimirElemento('permissoes-content')}
        onGerarPdf={() => gerarPdfDeElemento('permissoes-content', 'permissoes')}
      />

      <Card padding="md">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cor-primaria)', color: 'white' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12.5, fontWeight: 700 }}>Função</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, width: 100 }}>Status</th>
                {perfis.map(p => (
                  <th key={p} style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, width: 120 }}>
                    {perfilLabels[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funcoes.map(func => (
                <tr key={func.id} style={{ borderBottom: '1px solid var(--cor-borda)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--cor-texto)' }}>{func.nome}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      style={{ background: 'none', border: 'none', cursor: podeGerenciarFuncoes() ? 'pointer' : 'default', color: func.ativa ? '#2e7d32' : '#9e9e9e' }}
                      onClick={() => podeGerenciarFuncoes() && toggleFuncao(func.id)}
                    >
                      {func.ativa ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </td>
                  {perfis.map(p => (
                    <td key={p} style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {p === 'master' ? (
                        <Lock size={16} color="var(--cor-texto-secundario)" />
                      ) : (
                        <button
                          style={{
                            width: 24, height: 24, borderRadius: 6,
                            border: `2px solid ${func.perfis[p] ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
                            background: func.perfis[p] ? 'var(--cor-primaria)' : 'transparent',
                            cursor: podeGerenciarFuncoes() ? 'pointer' : 'default',
                            color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                          }}
                          onClick={() => podeGerenciarFuncoes() && togglePerfil(func.id, p)}
                        >
                          {func.perfis[p] ? '✓' : ''}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--cor-texto)' }}>Legenda de Hierarquia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--cor-texto-secundario)' }}>
            <div><strong style={{ color: 'var(--cor-texto)' }}>Master:</strong> Acesso total. Bloqueia/desbloqueia usuários por inadimplência. Altera logo. Vê tudo de todos.</div>
            <div><strong style={{ color: 'var(--cor-texto)' }}>Administrador:</strong> Gerencia seus usuários. Ativa/desativa funções. Edita e exclui registros.</div>
            <div><strong style={{ color: 'var(--cor-texto)' }}>Supervisor:</strong> Vê apenas funções habilitadas pelo administrador. Edita se habilitado. Rastreamento GPS ativo.</div>
            <div><strong style={{ color: 'var(--cor-texto)' }}>Funcionário:</strong> Vê apenas o que foi habilitado pela hierarquia. Rastreamento GPS ativo.</div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PermissoesPage;
