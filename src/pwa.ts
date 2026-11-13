/**
 * PWA helpers: service worker registration (offline support) and the
 * "Install app" prompt.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredPrompt: InstallEvent | null = null;
const installListeners = new Set<() => void>();
const updateListeners = new Set<() => void>();
let updateReady = false;
let waitingWorker: ServiceWorker | null = null;

function emit(set: Set<() => void>) {
  set.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallEvent;
    emit(installListeners);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit(installListeners);
  });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const track = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // A new version finished downloading while an older one controls the page
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = worker;
            updateReady = true;
            emit(updateListeners);
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        updateReady = true;
        emit(updateListeners);
      }
      reg.addEventListener('updatefound', () => track(reg.installing));
      // Check for a new version whenever the app is reopened
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  });

  // Reload only when a new version replaces an existing one (not on first install)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function canPromptInstall() {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  emit(installListeners);
  return outcome === 'accepted';
}

export function onInstallAvailabilityChange(fn: () => void) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

export function isUpdateReady() {
  return updateReady;
}

export function onUpdateReady(fn: () => void) {
  updateListeners.add(fn);
  return () => updateListeners.delete(fn);
}

/** Activates the downloaded version; the page reloads on controllerchange. */
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  // Never leave anyone stuck: if the new version doesn't take over quickly, reload anyway
  setTimeout(() => window.location.reload(), waitingWorker ? 4000 : 0);
}
