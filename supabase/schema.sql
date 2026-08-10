-- BAHUBALI ENTERPRISES LIVE STOCK MANAGEMENT SYSTEM
-- SUPABASE DATABASE SCHEMA MIGRATION & SEED DATA

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRANDS TABLE
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sub_category TEXT DEFAULT '',
  sku TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'Piece',
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 5,
  reorder_level NUMERIC(12,2) NOT NULL DEFAULT 10,
  maximum_stock NUMERIC(12,2) DEFAULT 100,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  selling_price NUMERIC(12,2) DEFAULT 0,
  supplier TEXT DEFAULT '',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  rack TEXT DEFAULT '',
  shelf TEXT DEFAULT '',
  store_section TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'Admin',
  updated_by TEXT DEFAULT 'Admin'
);

-- 5. STOCK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity NUMERIC(12,2) NOT NULL,
  previous_stock NUMERIC(12,2) NOT NULL,
  new_stock NUMERIC(12,2) NOT NULL,
  reason TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  user_name TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROFILES / USERS TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR FAST SEARCH AND REAL-TIME AGGREGATIONS
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_rack ON products(rack);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON stock_transactions(created_at DESC);

-- REAL-TIME PUBLICATION ENABLING
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE stock_transactions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_transactions;

-- RLS POLICIES (ENABLE ALL ACCESS FOR DEMO / ANONYMOUS AUTH OR CONFIGURE RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public edit access to products" ON products FOR ALL USING (true);

CREATE POLICY "Allow public read access to stock_transactions" ON stock_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public edit access to stock_transactions" ON stock_transactions FOR ALL USING (true);

CREATE POLICY "Allow public access to brands" ON brands FOR ALL USING (true);
CREATE POLICY "Allow public access to categories" ON categories FOR ALL USING (true);
CREATE POLICY "Allow public access to suppliers" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow public access to profiles" ON profiles FOR ALL USING (true);

-- STORAGE BUCKET CREATION FOR PRODUCT PHOTOS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public access to product images" ON storage.objects 
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Upload product images policy" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Update product images policy" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product-images');

-- SEED REALISTIC HARDWARE PRODUCTS
INSERT INTO products (id, name, brand, category, sub_category, sku, description, unit, current_stock, minimum_stock, reorder_level, purchase_price, selling_price, supplier, rack) VALUES
('b1000000-0000-0000-0000-000000000001', 'Bosch 8mm Drill Bit for Concrete', 'Bosch', 'Tools & Accessories', 'Drill Bits', 'DRL-BOS-8MM', 'High precision carbide tip masonry drill bit', 'Piece', 14, 5, 10, 120.00, 180.00, 'Bosch India Ltd', 'B-12'),
('b1000000-0000-0000-0000-000000000002', 'Asian Paints Primer White 4L', 'Asian Paints', 'Paint & Coatings', 'Primers', 'PNT-AP-PRIM-4L', 'Exterior/Interior wall primer for smooth coating', 'Bucket', 12, 4, 8, 450.00, 620.00, 'Asian Paints Depot', 'P-04'),
('b1000000-0000-0000-0000-000000000003', 'Polycab 2.5 sq mm Copper Wire 90m (Red)', 'Polycab', 'Electrical', 'Wires & Cables', 'ELE-POLY-2.5-RD', 'Flame retardant PVC insulated copper wire', 'Coil', 18, 5, 10, 1650.00, 2100.00, 'Polycab Distributors', 'E-01'),
('b1000000-0000-0000-0000-000000000004', 'Taparia Screwdriver Set 6 Pcs', 'Taparia', 'Hand Tools', 'Screwdrivers', 'TL-TAP-SET6', 'Insulated high carbon steel magnetic tip screwdriver kit', 'Set', 8, 3, 5, 280.00, 420.00, 'Taparia Hardware', 'T-03'),
('b1000000-0000-0000-0000-000000000005', 'Finolex 4-inch PVC Pipe 10ft', 'Finolex', 'Plumbing', 'Pipes & Tubes', 'PLM-FIN-4IN-10FT', 'Heavy duty SWR PVC pipe for drainage', 'Piece', 35, 10, 15, 380.00, 520.00, 'Finolex Pipes Agency', 'PL-08'),
('b1000000-0000-0000-0000-000000000006', 'Dr. Fixit Waterproofing Compound 1L', 'Dr. Fixit', 'Adhesives & Chemicals', 'Waterproofing', 'CHM-FIX-1L', 'Pidilite LW+ Integral waterproofing liquid', 'Liter', 2, 5, 8, 140.00, 195.00, 'Pidilite Wholesale', 'C-02'),
('b1000000-0000-0000-0000-000000000007', 'Stanley Claw Hammer 16oz Fiberglass', 'Stanley', 'Hand Tools', 'Hammers', 'TL-STN-HAM-16', 'Ergonomic non-slip fiberglass handle steel head hammer', 'Piece', 6, 2, 4, 320.00, 480.00, 'Stanley Black & Decker', 'T-05'),
('b1000000-0000-0000-0000-000000000008', 'Anchor 1 Switch 6A Modular (Roma)', 'Anchor', 'Electrical', 'Switches & Sockets', 'ELE-ANC-SW-6A', 'Smooth action flame retardant modular electrical switch', 'Piece', 120, 25, 50, 22.00, 38.00, 'Panasonic Electric', 'E-05'),
('b1000000-0000-0000-0000-000000000009', 'SS Screws 1.5 inch (Box of 100)', 'Self-Brand', 'Fasteners', 'Screws', 'FST-SS-1.5-100', 'Rust proof 304 grade stainless steel wood screws', 'Box', 25, 8, 15, 95.00, 150.00, 'Universal Fasteners', 'F-02'),
('b1000000-0000-0000-0000-000000000010', 'PVC 90 Degree Elbow 2 inch', 'Supreme', 'Plumbing', 'Fittings', 'PLM-SUP-ELB-2IN', 'Durable pressure-tested PVC elbow connector', 'Piece', 0, 10, 20, 18.00, 32.00, 'Supreme Plastics', 'PL-02'),
('b1000000-0000-0000-0000-000000000011', 'Makita 4-inch Angle Grinder 850W', 'Makita', 'Power Tools', 'Grinders', 'PWR-MAK-GRN-4', 'Heavy duty industrial angle grinder with guard', 'Piece', 4, 2, 3, 2400.00, 3250.00, 'Makita Industrial Tools', 'PT-01'),
('b1000000-0000-0000-0000-000000000012', 'Fevicol SH Synthetic Resin Adhesive 1kg', 'Fevicol', 'Adhesives & Chemicals', 'Adhesives', 'CHM-FEV-1KG', 'Strong bonding wood glue for furniture and carpentry', 'Kg', 15, 5, 10, 210.00, 290.00, 'Pidilite Wholesale', 'C-01')
ON CONFLICT (id) DO NOTHING;
