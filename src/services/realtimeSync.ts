import { LocalChange, onOtherTabChange } from '../lib/localDb';

/**
 * Offline mode: keeps other open tabs/windows of the app on this device in
 * sync, and reloads from the local database when the app regains focus.
 */
export function setupRealtimeSync(onChange: (change: LocalChange) => void) {
  const unsubscribe = onOtherTabChange(onChange);
  const handleVisible = () => {
    if (document.visibilityState === 'visible') onChange({ kind: 'reload' });
  };
  document.addEventListener('visibilitychange', handleVisible);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', handleVisible);
  };
}
