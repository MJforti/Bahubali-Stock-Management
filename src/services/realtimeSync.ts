import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Product, StockTransaction, RealtimeStatus } from '../types/inventory';

type SyncCallback = (event: string, payload?: any) => void;

let globalRealtimeChannel: RealtimeChannel | null = null;

export function setupRealtimeSync(
  onSync: SyncCallback,
  onStatusChange: (status: RealtimeStatus) => void
) {
  if (!supabase) {
    onStatusChange('local_demo');
    return () => {};
  }

  const client = supabase;

  // Cleanup existing channel if re-subscribing
  if (globalRealtimeChannel) {
    try {
      client.removeChannel(globalRealtimeChannel);
    } catch (e) {
      // ignore
    }
  }

  try {
    globalRealtimeChannel = client
      .channel('bahubali_central_sync_v3', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('⚡ CDC Postgres Event (products):', payload);
          onSync('PRODUCTS_CDC', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_transactions' },
        (payload) => {
          console.log('⚡ CDC Postgres Event (stock_transactions):', payload);
          onSync('TRANSACTIONS_CDC', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_versions' },
        (payload) => {
          console.log('⚡ CDC Postgres Event (inventory_versions):', payload);
          onSync('VERSION_CDC', payload);
        }
      )
      .on(
        'broadcast',
        { event: 'GLOBAL_INVENTORY_UPDATE' },
        (payload) => {
          console.log('⚡ Supabase Cloud Broadcast Received:', payload);
          onSync('BROADCAST_SYNC', payload);
        }
      )
      .subscribe((status) => {
        console.log('🌐 Supabase Realtime Channel Connection Status:', status);
        if (status === 'SUBSCRIBED') {
          onStatusChange('connected');
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatusChange('reconnecting');
        } else {
          onStatusChange('local_demo');
        }
      });
  } catch (err) {
    console.error('Failed to setup Realtime channel:', err);
    onStatusChange('reconnecting');
  }

  return () => {
    if (globalRealtimeChannel) {
      try {
        client.removeChannel(globalRealtimeChannel);
        globalRealtimeChannel = null;
      } catch (e) {
        // ignore
      }
    }
  };
}

export function broadcastGlobalSync(eventType = 'PUBLISH_RELEASE', extraData = {}) {
  if (globalRealtimeChannel) {
    try {
      globalRealtimeChannel.send({
        type: 'broadcast',
        event: 'GLOBAL_INVENTORY_UPDATE',
        payload: {
          event: eventType,
          timestamp: Date.now(),
          ...extraData
        }
      });
    } catch (err) {
      console.warn('Failed to broadcast global sync message:', err);
    }
  }
}
