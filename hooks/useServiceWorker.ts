'use client';

import { useState, useEffect } from 'react';

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker(): ServiceWorkerStatus {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isOffline: false,
    registration: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      isSupported: true,
      isOffline: !navigator.onLine,
    }));

    const handleOnline = () => setStatus((p) => ({ ...p, isOffline: false }));
    const handleOffline = () => setStatus((p) => ({ ...p, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        setStatus((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));
      })
      .catch((err) => {
        console.warn('[SW] Service Worker registration skipped:', err);
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
