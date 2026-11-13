-- Low stock alerts sent as phone notifications.
-- When a product's stock in a store drops to its minimum (low) or to zero
-- (out), one alert is recorded. A trigger asks the send-stock-alerts edge
-- function to deliver it to every phone that turned alerts on.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS stock_alerts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id   uuid NOT NULL REFERENCES products(id),
  store_id     uuid NOT NULL REFERENCES stores(id),
  level        text NOT NULL CHECK (level IN ('low', 'out')),
  stock        numeric(12,2) NOT NULL,
  minimum      numeric(12,2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  sent_to      integer
);
COMMENT ON TABLE stock_alerts IS 'One row each time a product drops to low or out of stock in a store. sent_to = phones notified.';
CREATE INDEX IF NOT EXISTS stock_alerts_unsent_idx ON stock_alerts (id) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint     text PRIMARY KEY,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  person       text NOT NULL DEFAULT '',
  device       text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);
COMMENT ON TABLE push_subscriptions IS 'Phones that turned on low stock alerts. Private: only the push function reads it.';

ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App can read alerts" ON stock_alerts;
CREATE POLICY "App can read alerts" ON stock_alerts FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON push_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON stock_alerts FROM anon, authenticated;
GRANT SELECT ON stock_alerts TO anon, authenticated;

-- Phones turn alerts on/off through these (they can't read the list)
CREATE OR REPLACE FUNCTION subscribe_push(sub jsonb, person text DEFAULT '', device text DEFAULT '') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(sub->>'endpoint', '') !~ '^https://' OR length(sub->>'endpoint') > 1000
     OR COALESCE(sub->'keys'->>'p256dh', '') = '' OR COALESCE(sub->'keys'->>'auth', '') = '' THEN
    RAISE EXCEPTION 'Not a valid push subscription';
  END IF;
  INSERT INTO push_subscriptions (endpoint, p256dh, auth, person, device)
  VALUES (sub->>'endpoint', left(sub->'keys'->>'p256dh', 200), left(sub->'keys'->>'auth', 100), left(COALESCE(person, ''), 60), left(COALESCE(device, ''), 120))
  ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, person = EXCLUDED.person, device = EXCLUDED.device;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION unsubscribe_push(endpoint_url text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM push_subscriptions WHERE endpoint = endpoint_url RETURNING true;
$$;

GRANT EXECUTE ON FUNCTION subscribe_push(jsonb, text, text), unsubscribe_push(text) TO anon, authenticated;

-- Used only by the push function (service role): claim unsent alerts exactly once
CREATE OR REPLACE FUNCTION claim_stock_alerts() RETURNS TABLE (id bigint, level text, stock numeric, minimum numeric, unit text, product text, brand text, rack text, store text, store_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE stock_alerts a SET sent_at = now()
    WHERE a.sent_at IS NULL AND a.created_at > now() - interval '1 day'
    RETURNING a.*
  )
  SELECT c.id, c.level, c.stock, c.minimum, p.unit, p.name, p.brand, p.rack, s.name,
         (SELECT count(*)::integer FROM stores WHERE is_active)
  FROM claimed c JOIN products p ON p.id = c.product_id JOIN stores s ON s.id = c.store_id
  ORDER BY c.level DESC, p.name;
END $$;

CREATE OR REPLACE FUNCTION record_alerts_sent(ids bigint[], phones integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE stock_alerts SET sent_to = phones WHERE id = ANY(ids);
$$;

-- VAPID keys for web push live in Vault; only the push function can read them
CREATE OR REPLACE FUNCTION push_config() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_object_agg(name, decrypted_secret) FROM vault.decrypted_secrets
  WHERE name IN ('vapid_public_key', 'vapid_private_key', 'vapid_subject');
$$;

REVOKE ALL ON FUNCTION claim_stock_alerts(), record_alerts_sent(bigint[], integer), push_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_stock_alerts(), record_alerts_sent(bigint[], integer), push_config() TO service_role;

-- Ask the push function to send (fire and forget)
CREATE OR REPLACE FUNCTION notify_stock_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://bpbhnnnrjckcqjvgogsu.supabase.co/functions/v1/send-stock-alerts',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS stock_alerts_notify ON stock_alerts;
CREATE TRIGGER stock_alerts_notify AFTER INSERT ON stock_alerts FOR EACH STATEMENT EXECUTE FUNCTION notify_stock_alert();

-- Stock replay (as before) + record an alert when a store's stock crosses into low or out
CREATE OR REPLACE FUNCTION recalc_product_stock(p_product_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  openings jsonb;
  old_by_store jsonb;
  min_stock numeric;
  active boolean;
  by_store jsonb := '{}'::jsonb;
  m record;
  before numeric;
  after numeric;
  last_at timestamptz;
  total numeric := 0;
  k text;
  old_level text;
  new_level text;
BEGIN
  SELECT opening_by_store, stock_by_store, minimum_stock, is_active INTO openings, old_by_store, min_stock, active
  FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  by_store := COALESCE(openings, '{}'::jsonb);
  FOR m IN SELECT * FROM stock_movements WHERE product_id = p_product_id ORDER BY done_at, id LOOP
    before := COALESCE((by_store->>m.store_id::text)::numeric, 0);
    IF m.movement = 'IN' THEN after := before + m.quantity;
    ELSIF m.movement = 'OUT' THEN after := before - m.quantity;
    ELSE after := COALESCE(m.counted_stock, m.stock_after);
    END IF;
    IF m.stock_before IS DISTINCT FROM before OR m.stock_after IS DISTINCT FROM after
       OR (m.movement = 'ADJUSTMENT' AND m.quantity IS DISTINCT FROM abs(after - before)) THEN
      UPDATE stock_movements
        SET stock_before = before, stock_after = after,
            quantity = CASE WHEN m.movement = 'ADJUSTMENT' THEN abs(after - before) ELSE quantity END
        WHERE id = m.id;
    END IF;
    by_store := jsonb_set(by_store, ARRAY[m.store_id::text], to_jsonb(after));
    last_at := m.done_at;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(by_store) LOOP
    total := total + COALESCE((by_store->>k)::numeric, 0);
    -- Alert only when a store we already tracked crosses into a worse level
    IF active AND old_by_store ? k THEN
      old_level := CASE WHEN (old_by_store->>k)::numeric <= 0 THEN 'out' WHEN (old_by_store->>k)::numeric <= min_stock THEN 'low' ELSE 'ok' END;
      new_level := CASE WHEN (by_store->>k)::numeric <= 0 THEN 'out' WHEN (by_store->>k)::numeric <= min_stock THEN 'low' ELSE 'ok' END;
      IF (new_level = 'out' AND old_level <> 'out') OR (new_level = 'low' AND old_level = 'ok') THEN
        INSERT INTO stores (id, name, changed_at) VALUES (k::uuid, 'Store', 'epoch') ON CONFLICT (id) DO NOTHING;
        INSERT INTO stock_alerts (product_id, store_id, level, stock, minimum)
        VALUES (p_product_id, k::uuid, new_level, (by_store->>k)::numeric, min_stock);
      END IF;
    END IF;
  END LOOP;
  UPDATE products
    SET current_stock = total, stock_by_store = by_store,
        opening_stock = (SELECT COALESCE(sum(value::numeric), 0) FROM jsonb_each_text(COALESCE(openings, '{}'::jsonb))),
        stock_updated_at = COALESCE(last_at, stock_updated_at)
    WHERE id = p_product_id
      AND (current_stock IS DISTINCT FROM total OR stock_by_store IS DISTINCT FROM by_store
           OR stock_updated_at IS DISTINCT FROM COALESCE(last_at, stock_updated_at)
           OR opening_stock IS DISTINCT FROM (SELECT COALESCE(sum(value::numeric), 0) FROM jsonb_each_text(COALESCE(openings, '{}'::jsonb))));
END $$;
REVOKE ALL ON FUNCTION recalc_product_stock(uuid) FROM PUBLIC, anon, authenticated;

-- Readable list of alerts
CREATE OR REPLACE VIEW alert_history WITH (security_invoker = true) AS
SELECT a.created_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
       CASE a.level WHEN 'out' THEN 'Out of stock' ELSE 'Low stock' END AS alert,
       p.name AS product, s.name AS store, a.stock AS in_stock, p.unit, a.minimum,
       a.sent_to AS phones_notified
FROM stock_alerts a JOIN products p ON p.id = a.product_id JOIN stores s ON s.id = a.store_id
ORDER BY a.created_at DESC;
GRANT SELECT ON alert_history TO anon, authenticated;
