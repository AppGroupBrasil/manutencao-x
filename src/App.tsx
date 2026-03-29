import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ROLE_HIERARCHY } from './types';
import MainLayout from './components/Layout/MainLayout';
import { getPortalToken, setPortalToken, portal as portalApi } from './services/api';
import type { MoradorPortal } from './types';
import OfflineIndicator from './components/Common/OfflineIndicator';
import { usePushNotifications } from './hooks/usePushNotifications';

const lazyPage = <T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>) => React.lazy(loader);

const LoginPage = lazyPage(() => import('./pages/Auth/LoginPage'));
const BloqueadoPage = lazyPage(() => import('./pages/Auth/BloqueadoPage'));
const LandingPage = lazyPage(() => import('./pages/Landing/LandingPage'));
const DashboardPage = lazyPage(() => import('./pages/Dashboard/DashboardPage'));
const UsuariosPage = lazyPage(() => import('./pages/Usuarios/UsuariosPage'));
const CondominiosPage = lazyPage(() => import('./pages/Condominios/CondominiosPage'));
const OrdensServicoPage = lazyPage(() => import('./pages/OrdensServico/OrdensServicoPage'));
const ChecklistsPage = lazyPage(() => import('./pages/Checklists/ChecklistsPage'));
const EscalasPage = lazyPage(() => import('./pages/Escalas/EscalasPage'));
const MateriaisPage = lazyPage(() => import('./pages/Materiais/MateriaisPage'));
const InspecoesPage = lazyPage(() => import('./pages/Inspecoes/InspecoesPage'));
const GeolocalizacaoPage = lazyPage(() => import('./pages/Geolocalizacao/GeolocalizacaoPage'));
const RelatoriosPage = lazyPage(() => import('./pages/Relatorios/RelatoriosPage'));
const PermissoesPage = lazyPage(() => import('./pages/Permissoes/PermissoesPage'));
const ConfiguracoesPage = lazyPage(() => import('./pages/Configuracoes/ConfiguracoesPage'));
const ReportesPage = lazyPage(() => import('./pages/Reportes/ReportesPage'));
const VistoriaPage = lazyPage(() => import('./pages/Vistorias/VistoriaPage'));
const QRCodePage = lazyPage(() => import('./pages/QRCode/QRCodePage'));
const LeitorQRCodePage = lazyPage(() => import('./pages/QRCode/LeitorQRCodePage'));
const RespostasQRCodePage = lazyPage(() => import('./pages/QRCode/RespostasQRCodePage'));
const MapaCalorPage = lazyPage(() => import('./pages/MapaCalor/MapaCalorPage'));
const TarefasPage = lazyPage(() => import('./pages/Tarefas/TarefasPage'));
const RoteiroExecucaoPage = lazyPage(() => import('./pages/Roteiros/RoteiroExecucaoPage'));
const VencimentosPage = lazyPage(() => import('./pages/Vencimentos/VencimentosPage'));
const MoradoresPage = lazyPage(() => import('./pages/Moradores/MoradoresPage'));
const ComunicadosPage = lazyPage(() => import('./pages/Comunicados/ComunicadosPage'));
const QuadroAtividadesPage = lazyPage(() => import('./pages/QuadroAtividades/QuadroAtividadesPage'));
const DemoEntryPage = lazyPage(() => import('./pages/Demo/DemoEntryPage'));
const CadastroPage = lazyPage(() => import('./pages/Auth/CadastroPage'));
const EsqueciSenhaPage = lazyPage(() => import('./pages/Auth/EsqueciSenhaPage'));
const PerfilPage = lazyPage(() => import('./pages/Perfil/PerfilPage'));
const NotificacoesPage = lazyPage(() => import('./pages/Notificacoes/NotificacoesPage'));
const AuditoriaPage = lazyPage(() => import('./pages/Auditoria/AuditoriaPage'));
const EquipamentosPage = lazyPage(() => import('./pages/Equipamentos/EquipamentosPage'));
const FornecedoresPage = lazyPage(() => import('./pages/Fornecedores/FornecedoresPage'));
const PlanosManutencaoPage = lazyPage(() => import('./pages/PlanosManutencao/PlanosManutencaoPage'));
const CustosPage = lazyPage(() => import('./pages/Custos/CustosPage'));
const KPIsPage = lazyPage(() => import('./pages/KPIs/KPIsPage'));
const DocumentosPage = lazyPage(() => import('./pages/Documentos/DocumentosPage'));
const SolicitacoesPage = lazyPage(() => import('./pages/Solicitacoes/SolicitacoesPage'));
const SLAPage = lazyPage(() => import('./pages/SLA/SLAPage'));
const CalendarioPage = lazyPage(() => import('./pages/Calendario/CalendarioPage'));
const WhatsAppPage = lazyPage(() => import('./pages/WhatsApp/WhatsAppPage'));
const SindicoPage = lazyPage(() => import('./pages/Sindico/SindicoPage'));
const PontoPage = lazyPage(() => import('./pages/Ponto/PontoPage'));
const OrcamentosPage = lazyPage(() => import('./pages/Orcamentos/OrcamentosPage'));
const PortalLoginPage = lazyPage(() => import('./pages/Portal/PortalLoginPage'));
const PortalLayout = lazyPage(() => import('./pages/Portal/PortalLayout'));
const PortalDashboardPage = lazyPage(() => import('./pages/Portal/PortalDashboardPage'));
const PortalSolicitacoesPage = lazyPage(() => import('./pages/Portal/PortalSolicitacoesPage'));
const PortalComunicadosPage = lazyPage(() => import('./pages/Portal/PortalComunicadosPage'));
const PortalPerfilPage = lazyPage(() => import('./pages/Portal/PortalPerfilPage'));

const RouteFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cor-fundo)' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--cor-borda)', borderTop: '3px solid var(--cor-primaria)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--cor-texto-secundario)', fontSize: 14 }}>Carregando...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cor-fundo)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--cor-borda)', borderTop: '3px solid var(--cor-primaria)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--cor-texto-secundario)', fontSize: 14 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.bloqueado) return <Navigate to="/bloqueado" replace />;

  return <>{children}</>;
};

const RoleGuard: React.FC<{ minRole: number; children: React.ReactNode }> = ({ minRole, children }) => {
  const { usuario } = useAuth();
  const nivel = ROLE_HIERARCHY[usuario?.role || 'funcionario'];
  if (nivel < minRole) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const { usuario, carregando } = useAuth();
  usePushNotifications(!!usuario);
  const [morador, setMorador] = React.useState<MoradorPortal | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getPortalToken();
    if (token) {
      portalApi.me()
        .then((m: any) => setMorador(m))
        .catch(() => setPortalToken(null))
        .finally(() => setPortalLoading(false));
    } else {
      setPortalLoading(false);
    }
  }, []);

  const handlePortalLogin = (m: any) => {
    setMorador(m);
  };

  const handlePortalLogout = () => {
    setPortalToken(null);
    setMorador(null);
  };

  return (
    <>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Página institucional pública */}
      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={
        !carregando && usuario && !usuario.bloqueado ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />
      <Route path="/bloqueado" element={<BloqueadoPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
      <Route path="/demo/:perfil" element={<DemoEntryPage />} />

      {/* Portal do Morador */}
      <Route path="/portal/login" element={
        !portalLoading && morador ? <Navigate to="/portal" replace /> : <PortalLoginPage onLogin={handlePortalLogin} />
      } />
      <Route path="/portal" element={
        !portalLoading && !morador ? <Navigate to="/portal/login" replace /> : <PortalLayout morador={morador} onLogout={handlePortalLogout} />
      }>
        <Route index element={<PortalDashboardPage morador={morador} />} />
        <Route path="solicitacoes" element={<PortalSolicitacoesPage />} />
        <Route path="comunicados" element={<PortalComunicadosPage />} />
        <Route path="perfil" element={<PortalPerfilPage morador={morador} onUpdate={setMorador} />} />
      </Route>

      {/* Rotas protegidas do sistema */}
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="condominios" element={<RoleGuard minRole={2}><CondominiosPage /></RoleGuard>} />
        <Route path="usuarios" element={<RoleGuard minRole={3}><UsuariosPage /></RoleGuard>} />
        <Route path="ordens-servico" element={<OrdensServicoPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="vistorias" element={<VistoriaPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="escalas" element={<RoleGuard minRole={2}><EscalasPage /></RoleGuard>} />
        <Route path="materiais" element={<MateriaisPage />} />
        <Route path="inspecoes" element={<RoleGuard minRole={2}><InspecoesPage /></RoleGuard>} />
        <Route path="geolocalizacao" element={<RoleGuard minRole={2}><GeolocalizacaoPage /></RoleGuard>} />
        <Route path="relatorios" element={<RoleGuard minRole={2}><RelatoriosPage /></RoleGuard>} />
        <Route path="permissoes" element={<RoleGuard minRole={3}><PermissoesPage /></RoleGuard>} />
        <Route path="qrcode" element={<RoleGuard minRole={2}><QRCodePage /></RoleGuard>} />
        <Route path="leitor-qrcode" element={<LeitorQRCodePage />} />
        <Route path="respostas-qrcode" element={<RoleGuard minRole={2}><RespostasQRCodePage /></RoleGuard>} />
        <Route path="mapa-calor" element={<RoleGuard minRole={3}><MapaCalorPage /></RoleGuard>} />
        <Route path="tarefas" element={<TarefasPage />} />
        <Route path="roteiros" element={<RoteiroExecucaoPage />} />
        <Route path="vencimentos" element={<RoleGuard minRole={2}><VencimentosPage /></RoleGuard>} />
        <Route path="moradores" element={<RoleGuard minRole={2}><MoradoresPage /></RoleGuard>} />
        <Route path="comunicados" element={<RoleGuard minRole={2}><ComunicadosPage /></RoleGuard>} />
        <Route path="quadro-atividades" element={<QuadroAtividadesPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="notificacoes" element={<NotificacoesPage />} />
        <Route path="auditoria" element={<RoleGuard minRole={3}><AuditoriaPage /></RoleGuard>} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
        <Route path="equipamentos" element={<RoleGuard minRole={2}><EquipamentosPage /></RoleGuard>} />
        <Route path="fornecedores" element={<RoleGuard minRole={2}><FornecedoresPage /></RoleGuard>} />
        <Route path="planos-manutencao" element={<RoleGuard minRole={2}><PlanosManutencaoPage /></RoleGuard>} />
        <Route path="custos" element={<RoleGuard minRole={2}><CustosPage /></RoleGuard>} />
        <Route path="kpis" element={<RoleGuard minRole={2}><KPIsPage /></RoleGuard>} />
        <Route path="documentos" element={<RoleGuard minRole={2}><DocumentosPage /></RoleGuard>} />
        <Route path="solicitacoes" element={<RoleGuard minRole={2}><SolicitacoesPage /></RoleGuard>} />
        <Route path="sla" element={<RoleGuard minRole={2}><SLAPage /></RoleGuard>} />
        <Route path="calendario" element={<RoleGuard minRole={2}><CalendarioPage /></RoleGuard>} />
        <Route path="whatsapp" element={<RoleGuard minRole={3}><WhatsAppPage /></RoleGuard>} />
        <Route path="sindico" element={<RoleGuard minRole={3}><SindicoPage /></RoleGuard>} />
        <Route path="ponto" element={<PontoPage />} />
        <Route path="orcamentos" element={<RoleGuard minRole={2}><OrcamentosPage /></RoleGuard>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    <OfflineIndicator />
    </>
  );
};

export default App;
