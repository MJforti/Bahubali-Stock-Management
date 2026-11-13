/**
 * Low stock alerts on this phone: web push, so they arrive even when the
 * app is closed. The server decides when stock is low and sends the alert.
 */
import { supabase } from './sync';
import { getActor } from './activity';
import { isIos, isStandalone } from '../pwa';

const VAPID_PUBLIC_KEY = 'BKgPhg7fqYaCOUTlJ1kWkaMTDBvjfnIfzCRcW-sl2B_-52psJcI_Co1_BTUmhsObOTK6aQ8v_iCglvNdDudaSNs';

export type AlertsState = 'on' | 'off' | 'blocked' | 'needs-install' | 'unsupported';

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function deviceName() {
  const ua = navigator.userAgent;
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Device';
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : '';
  return `${os}${browser ? ` · ${browser}` : ''}`;
}

export async function alertsState(): Promise<AlertsState> {
  // iPhones only allow notifications for apps added to the home screen
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const { error } = await supabase.rpc('subscribe_push', { sub: sub.toJSON(), person: getActor().user, device: deviceName() });
  if (error) throw new Error('Could not turn alerts on. Check the internet connection and try again');
}

export async function turnAlertsOn(): Promise<void> {
  if (!supported()) throw new Error('This browser cannot show alerts');
  if (!navigator.onLine) throw new Error('Connect to the internet to turn alerts on');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for this app in the phone settings');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await save(sub);
}

export async function turnAlertsOff(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('unsubscribe_push', { endpoint_url: sub.endpoint });
  await sub.unsubscribe();
}

/** Keeps the server's copy fresh (name changes, renewed subscriptions). */
export async function refreshAlerts() {
  try {
    if ((await alertsState()) !== 'on') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch {
    /* offline: try next time */
  }
}
