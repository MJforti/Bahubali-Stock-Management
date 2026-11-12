-- Bahubali Enterprises stock register: central database
-- Phones keep a local copy and sync here. Clients can READ everything,
-- but can only WRITE through the functions at the bottom, which validate
-- input and merge changes from several phones safely.

-- ---------- Sync cursor ----------
-- Every insert/update stamps a row with the next number, so a phone can ask
-- "what changed since number N?" without missing anything.
CREATE SEQUENCE IF NOT EXISTS sync_seq;

CREATE OR REPLACE FUNCTION stamp_sync_seq() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.sync_seq := nextval('sync_seq');
  RETURN NEW;
END $$;

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS products (
  id                 uuid PRIMARY KEY,
  name               text NOT NULL,
  brand              text NOT NULL DEFAULT '',
  category           text NOT NULL DEFAULT '',
  sub_category       text NOT NULL DEFAULT '',
  sku                text NOT NULL,
  description        text NOT NULL DEFAULT '',
  unit               text NOT NULL DEFAULT 'Piece',
  current_stock      numeric(12,2) NOT NULL DEFAULT 0,
  opening_stock      numeric(12,2) NOT NULL DEFAULT 0,
  minimum_stock      numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level      numeric(12,2) NOT NULL DEFAULT 0,
  maximum_stock      numeric(12,2),
  purchase_price     numeric(12,2) NOT NULL DEFAULT 0,
  selling_price      numeric(12,2) NOT NULL DEFAULT 0,
  supplier           text NOT NULL DEFAULT '',
  rack               text NOT NULL DEFAULT '',
  shelf              text NOT NULL DEFAULT '',
  store_section      text NOT NULL DEFAULT '',
  photo_url          text NOT NULL DEFAULT '',
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  details_updated_at timestamptz NOT NULL DEFAULT now(),
  stock_updated_at   timestamptz,
  created_by         text NOT NULL DEFAULT '',
  updated_by         text NOT NULL DEFAULT '',
  sync_seq           bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE products IS 'One row per product. current_stock is recalculated from stock_movements.';
COMMENT ON COLUMN products.opening_stock IS 'Stock when the product was first added; movements are replayed from here.';
COMMENT ON COLUMN products.details_updated_at IS 'When name, price, rack etc. last changed. The newest edit wins.';

CREATE TABLE IF NOT EXISTS stock_movements (
  id            uuid PRIMARY KEY,
  product_id    uuid NOT NULL REFERENCES products(id),
  product_name  text NOT NULL DEFAULT '',
  movement      text NOT NULL CHECK (movement IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity      numeric(12,2) NOT NULL CHECK (quantity >= 0),
  stock_before  numeric(12,2) NOT NULL DEFAULT 0,
  stock_after   numeric(12,2) NOT NULL DEFAULT 0,
  counted_stock numeric(12,2),
  reason        text NOT NULL DEFAULT '',
  reference     text NOT NULL DEFAULT '',
  done_by       text NOT NULL DEFAULT '',
  done_at       timestamptz NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  sync_seq      bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE stock_movements IS 'Every stock in, stock out and count correction. Never edited or deleted.';
COMMENT ON COLUMN stock_movements.counted_stock IS 'For ADJUSTMENT: the stock that was counted. stock_before/after are recalculated in time order.';

CREATE TABLE IF NOT EXISTS activity_log (
  id            uuid PRIMARY KEY,
  happened_at   timestamptz NOT NULL,
  done_by       text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  section       text NOT NULL CHECK (section IN ('product', 'people', 'data')),
  action        text NOT NULL,
  summary       text NOT NULL,
  product_id    uuid,
  product_name  text,
  changes       jsonb,
  details       jsonb,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  sync_seq      bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE activity_log IS 'Who did what besides stock movements: product edits, staff, admin mode, backups.';

CREATE TABLE IF NOT EXISTS staff (
  name_key    text PRIMARY KEY,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  changed_at  timestamptz NOT NULL,
  sync_seq    bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE staff IS 'Names people pick in the app. Removed names stay with is_active = false so removals spread to every phone.';

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (lower(sku));
CREATE INDEX IF NOT EXISTS products_sync_idx ON products (sync_seq);
CREATE INDEX IF NOT EXISTS movements_product_idx ON stock_movements (product_id, done_at, id);
CREATE INDEX IF NOT EXISTS movements_sync_idx ON stock_movements (sync_seq);
CREATE INDEX IF NOT EXISTS movements_done_at_idx ON stock_movements (done_at DESC);
CREATE INDEX IF NOT EXISTS activity_sync_idx ON activity_log (sync_seq);
CREATE INDEX IF NOT EXISTS activity_time_idx ON activity_log (happened_at DESC);
CREATE INDEX IF NOT EXISTS staff_sync_idx ON staff (sync_seq);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'stock_movements', 'activity_log', 'staff'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_sync_seq ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_sync_seq BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION stamp_sync_seq()', t, t);
  END LOOP;
END $$;

-- ---------- Readable views (open these in the table editor) ----------
CREATE OR REPLACE VIEW stock_overview WITH (security_invoker = true) AS
SELECT
  name            AS product,
  brand,
  category,
  rack,
  current_stock   AS in_stock,
  unit,
  minimum_stock   AS minimum,
  CASE WHEN current_stock <= 0 THEN 'Out of stock'
       WHEN current_stock <= minimum_stock THEN 'Low stock'
       ELSE 'In stock' END AS status,
  selling_price   AS price,
  sku,
  stock_updated_at AS last_movement
FROM products
WHERE is_active
ORDER BY name;

CREATE OR REPLACE VIEW low_stock WITH (security_invoker = true) AS
SELECT product, brand, rack, in_stock, unit, minimum, status
FROM stock_overview
WHERE status <> 'In stock'
ORDER BY in_stock, product;

CREATE OR REPLACE VIEW movement_history WITH (security_invoker = true) AS
SELECT
  m.done_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
  m.done_by                            AS person,
  CASE m.movement WHEN 'IN' THEN 'Stock in' WHEN 'OUT' THEN 'Stock out' ELSE 'Count corrected' END AS movement,
  COALESCE(p.name, m.product_name)     AS product,
  m.quantity,
  m.stock_before,
  m.stock_after,
  NULLIF(m.reason, '')                 AS reason,
  NULLIF(m.reference, '')              AS reference
FROM stock_movements m
LEFT JOIN products p ON p.id = m.product_id
ORDER BY m.done_at DESC;

CREATE OR REPLACE VIEW activity_history WITH (security_invoker = true) AS
SELECT
  happened_at AT TIME ZONE 'Asia/Kolkata' AS "when (IST)",
  done_by AS person,
  role,
  CASE section WHEN 'product' THEN 'Products' WHEN 'people' THEN 'People and access' ELSE 'Sharing and backup' END AS section,
  summary,
  changes,
  details
FROM activity_log
ORDER BY happened_at DESC;

-- ---------- Access: read for everyone using the app, write only via functions ----------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App can read products" ON products;
CREATE POLICY "App can read products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "App can read movements" ON stock_movements;
CREATE POLICY "App can read movements" ON stock_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "App can read activity" ON activity_log;
CREATE POLICY "App can read activity" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "App can read staff" ON staff;
CREATE POLICY "App can read staff" ON staff FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON products, stock_movements, activity_log, staff FROM anon, authenticated;
GRANT SELECT ON products, stock_movements, activity_log, staff, stock_overview, low_stock, movement_history, activity_history TO anon, authenticated;

-- ---------- Write functions ----------

-- Recalculate one product's stock by replaying its movements in time order.
CREATE OR REPLACE FUNCTION recalc_product_stock(p_product_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  running numeric;
  m record;
  last_at timestamptz;
BEGIN
  SELECT opening_stock INTO running FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR m IN SELECT * FROM stock_movements WHERE product_id = p_product_id ORDER BY done_at, id LOOP
    DECLARE before numeric := running; after numeric;
    BEGIN
      IF m.movement = 'IN' THEN after := running + m.quantity;
      ELSIF m.movement = 'OUT' THEN after := running - m.quantity;
      ELSE after := COALESCE(m.counted_stock, m.stock_after);
      END IF;
      IF m.stock_before IS DISTINCT FROM before OR m.stock_after IS DISTINCT FROM after
         OR (m.movement = 'ADJUSTMENT' AND m.quantity IS DISTINCT FROM abs(after - before)) THEN
        UPDATE stock_movements
          SET stock_before = before, stock_after = after,
              quantity = CASE WHEN m.movement = 'ADJUSTMENT' THEN abs(after - before) ELSE quantity END
          WHERE id = m.id;
      END IF;
      running := after;
      last_at := m.done_at;
    END;
  END LOOP;
  UPDATE products SET current_stock = running, stock_updated_at = COALESCE(last_at, stock_updated_at)
    WHERE id = p_product_id AND (current_stock IS DISTINCT FROM running OR stock_updated_at IS DISTINCT FROM COALESCE(last_at, stock_updated_at));
END $$;

-- Add or update products. Details follow the newest edit; stock is never set directly.
CREATE OR REPLACE FUNCTION sync_products(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p jsonb;
  n integer := 0;
  pid uuid;
  incoming_at timestamptz;
  attempt integer;
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

    attempt := 0;
    LOOP
      BEGIN
        INSERT INTO products (id, name, brand, category, sub_category, sku, description, unit,
          current_stock, opening_stock, minimum_stock, reorder_level, maximum_stock,
          purchase_price, selling_price, supplier, rack, shelf, store_section, photo_url,
          is_active, created_at, details_updated_at, created_by, updated_by)
        VALUES (pid, left(trim(p->>'name'), 200), left(COALESCE(p->>'brand', ''), 100), left(COALESCE(p->>'category', ''), 100),
          left(COALESCE(p->>'sub_category', ''), 100), left(trim(p->>'sku'), 80), left(COALESCE(p->>'description', ''), 2000),
          left(COALESCE(p->>'unit', 'Piece'), 30),
          COALESCE((p->>'opening_stock')::numeric, 0), COALESCE((p->>'opening_stock')::numeric, 0),
          COALESCE((p->>'minimum_stock')::numeric, 0), COALESCE((p->>'reorder_level')::numeric, 0), (p->>'maximum_stock')::numeric,
          COALESCE((p->>'purchase_price')::numeric, 0), COALESCE((p->>'selling_price')::numeric, 0),
          left(COALESCE(p->>'supplier', ''), 200), left(COALESCE(p->>'rack', ''), 40), left(COALESCE(p->>'shelf', ''), 40),
          left(COALESCE(p->>'store_section', ''), 80), left(COALESCE(p->>'photo_url', ''), 1000),
          COALESCE((p->>'is_active')::boolean, true), COALESCE((p->>'created_at')::timestamptz, now()), incoming_at,
          left(COALESCE(p->>'created_by', ''), 60), left(COALESCE(p->>'updated_by', ''), 60))
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, brand = EXCLUDED.brand, category = EXCLUDED.category, sub_category = EXCLUDED.sub_category,
          sku = EXCLUDED.sku, description = EXCLUDED.description, unit = EXCLUDED.unit,
          minimum_stock = EXCLUDED.minimum_stock, reorder_level = EXCLUDED.reorder_level, maximum_stock = EXCLUDED.maximum_stock,
          purchase_price = EXCLUDED.purchase_price, selling_price = EXCLUDED.selling_price, supplier = EXCLUDED.supplier,
          rack = EXCLUDED.rack, shelf = EXCLUDED.shelf, store_section = EXCLUDED.store_section, photo_url = EXCLUDED.photo_url,
          is_active = EXCLUDED.is_active, details_updated_at = EXCLUDED.details_updated_at, updated_by = EXCLUDED.updated_by
        WHERE products.details_updated_at < EXCLUDED.details_updated_at;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- Another product already uses this SKU (e.g. two phones made it offline): keep both,
        -- give this one a short suffix from its id
        attempt := attempt + 1;
        IF attempt > 3 THEN RAISE; END IF;
        p := jsonb_set(p, '{sku}', to_jsonb(left(trim(p->>'sku'), 70) || '-' || upper(substr(replace(pid::text, '-', ''), 1, 2 + attempt * 2))));
      END;
    END LOOP;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Record stock movements. Re-sending the same movement is harmless (same id).
CREATE OR REPLACE FUNCTION sync_movements(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb;
  n integer := 0;
  touched uuid[] := '{}';
  pid uuid;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 1000 THEN
    RAISE EXCEPTION 'Expected up to 1000 movements';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (m->>'product_id')::uuid;
    INSERT INTO stock_movements (id, product_id, product_name, movement, quantity, stock_before, stock_after,
      counted_stock, reason, reference, done_by, done_at)
    VALUES ((m->>'id')::uuid, pid, left(COALESCE(m->>'product_name', ''), 200), m->>'movement',
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

CREATE OR REPLACE FUNCTION sync_activity(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a jsonb; n integer := 0;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 1000 THEN
    RAISE EXCEPTION 'Expected up to 1000 entries';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(items) LOOP
    INSERT INTO activity_log (id, happened_at, done_by, role, section, action, summary, product_id, product_name, changes, details)
    VALUES ((a->>'id')::uuid, (a->>'happened_at')::timestamptz, left(COALESCE(a->>'done_by', ''), 60),
      CASE WHEN a->>'role' = 'admin' THEN 'admin' ELSE 'staff' END, a->>'section', left(a->>'action', 40),
      left(a->>'summary', 300), (a->>'product_id')::uuid, left(a->>'product_name', 200),
      CASE WHEN jsonb_typeof(a->'changes') = 'array' THEN a->'changes' END,
      CASE WHEN jsonb_typeof(a->'details') = 'array' THEN a->'details' END)
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

-- Staff list: newest change per name wins (so removals spread too).
CREATE OR REPLACE FUNCTION sync_staff(items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; n integer := 0; nm text;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 500 THEN
    RAISE EXCEPTION 'Expected up to 500 names';
  END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(items) LOOP
    nm := left(regexp_replace(trim(s->>'name'), '\s+', ' ', 'g'), 40);
    IF nm = '' THEN CONTINUE; END IF;
    INSERT INTO staff (name_key, name, is_active, changed_at)
    VALUES (lower(nm), nm, COALESCE((s->>'is_active')::boolean, true), (s->>'changed_at')::timestamptz)
    ON CONFLICT (name_key) DO UPDATE SET name = CASE WHEN EXCLUDED.is_active THEN EXCLUDED.name ELSE staff.name END, is_active = EXCLUDED.is_active, changed_at = EXCLUDED.changed_at
    WHERE staff.changed_at < EXCLUDED.changed_at;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION recalc_product_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION stamp_sync_seq() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sync_products(jsonb), sync_movements(jsonb), sync_activity(jsonb), sync_staff(jsonb) TO anon, authenticated;
GRANT USAGE ON SEQUENCE sync_seq TO anon, authenticated;

-- ---------- Live updates ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'stock_movements', 'activity_log', 'staff'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------- Product photos ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-photos', 'product-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "App can add product photos" ON storage.objects;
CREATE POLICY "App can add product photos" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-photos' AND name LIKE 'products/%');
