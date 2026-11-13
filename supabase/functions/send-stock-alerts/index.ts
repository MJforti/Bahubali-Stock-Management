// Sends low / out of stock alerts as phone notifications (web push).
// Called by the database (trigger on stock_alerts) whenever an alert is
// recorded, when the 8 PM job stores the daily summary, and by the app's
// "Send test alert" button.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.48.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
});

interface Alert {
  id: number;
  level: 'low' | 'out';
  stock: number;
  minimum: number;
  unit: string;
  product: string;
  brand: string;
  rack: string;
  store: string;
  store_count: number;
}

const qty = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function message(alerts: Alert[]) {
  const where = (a: Alert) => (a.store_count > 1 ? `${a.store}: ` : '');
  if (alerts.length === 1) {
    const a = alerts[0];
    return {
      title: `${a.level === 'out' ? 'Out of stock' : 'Low stock'} · ${a.product}`,
      body:
        a.level === 'out'
          ? `${where(a)}none left (minimum ${qty(a.minimum)})${a.rack ? ` · Rack ${a.rack}` : ''}`
          : `${where(a)}${qty(a.stock)} ${a.unit} left (minimum ${qty(a.minimum)})${a.rack ? ` · Rack ${a.rack}` : ''}`,
      tag: `stock-${a.product}-${a.store}`
    };
  }
  const out = alerts.filter((a) => a.level === 'out').length;
  const lines = alerts.slice(0, 4).map((a) => `${a.product}${a.store_count > 1 ? ` (${a.store})` : ''}: ${a.level === 'out' ? 'none left' : `${qty(a.stock)} left`}`);
  if (alerts.length > 4) lines.push(`and ${alerts.length - 4} more`);
  return {
    title: `${alerts.length} products need restocking${out ? ` · ${out} out of stock` : ''}`,
    body: lines.join('\n'),
    tag: 'stock-summary'
  };
}

interface StoreDay {
  store: string;
  in: number;
  out: number;
  moved_in: number;
  moved_out: number;
}
interface Summary {
  day: string;
  stores: StoreDay[];
  restock_out: number;
  restock_low: number;
}

// Crisp: one line per store that moved, one line for restocking
function summaryMessage(d: Summary & { stores: (StoreDay & { restock: string[] })[] }) {
  const date = new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const lines = d.stores.map((s) => {
    const moved = s.moved_in || s.moved_out ? ` · moved +${qty(s.moved_in)}/-${qty(s.moved_out)}` : '';
    return `${s.store}: +${qty(s.in)} in, -${qty(s.out)} out${moved}`;
  });
  if (!lines.length) lines.push('No stock moved today');
  const need = Number(d.restock_out) + Number(d.restock_low);
  if (need) {
    const names = [...new Set(d.stores.flatMap((s) => s.restock ?? []))].slice(0, 2);
    const more = need > names.length ? ` +${need - names.length}` : '';
    lines.push(`Restock ${need}${names.length ? `: ${names.join(', ')}${more}` : ''}`);
  } else lines.push('Nothing to restock');
  return { title: `Stock today · ${date}`, body: lines.join('\n'), tag: 'daily-summary', url: '/' };
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { data: cfg, error: cfgErr } = await supabase.rpc('push_config');
    if (cfgErr || !cfg?.vapid_private_key) throw new Error(`Push keys missing: ${cfgErr?.message ?? 'not set'}`);
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public_key, cfg.vapid_private_key);

    // Test from the app: only to a phone that is already registered
    const input = await req.json().catch(() => ({}));
    if (input?.test && typeof input.endpoint === 'string') {
      const { data: s } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('endpoint', input.endpoint).maybeSingle();
      if (!s) return Response.json({ ok: false, error: 'This phone is not registered for alerts' }, { headers: cors });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: 'Test alert', body: 'Low stock alerts are working on this phone', tag: 'stock-test', url: '/' }), { TTL: 600, urgency: 'high' });
        return Response.json({ ok: true }, { headers: cors });
      } catch (err: any) {
        console.error('test push failed', err?.statusCode, err?.body ?? String(err));
        return Response.json({ ok: false, error: `The phone's push service refused it (${err?.statusCode ?? 'no reply'}). Turn alerts off and on again` }, { headers: cors });
      }
    }

    // Today's summary, only if the 8 PM job stored one that is not sent yet
    const { data: summary, error: sumErr } = await supabase.rpc('claim_daily_summary');
    if (sumErr) console.error('claim summary', sumErr);
    if (summary) {
      const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('daily_summary', true);
      const payload = JSON.stringify(summaryMessage(summary));
      const gone: string[] = [];
      let delivered = 0;
      await Promise.all(
        (subs ?? []).map((s) =>
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
            .then(() => delivered++)
            .catch((err: any) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(s.endpoint);
              else console.error('summary push failed', err?.statusCode, err?.body ?? String(err));
            })
        )
      );
      if (gone.length) await supabase.from('push_subscriptions').delete().in('endpoint', gone);
      await supabase.rpc('record_summary_sent', { d: summary.day, phones: delivered });
    }

    const { data: alerts, error } = await supabase.rpc('claim_stock_alerts');
    if (error) throw error;
    if (!alerts?.length) return Response.json({ sent: 0, alerts: 0 });

    const { data: subs, error: subErr } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
    if (subErr) throw subErr;

    const payload = JSON.stringify({ ...message(alerts as Alert[]), url: '/' });
    const ok: string[] = [];
    const gone: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 24,
            urgency: 'high'
          });
          ok.push(s.endpoint);
        } catch (err: any) {
          // The phone turned alerts off or the app was removed: forget it
          if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(s.endpoint);
          else console.error('push failed', err?.statusCode, err?.body ?? String(err));
        }
      })
    );
    if (gone.length) await supabase.from('push_subscriptions').delete().in('endpoint', gone);
    await supabase.rpc('record_alerts_sent', { ids: (alerts as Alert[]).map((a) => a.id), phones: ok.length });
    const delivered = ok.length;
    if (delivered) await supabase.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).in('endpoint', ok);
    return Response.json({ alerts: alerts.length, phones: subs?.length ?? 0, delivered, removed: gone.length });
  } catch (err: any) {
    console.error('send-stock-alerts', err);
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
});
