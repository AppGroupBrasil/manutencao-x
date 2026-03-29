import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDemo } from '../../contexts/DemoContext';
import { seedDemoData, DEMO_USERS } from '../../utils/demoData';
import { safeStorage } from '../../utils/storage';
import type { User, UserRole } from '../../types';

const DemoEntryPage: React.FC = () => {
  const { perfil } = useParams<{ perfil: string }>();
  const navigate = useNavigate();
  const { logout, usuario, loginDireto } = useAuth();
  const { setDemo } = useDemo();

  useEffect(() => {
    const iniciarDemo = async () => {
      const perfilKey = perfil?.toLowerCase() || 'administrador';
      const demoProfile = DEMO_USERS[perfilKey];

      if (!demoProfile) {
        navigate('/');
        return;
      }

      // Logout current user if any
      if (usuario) {
        await logout();
      }

      // Seed demo data
      seedDemoData();

      // Create demo user and login
      const demoUser: User = {
        id: demoProfile.id,
        email: demoProfile.email,
        nome: demoProfile.nome,
        role: demoProfile.role as UserRole,
        ativo: true,
        bloqueado: false,
        criadoPor: 'system',
        administradorId: perfilKey === 'administrador' ? undefined : 'demo-admin',
        supervisorId: perfilKey === 'funcionario' ? 'demo-sup' : undefined,
        condominioId: demoProfile.condominioId,
        criadoEm: Date.now(),
        atualizadoEm: Date.now(),
      };

      safeStorage.setItem('manutencao_user', JSON.stringify(demoUser));
      safeStorage.setItem('manutencao-ultimo-condo', demoProfile.condominioId);

      // Activate demo mode
      setDemo(true);

      // Set user in auth context state and navigate
      loginDireto(demoUser);
      navigate('/dashboard', { replace: true });
    };

    void iniciarDemo();
  }, [loginDireto, logout, navigate, perfil, setDemo, usuario]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#fafafa',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #f57c00',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: '#6b7280', fontSize: 15, fontWeight: 500 }}>
          Preparando demonstração...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
};

export default DemoEntryPage;
