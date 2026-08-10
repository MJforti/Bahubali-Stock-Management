import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'bahubali_supabase_url';
const STORAGE_KEY_KEY = 'bahubali_supabase_anon_key';

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const savedUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_URL) || '') : '';
  const savedKey = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_KEY) || '') : '';

  const finalUrl = (envUrl && envUrl.startsWith('http')) ? envUrl : savedUrl;
  const finalKey = envKey ? envKey : savedKey;
  
  return {
    url: finalUrl,
    key: finalKey,
    isConfigured: Boolean(finalUrl && finalKey && finalUrl.startsWith('http'))
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

export const supabase: SupabaseClient | null = config.isConfigured
  ? createClient(config.url, config.key, {
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    })
  : null;

// Multi-tab local broadcast channel for offline/demo mode real-time sync
export const localBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('bahubali_inventory_sync')
  : null;

let activeBroadcastChannel: RealtimeChannel | null = null;

export function getActiveBroadcastChannel(): RealtimeChannel | null {
  if (supabase && !activeBroadcastChannel) {
    try {
      activeBroadcastChannel = supabase.channel('bahubali_global_sync');
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
