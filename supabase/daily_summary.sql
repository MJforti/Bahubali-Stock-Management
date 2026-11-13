-- Daily stock summary notification, 8 PM India time, to phones with alerts on
-- (each phone can turn just the summary off).
CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS daily_summary boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION set_daily_summary(endpoint_url text, turn_on boolean) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE push_subscriptions SET daily_summary = turn_on WHERE endpoint = endpoint_url RETURNING true;
$$;
CREATE OR REPLACE FUNCTION daily_summary_setting(endpoint_url text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT daily_summary FROM push_subscriptions WHERE endpoint = endpoint_url;
$$;
GRANT EXECUTE ON FUNCTION set_daily_summary(text, boolean), daily_summary_setting(text) TO anon, authenticated;

-- Today's figures (India date). Transfers between stores are not counted as in/out.
CREATE OR REPLACE FUNCTION daily_stock_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH today AS (
    SELECT * FROM stock_movements
    WHERE (done_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
  ),
  levels AS (
    SELECT p.id, p.name,
           bool_or((s.value)::numeric <= 0) AS out_somewhere,
           bool_or((s.value)::numeric <= p.minimum_stock) AS low_somewhere
    FROM products p, jsonb_each_text(COALESCE(p.stock_by_store, '{}'::jsonb)) s
    JOIN stores st ON st.id::text = s.key AND st.is_active
    WHERE p.is_active
    GROUP BY p.id, p.name
  )
  SELECT jsonb_build_object(
    'moves',     (SELECT count(*) FROM today WHERE transfer_id IS NULL),
    'in_qty',    (SELECT COALESCE(sum(quantity), 0) FROM today WHERE movement = 'IN' AND transfer_id IS NULL),
    'out_qty',   (SELECT COALESCE(sum(quantity), 0) FROM today WHERE movement = 'OUT' AND transfer_id IS NULL),
    'transfers', (SELECT count(DISTINCT transfer_id) FROM today WHERE transfer_id IS NOT NULL),
    'out_count', (SELECT count(*) FROM levels WHERE out_somewhere),
    'low_count', (SELECT count(*) FROM levels WHERE low_somewhere AND NOT out_somewhere),
    'reorder',   (SELECT COALESCE(jsonb_agg(name ORDER BY out_somewhere DESC, name), '[]'::jsonb)
                  FROM (SELECT name, out_somewhere FROM levels WHERE low_somewhere ORDER BY out_somewhere DESC, name LIMIT 3) x)
  );
$$;
REVOKE ALL ON FUNCTION daily_stock_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION daily_stock_summary() TO service_role;

-- 14:30 UTC = 8:00 PM IST
SELECT cron.unschedule('daily-stock-summary') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-stock-summary');
SELECT cron.schedule('daily-stock-summary', '30 14 * * *', $$
  SELECT net.http_post(
    url := 'https://bpbhnnnrjckcqjvgogsu.supabase.co/functions/v1/send-stock-alerts',
    body := '{"summary": true}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
$$);
