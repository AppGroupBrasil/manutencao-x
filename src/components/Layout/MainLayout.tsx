import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import DemoBlockModal from '../Common/DemoBlockModal';
import GlobalSearch from '../Common/GlobalSearch';
import { usePermissions } from '../../contexts/PermissionsContext';
import styles from './MainLayout.module.css';

const MainLayout: React.FC = () => {
  const { roleNivel } = usePermissions();
  const isMobileBarUser = roleNivel <= 2;

  return (
    <div className={`${styles.layout} ${isMobileBarUser ? styles.layoutTopBar : ''}`}>
      <Sidebar />
      <main className={`${styles.main} ${isMobileBarUser ? styles.mainTopBar : ''}`}>
        <Outlet />
      </main>
      <DemoBlockModal />
      <GlobalSearch />
    </div>
  );
};

export default MainLayout;
