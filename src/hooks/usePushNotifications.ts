import { useEffect, useRef } from 'react';
import { push as pushApi } from '../services/api';

/**
 * Hook que gerencia a inscrição de push notifications.
 * Chama a API para obter a VAPID key e se inscreve automaticamente.
 */
export function usePushNotifications(isLoggedIn: boolean) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribe = async () => {
      try {
        const { key, enabled } = await pushApi.getVapidKey();
        if (!enabled || !key) return;

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          // Já inscrito, sincronizar com o backend
          await pushApi.subscribe(existing.toJSON()).catch(() => {});
          subscribedRef.current = true;
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });

        await pushApi.subscribe(subscription.toJSON());
        subscribedRef.current = true;
      } catch {
        // Push não suportado ou negado pelo usuário
      }
    };

    subscribe();
  }, [isLoggedIn]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
