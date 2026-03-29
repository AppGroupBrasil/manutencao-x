import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

const OfflineIndicator: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    return () => {
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#dc2626', color: '#fff', padding: '8px 20px', borderRadius: 24,
      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
      zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <WifiOff size={16} /> Você está offline
    </div>
  );
};

export default OfflineIndicator;
