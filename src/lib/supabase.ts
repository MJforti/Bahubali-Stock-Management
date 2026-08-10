import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'bahubali_supabase_url';
const STORAGE_KEY_KEY = 'bahubali_supabase_anon_key';

const DEFAULT_SUPABASE_URL = 'https://bpbhnnnrjckcqjvgosu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmhubm5yamNrY3FqdmdvZ3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMjk1OTMsImV4cCI6MjEwMTkwNTU5M30.MNINRwl702gdd7Zcv_6mmaLNqLsu0uOGB0GXpdbwBws';

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Purge any legacy broken custom URLs stored in mobile browser localStorage
  if (typeof window !== 'undefined') {
    try {
      const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
      if (savedUrl && !savedUrl.startsWith('https://bpbhnnnrjckcqjvgosu.supabase.co')) {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_KEY);
      }
    } catch (e) {
      // ignore
    }
  }
  
  const finalUrl = (envUrl && envUrl.startsWith('http')) ? envUrl : DEFAULT_SUPABASE_URL;
  const finalKey = (envKey && envKey.length > 20) ? envKey : DEFAULT_SUPABASE_ANON_KEY;
  
  return {
    url: finalUrl,
    key: finalKey,
    isConfigured: true
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
