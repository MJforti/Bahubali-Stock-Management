import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'bahubali_supabase_url';
const STORAGE_KEY_KEY = 'bahubali_supabase_anon_key';

const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmhubm5yamNrY3FqdmdvZ3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMjk1OTMsImV4cCI6MjEwMTkwNTU5M30.MNINRwl702gdd7Zcv_6mmaLNqLsu0uOGB0GXpdbwBws';

/**
 * Reads the Supabase project ref embedded in an anon key (JWT payload `ref`).
 * The anon key is only accepted by the project it was issued for, so the
 * project URL must match this ref.
 */
function getProjectRefFromKey(key: string): string | null {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.ref === 'string' ? json.ref : null;
  } catch {
    return null;
  }
}

function urlForRef(ref: string) {
  return `https://${ref}.supabase.co`;
}

export function getStoredSupabaseConfig() {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // Purge legacy custom config stored in browser localStorage (no longer used)
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
    } catch {
      // ignore
    }
  }

  const finalKey = envKey.length > 20 ? envKey : DEFAULT_SUPABASE_ANON_KEY;
  const keyRef = getProjectRefFromKey(finalKey);

  let finalUrl = envUrl.startsWith('http') ? envUrl.replace(/\/+$/, '') : '';

  // A *.supabase.co URL whose project ref differs from the key's ref can never
  // authenticate (this was the cause of every request failing). Trust the key.
  if (keyRef) {
    const isSupabaseHost = !finalUrl || /\.supabase\.co$/i.test(new URL(finalUrl).hostname);
    if (isSupabaseHost && !finalUrl.includes(`//${keyRef}.`)) {
      if (finalUrl) {
        console.warn(`Supabase URL ${finalUrl} does not match anon key project "${keyRef}". Using ${urlForRef(keyRef)}.`);
      }
      finalUrl = urlForRef(keyRef);
    }
  }

  return {
    url: finalUrl,
    key: finalKey,
    isConfigured: Boolean(finalUrl && finalKey)
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  window.location.reload();
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  window.location.reload();
}

const config = getStoredSupabaseConfig();

export const supabase: SupabaseClient = createClient(config.url, config.key, {
  realtime: {
    params: {
      eventsPerSecond: 20
    }
  }
});

// Multi-tab local broadcast channel for offline/demo mode real-time sync
export const localBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('bahubali_inventory_sync')
  : null;

let activeBroadcastChannel: RealtimeChannel | null = null;

export function getActiveBroadcastChannel(): RealtimeChannel | null {
  if (supabase && !activeBroadcastChannel) {
    try {
      activeBroadcastChannel = supabase.channel('bahubali_global_sync', {
        config: {
          broadcast: { self: true }
        }
      });
      activeBroadcastChannel.subscribe();
    } catch (err) {
      console.warn('Failed to subscribe to Supabase broadcast channel:', err);
    }
  }
  return activeBroadcastChannel;
}

export function sendRealtimeBroadcast(eventType: string, payload: any) {
  try {
    const channel = getActiveBroadcastChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: eventType,
        payload
      });
    }
  } catch (err) {
    console.warn('Supabase broadcast send error:', err);
  }

  try {
    if (localBroadcastChannel) {
      localBroadcastChannel.postMessage({ type: eventType, payload });
    }
  } catch (err) {
    console.warn('Local broadcast send error:', err);
  }
}

export async function verifyAdminPasscode(inputCode: string): Promise<boolean> {
  const code = inputCode.trim();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('verify_admin_code', { input_code: code });
      if (!error && typeof data === 'boolean') {
        return data;
      }
    } catch (err) {
      console.warn('RPC verify_admin_code error:', err);
    }
  }

  // Fallback verification for demo / standard admin code (9988 or 1234)
  return code === '9988' || code === '1234';
}
