-- Transfers between stores: a stock out from one store and a stock in to
-- another, recorded together and linked by the same transfer_id.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS transfer_id uuid;
COMMENT ON COLUMN stock_movements.transfer_id IS 'Same id on the OUT and IN rows of a transfer between stores.';
CREATE INDEX IF NOT EXISTS movements_transfer_idx ON stock_movements (transfer_id) WHERE transfer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_movements(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb;
  n integer := 0;
  touched uuid[] := '{}';
  pid uuid;
  sid uuid;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 1000 THEN
    RAISE EXCEPTION 'Expected up to 1000 movements';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (m->>'product_id')::uuid;
    sid := COALESCE((m->>'store_id')::uuid, '00000000-0000-4000-8000-000000000001');
    INSERT INTO stores (id, name, changed_at) VALUES (sid, 'Store', 'epoch') ON CONFLICT (id) DO NOTHING;
    INSERT INTO stock_movements (id, product_id, store_id, transfer_id, product_name, movement, quantity, stock_before, stock_after,
      counted_stock, reason, reference, done_by, done_at)
    VALUES ((m->>'id')::uuid, pid, sid, (m->>'transfer_id')::uuid, left(COALESCE(m->>'product_name', ''), 200), m->>'movement',
      abs(COALESCE((m->>'quantity')::numeric, 0)), COALESCE((m->>'stock_before')::numeric, 0), COALESCE((m->>'stock_after')::numeric, 0),
      CASE WHEN m->>'movement' = 'ADJUSTMENT' THEN (m->>'stock_after')::numeric END,
      left(COALESCE(m->>'reason', ''), 300), left(COALESCE(m->>'reference', ''), 100),
      left(COALESCE(m->>'done_by', ''), 60), (m->>'done_at')::timestamptz)
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN n := n + 1; touched := array_append(touched, pid); END IF;
  END LOOP;
  FOR pid IN SELECT DISTINCT unnest(touched) LOOP
    PERFORM recalc_product_stock(pid);
  END LOOP;
  RETURN n;
END $$;

DROP VIEW IF EXISTS movement_history;
CREATE VIEW movement_history WITH (security_invoker = true) AS
SELECT
  m.done_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
  m.done_by                            AS person,
  st.name                              AS store,
  CASE
    WHEN m.transfer_id IS NOT NULL AND m.movement = 'OUT' THEN 'Transfer to ' || COALESCE(other_st.name, 'another store')
    WHEN m.transfer_id IS NOT NULL AND m.movement = 'IN' THEN 'Transfer from ' || COALESCE(other_st.name, 'another store')
    WHEN m.movement = 'IN' THEN 'Stock in'
    WHEN m.movement = 'OUT' THEN 'Stock out'
    ELSE 'Count corrected'
  END                                  AS movement,
  COALESCE(p.name, m.product_name)     AS product,
  m.quantity,
  m.stock_before,
  m.stock_after,
  NULLIF(m.reason, '')                 AS reason,
  NULLIF(m.reference, '')              AS reference
FROM stock_movements m
LEFT JOIN products p ON p.id = m.product_id
LEFT JOIN stores st ON st.id = m.store_id
LEFT JOIN stock_movements other ON m.transfer_id IS NOT NULL AND other.transfer_id = m.transfer_id AND other.id <> m.id
LEFT JOIN stores other_st ON other_st.id = other.store_id
ORDER BY m.done_at DESC;
GRANT SELECT ON movement_history TO anon, authenticated;
