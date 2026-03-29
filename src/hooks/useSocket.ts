import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../services/api';

type SocketEventName = 'notificacao' | 'os-atualizada' | 'nova-solicitacao';

function getSocketUrl() {
  return import.meta.env.VITE_WS_URL || globalThis.location?.origin || '';
}

export function useSocket(onEvent?: (event: SocketEventName, data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(getSocketUrl(), {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    const forwardEvent = (event: SocketEventName) => (data: unknown) => {
      onEventRef.current?.(event, data);
    };

    const handleConnectError = () => {
      socketRef.current = null;
    };

    socket.on('notificacao', forwardEvent('notificacao'));
    socket.on('os-atualizada', forwardEvent('os-atualizada'));
    socket.on('nova-solicitacao', forwardEvent('nova-solicitacao'));
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinCondominio = useCallback((condominioId: string) => {
    socketRef.current?.emit('join-condominio', condominioId);
  }, []);

  return { socket: socketRef, joinCondominio };
}
