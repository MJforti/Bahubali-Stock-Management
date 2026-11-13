-- Daily summaries, stored. Only the 8 PM job creates one; the push function
-- just delivers summaries already stored (so nobody else can trigger one).
CREATE TABLE IF NOT EXISTS daily_summaries (
  day        date PRIMARY KEY,
  data       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz,
  sent_to    integer
);
COMMENT ON TABLE daily_summaries IS 'One row per day (India date): stock in/out per store where stock moved, and what needs restocking.';
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App can read summaries" ON daily_summaries;
CREATE POLICY "App can read summaries" ON daily_summaries FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON daily_summaries FROM anon, authenticated;
GRANT SELECT ON daily_summaries TO anon, authenticated;

-- One day's figures for every active store where stock moved that day
CREATE OR REPLACE FUNCTION build_daily_summary(d date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mv AS (
    SELECT m.*, p.name AS product, p.unit
    FROM stock_movements m JOIN products p ON p.id = m.product_id
    WHERE (m.done_at AT TIME ZONE 'Asia/Kolkata')::date = d
  ),
  per_store AS (
    SELECT s.id, s.name,
      count(*) FILTER (WHERE mv.transfer_id IS NULL) AS moves,
      COALESCE(sum(mv.quantity) FILTER (WHERE mv.movement = 'IN'  AND mv.transfer_id IS NULL), 0) AS qty_in,
      COALESCE(sum(mv.quantity) FILTER (WHERE mv.movement = 'OUT' AND mv.transfer_id IS NULL), 0) AS qty_out,
      COALESCE(sum(mv.quantity) FILTER (WHERE mv.movement = 'IN'  AND mv.transfer_id IS NOT NULL), 0) AS moved_in,
      COALESCE(sum(mv.quantity) FILTER (WHERE mv.movement = 'OUT' AND mv.transfer_id IS NOT NULL), 0) AS moved_out,
      count(*) FILTER (WHERE mv.movement = 'ADJUSTMENT') AS corrections
    FROM mv JOIN stores s ON s.id = mv.store_id AND s.is_active
    GROUP BY s.id, s.name
  ),
  top_out AS (
    SELECT store_id, jsonb_agg(jsonb_build_object('product', product, 'qty', qty, 'unit', unit) ORDER BY qty DESC) AS items
    FROM (
      SELECT store_id, product, unit, sum(quantity) AS qty,
             row_number() OVER (PARTITION BY store_id ORDER BY sum(quantity) DESC) AS rn
      FROM mv WHERE movement = 'OUT' AND transfer_id IS NULL GROUP BY store_id, product, unit
    ) t WHERE rn <= 3 GROUP BY store_id
  ),
  restock AS (
    SELECT st.id AS store_id,
      jsonb_agg(p.name ORDER BY (s.value)::numeric <= 0 DESC, p.name) FILTER (WHERE (s.value)::numeric <= p.minimum_stock) AS names,
      count(*) FILTER (WHERE (s.value)::numeric <= 0) AS out_count,
      count(*) FILTER (WHERE (s.value)::numeric > 0 AND (s.value)::numeric <= p.minimum_stock) AS low_count
    FROM products p, jsonb_each_text(COALESCE(p.stock_by_store, '{}'::jsonb)) s
    JOIN stores st ON st.id::text = s.key AND st.is_active
    WHERE p.is_active
    GROUP BY st.id
  )
  SELECT jsonb_build_object(
    'day', d,
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store', ps.name, 'moves', ps.moves, 'in', ps.qty_in, 'out', ps.qty_out,
        'moved_in', ps.moved_in, 'moved_out', ps.moved_out, 'corrections', ps.corrections,
        'top_out', COALESCE(t.items, '[]'::jsonb),
        'out_of_stock', COALESCE(r.out_count, 0), 'low', COALESCE(r.low_count, 0),
        'restock', COALESCE(r.names, '[]'::jsonb)
      ) ORDER BY ps.name)
      FROM per_store ps LEFT JOIN top_out t ON t.store_id = ps.id LEFT JOIN restock r ON r.store_id = ps.id
    ), '[]'::jsonb),
    'total_in',  (SELECT COALESCE(sum(quantity), 0) FROM mv WHERE movement = 'IN'  AND transfer_id IS NULL),
    'total_out', (SELECT COALESCE(sum(quantity), 0) FROM mv WHERE movement = 'OUT' AND transfer_id IS NULL),
    'restock_out', (SELECT COALESCE(sum(out_count), 0) FROM restock),
    'restock_low', (SELECT COALESCE(sum(low_count), 0) FROM restock)
  );
$$;

-- Called by the 8 PM job only
CREATE OR REPLACE FUNCTION run_daily_summary() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- A summary saved earlier today (e.g. a test) is replaced by the 8 PM one
  DELETE FROM daily_summaries WHERE day = today;
  INSERT INTO daily_summaries (day, data) VALUES (today, build_daily_summary(today));
END $$;

-- Push function: take today's summary if not yet sent (exactly once)
CREATE OR REPLACE FUNCTION claim_daily_summary() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE daily_summaries SET sent_at = now()
  WHERE sent_at IS NULL AND created_at > now() - interval '6 hours'
  RETURNING data;
$$;
CREATE OR REPLACE FUNCTION record_summary_sent(d date, phones integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE daily_summaries SET sent_to = phones WHERE day = d;
$$;

REVOKE ALL ON FUNCTION build_daily_summary(date), run_daily_summary(), claim_daily_summary(), record_summary_sent(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_daily_summary(), record_summary_sent(date, integer) TO service_role;
DROP FUNCTION IF EXISTS daily_stock_summary();

CREATE OR REPLACE FUNCTION notify_daily_summary() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://bpbhnnnrjckcqjvgogsu.supabase.co/functions/v1/send-stock-alerts',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS daily_summaries_notify ON daily_summaries;
CREATE TRIGGER daily_summaries_notify AFTER INSERT ON daily_summaries FOR EACH STATEMENT EXECUTE FUNCTION notify_daily_summary();

-- 14:30 UTC = 8:00 PM IST
SELECT cron.unschedule('daily-stock-summary') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-stock-summary');
SELECT cron.schedule('daily-stock-summary', '30 14 * * *', 'SELECT public.run_daily_summary()');
