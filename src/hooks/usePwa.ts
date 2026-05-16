import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

const PWA_RESET_VERSION = 'pwa-reset-2026-04-19-2';
const PWA_RESET_STORAGE_KEY = 'manutencaox_pwa_reset_version';

function isStandaloneMode() {
  return globalThis.matchMedia('(display-mode: standalone)').matches
    || (globalThis.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(globalThis.navigator.userAgent);
}

function isLocalDevelopmentHost() {
  const host = globalThis.location.hostname;
  return import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1');
}

export function usePwa() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const updateServiceWorkerRef = useRef<UpdateServiceWorker | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [showIosInstallHint, setShowIosInstallHint] = useState(() => isIosDevice() && !isStandaloneMode());

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in globalThis.navigator)) return;

    const appliedResetVersion = globalThis.localStorage.getItem(PWA_RESET_STORAGE_KEY);
    if (appliedResetVersion === PWA_RESET_VERSION) return;

    void (async () => {
      try {
        const registrations = await globalThis.navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ('caches' in globalThis) {
          const cacheKeys = await globalThis.caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => globalThis.caches.delete(cacheKey)));
        }

        globalThis.localStorage.setItem(PWA_RESET_STORAGE_KEY, PWA_RESET_VERSION);
        globalThis.location.reload();
      } catch {
        // Ignore cleanup failures and allow the app to continue booting.
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLocalDevelopmentHost() || !('serviceWorker' in globalThis.navigator)) return;

    void globalThis.navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});

    if (!('caches' in globalThis)) return;

    void globalThis.caches.keys()
      .then((cacheKeys) => Promise.all(cacheKeys.map((cacheKey) => globalThis.caches.delete(cacheKey))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const deferredPrompt = event as BeforeInstallPromptEvent;
      deferredPrompt.preventDefault();
      deferredPromptRef.current = deferredPrompt;
      setCanInstall(!isStandaloneMode());
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
      setShowIosInstallHint(false);
    };

    globalThis.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    globalThis.addEventListener('appinstalled', onAppInstalled);

    return () => {
      globalThis.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      globalThis.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt || isInstalled) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      deferredPromptRef.current = null;
      setCanInstall(false);
      return true;
    }

    return false;
  };

  const applyUpdate = async () => {
    if (!updateServiceWorkerRef.current) return;
    setNeedRefresh(false);
    await updateServiceWorkerRef.current(true);
  };

  const dismissOfflineReady = () => setOfflineReady(false);
  const dismissIosInstallHint = () => setShowIosInstallHint(false);

  return {
    canInstall: canInstall && !isInstalled,
    needRefresh,
    offlineReady,
    showIosInstallHint: showIosInstallHint && !isInstalled && !canInstall,
    promptInstall,
    applyUpdate,
    dismissOfflineReady,
    dismissIosInstallHint,
  };
}