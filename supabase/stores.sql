-- Multiple stores (shops / godowns). Products are one shared list; stock is
-- kept per store. Movements say which store they happened in. Phones on an
-- older app version send no store: those go to Main Store.

CREATE TABLE IF NOT EXISTS stores (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  changed_at  timestamptz NOT NULL,
  sync_seq    bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE stores IS 'Shops and godowns. Removed stores stay with is_active = false so their history keeps a name.';

INSERT INTO stores (id, name, sort_order, changed_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Main Store', 0, 'epoch')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS stores_sync_seq ON stores;
CREATE TRIGGER stores_sync_seq BEFORE INSERT OR UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION stamp_sync_seq();
CREATE INDEX IF NOT EXISTS stores_sync_idx ON stores (sync_seq);

ALTER TABLE products ADD COLUMN IF NOT EXISTS opening_by_store jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_by_store jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN products.opening_by_store IS 'Opening stock per store id. Movements are replayed from here, per store.';
COMMENT ON COLUMN products.stock_by_store IS 'Current stock per store id (recalculated). current_stock is the total.';
UPDATE products SET opening_by_store = jsonb_build_object('00000000-0000-4000-8000-000000000001', opening_stock)
WHERE opening_by_store = '{}'::jsonb;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
UPDATE stock_movements SET store_id = '00000000-0000-4000-8000-000000000001' WHERE store_id IS NULL;
ALTER TABLE stock_movements ALTER COLUMN store_id SET DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE stock_movements ALTER COLUMN store_id SET NOT NULL;
DROP INDEX IF EXISTS movements_product_idx;
CREATE INDEX IF NOT EXISTS movements_product_store_idx ON stock_movements (product_id, store_id, done_at, id);
CREATE INDEX IF NOT EXISTS movements_store_idx ON stock_movements (store_id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App can read stores" ON stores;
CREATE POLICY "App can read stores" ON stores FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON stores FROM anon, authenticated;
GRANT SELECT ON stores TO anon, authenticated;

-- Replay each store's movements from that store's opening stock.
CREATE OR REPLACE FUNCTION recalc_product_stock(p_product_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  openings jsonb;
  by_store jsonb := '{}'::jsonb;
  m record;
  before numeric;
  after numeric;
  last_at timestamptz;
  total numeric := 0;
  k text;
BEGIN
  SELECT opening_by_store INTO openings FROM products WHERE id = p_product_id FOR UPDATE;
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

-- Products: as before, plus opening stock per store. A store's opening is set
-- once (when that store first gets this product), later edits never reset it.
CREATE OR REPLACE FUNCTION sync_products(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p jsonb;
  n integer := 0;
  pid uuid;
  incoming_at timestamptz;
  attempt integer;
  openings jsonb;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 500 THEN
    RAISE EXCEPTION 'Expected up to 500 products';
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (p->>'id')::uuid;
    incoming_at := COALESCE((p->>'details_updated_at')::timestamptz, 'epoch'::timestamptz);
    IF COALESCE(trim(p->>'name'), '') = '' OR COALESCE(trim(p->>'sku'), '') = '' THEN
      RAISE EXCEPTION 'Product % needs a name and SKU', pid;
    END IF;
    openings := CASE WHEN jsonb_typeof(p->'opening_by_store') = 'object' AND p->'opening_by_store' <> '{}'::jsonb
                     THEN p->'opening_by_store'
                     ELSE jsonb_build_object('00000000-0000-4000-8000-000000000001', COALESCE((p->>'opening_stock')::numeric, 0)) END;

    attempt := 0;
    LOOP
      BEGIN
        INSERT INTO products (id, name, brand, category, sub_category, sku, description, unit,
          current_stock, opening_stock, opening_by_store, minimum_stock, reorder_level, maximum_stock,
          purchase_price, selling_price, supplier, rack, shelf, store_section, photo_url,
          is_active, created_at, details_updated_at, created_by, updated_by)
        VALUES (pid, left(trim(p->>'name'), 200), left(COALESCE(p->>'brand', ''), 100), left(COALESCE(p->>'category', ''), 100),
          left(COALESCE(p->>'sub_category', ''), 100), left(trim(p->>'sku'), 80), left(COALESCE(p->>'description', ''), 2000),
          left(COALESCE(p->>'unit', 'Piece'), 30),
          0, 0, openings,
          COALESCE((p->>'minimum_stock')::numeric, 0), COALESCE((p->>'reorder_level')::numeric, 0), (p->>'maximum_stock')::numeric,
          COALESCE((p->>'purchase_price')::numeric, 0), COALESCE((p->>'selling_price')::numeric, 0),
          left(COALESCE(p->>'supplier', ''), 200), left(COALESCE(p->>'rack', ''), 40), left(COALESCE(p->>'shelf', ''), 40),
          left(COALESCE(p->>'store_section', ''), 80), left(COALESCE(p->>'photo_url', ''), 1000),
          COALESCE((p->>'is_active')::boolean, true), COALESCE((p->>'created_at')::timestamptz, now()), incoming_at,
          left(COALESCE(p->>'created_by', ''), 60), left(COALESCE(p->>'updated_by', ''), 60))
        ON CONFLICT (id) DO UPDATE SET
          name = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.name ELSE products.name END,
          brand = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.brand ELSE products.brand END,
          category = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.category ELSE products.category END,
          sub_category = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.sub_category ELSE products.sub_category END,
          sku = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.sku ELSE products.sku END,
          description = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.description ELSE products.description END,
          unit = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.unit ELSE products.unit END,
          minimum_stock = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.minimum_stock ELSE products.minimum_stock END,
          reorder_level = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.reorder_level ELSE products.reorder_level END,
          maximum_stock = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.maximum_stock ELSE products.maximum_stock END,
          purchase_price = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.purchase_price ELSE products.purchase_price END,
          selling_price = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.selling_price ELSE products.selling_price END,
          supplier = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.supplier ELSE products.supplier END,
          rack = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.rack ELSE products.rack END,
          shelf = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.shelf ELSE products.shelf END,
          store_section = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.store_section ELSE products.store_section END,
          photo_url = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.photo_url ELSE products.photo_url END,
          is_active = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.is_active ELSE products.is_active END,
          updated_by = CASE WHEN products.details_updated_at < EXCLUDED.details_updated_at THEN EXCLUDED.updated_by ELSE products.updated_by END,
          details_updated_at = GREATEST(products.details_updated_at, EXCLUDED.details_updated_at),
          -- add openings for stores this product didn't have yet; never overwrite an existing one
          opening_by_store = EXCLUDED.opening_by_store || products.opening_by_store
        WHERE products.details_updated_at < EXCLUDED.details_updated_at
           OR NOT (products.opening_by_store @> (EXCLUDED.opening_by_store - ARRAY(SELECT jsonb_object_keys(products.opening_by_store))));
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempt := attempt + 1;
        IF attempt > 3 THEN RAISE; END IF;
        p := jsonb_set(p, '{sku}', to_jsonb(left(trim(p->>'sku'), 70) || '-' || upper(substr(replace(pid::text, '-', ''), 1, 2 + attempt * 2))));
      END;
    END LOOP;
    PERFORM recalc_product_stock(pid);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

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
    -- A store created offline on another phone may not have arrived yet
    INSERT INTO stores (id, name, changed_at) VALUES (sid, 'Store', 'epoch') ON CONFLICT (id) DO NOTHING;
    INSERT INTO stock_movements (id, product_id, store_id, product_name, movement, quantity, stock_before, stock_after,
      counted_stock, reason, reference, done_by, done_at)
    VALUES ((m->>'id')::uuid, pid, sid, left(COALESCE(m->>'product_name', ''), 200), m->>'movement',
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

-- Stores: newest change wins (add, rename, remove, reorder)
CREATE OR REPLACE FUNCTION sync_stores(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; n integer := 0; nm text;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 200 THEN
    RAISE EXCEPTION 'Expected up to 200 stores';
  END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(items) LOOP
    nm := left(regexp_replace(trim(COALESCE(s->>'name', '')), '\s+', ' ', 'g'), 60);
    IF nm = '' THEN CONTINUE; END IF;
    INSERT INTO stores (id, name, is_active, sort_order, changed_at)
    VALUES ((s->>'id')::uuid, nm, COALESCE((s->>'is_active')::boolean, true), COALESCE((s->>'sort_order')::integer, 0), (s->>'changed_at')::timestamptz)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, changed_at = EXCLUDED.changed_at
    WHERE stores.changed_at < EXCLUDED.changed_at;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION sync_stores(jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION recalc_product_stock(uuid) FROM PUBLIC, anon, authenticated;

-- Readable views
CREATE OR REPLACE VIEW store_stock WITH (security_invoker = true) AS
SELECT
  s.name                  AS store,
  p.name                  AS product,
  p.brand,
  p.rack,
  COALESCE((p.stock_by_store->>s.id::text)::numeric, 0) AS in_stock,
  p.unit,
  p.minimum_stock         AS minimum,
  CASE WHEN COALESCE((p.stock_by_store->>s.id::text)::numeric, 0) <= 0 THEN 'Out of stock'
       WHEN COALESCE((p.stock_by_store->>s.id::text)::numeric, 0) <= p.minimum_stock THEN 'Low stock'
       ELSE 'In stock' END AS status,
  p.sku
FROM products p
JOIN stores s ON s.is_active AND (p.stock_by_store ? s.id::text OR p.opening_by_store ? s.id::text)
WHERE p.is_active
ORDER BY s.sort_order, s.name, p.name;

DROP VIEW IF EXISTS movement_history;
CREATE VIEW movement_history WITH (security_invoker = true) AS
SELECT
  m.done_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
  m.done_by                            AS person,
  st.name                              AS store,
  CASE m.movement WHEN 'IN' THEN 'Stock in' WHEN 'OUT' THEN 'Stock out' ELSE 'Count corrected' END AS movement,
  COALESCE(p.name, m.product_name)     AS product,
  m.quantity,
  m.stock_before,
  m.stock_after,
  NULLIF(m.reason, '')                 AS reason,
  NULLIF(m.reference, '')              AS reference
FROM stock_movements m
LEFT JOIN products p ON p.id = m.product_id
LEFT JOIN stores st ON st.id = m.store_id
ORDER BY m.done_at DESC;

GRANT SELECT ON store_stock, movement_history TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
  END IF;
END $$;

-- Recalculate existing products into the per-store columns
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM products LOOP PERFORM recalc_product_stock(r.id); END LOOP; END $$;

CREATE OR REPLACE VIEW activity_history WITH (security_invoker = true) AS
SELECT
  happened_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
  done_by AS person,
  role,
  CASE section WHEN 'product' THEN 'Products' WHEN 'people' THEN 'People and access' ELSE 'Stores and backup' END AS section,
  summary,
  changes,
  details
FROM activity_log
ORDER BY happened_at DESC;
