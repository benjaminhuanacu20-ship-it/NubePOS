-- =============================================================================
-- MiniPost — Esquema completo para Supabase Cloud
-- =============================================================================
-- Cómo ejecutarlo:
--   1. Entra a https://supabase.com/dashboard y abre tu proyecto.
--   2. Ve a "SQL Editor" > "New query".
--   3. Copia y pega TODO este archivo.
--   4. Pulsa "Run".
--
-- El script es idempotente: puedes volver a ejecutarlo sin romper nada.
-- No requiere Docker ni Supabase CLI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  last_purchase_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  discount_pct NUMERIC(5, 2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_alerts_company ON alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_company ON recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_promotions_company ON promotions(company_id);

-- -----------------------------------------------------------------------------
-- 3. Funciones auxiliares
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 4. Triggers de automatización
-- -----------------------------------------------------------------------------

-- Descuenta inventario automáticamente al registrar una venta
CREATE OR REPLACE FUNCTION decrease_inventory_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory
  SET quantity = GREATEST(quantity - NEW.quantity, 0),
      updated_at = NOW()
  WHERE product_id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrease_inventory ON sale_items;
CREATE TRIGGER trg_decrease_inventory
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION decrease_inventory_on_sale();

-- Actualiza la fecha de última compra del cliente
CREATE OR REPLACE FUNCTION update_customer_last_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET last_purchase_at = NEW.created_at
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_customer_purchase ON sales;
CREATE TRIGGER trg_update_customer_purchase
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION update_customer_last_purchase();

-- -----------------------------------------------------------------------------
-- 5. Alta de usuario + datos demo
-- -----------------------------------------------------------------------------
-- Se llama desde el frontend con supabase.rpc('setup_new_user', {...}) justo
-- después del registro. Crea la empresa, el perfil y datos de demostración.

DROP FUNCTION IF EXISTS setup_new_user(TEXT, TEXT);

CREATE FUNCTION setup_new_user(p_company_name TEXT, p_full_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  p_coca UUID;
  p_brownie UUID;
  p_azucar UUID;
  p_cafe UUID;
  p_agua UUID;
  p_sandwich UUID;
  p_galleta UUID;
  p_leche UUID;
  c_maria UUID;
  c_juan UUID;
  c_ana UUID;
  c_pedro UUID;
  c_lucia UUID;
  v_sale_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa. Desactiva "Confirm email" en Authentication > Sign In / Providers > Email, o confirma tu correo antes de continuar.';
  END IF;

  -- Idempotente: si el usuario ya tiene empresa, la devuelve sin duplicar datos
  SELECT company_id INTO v_company_id FROM profiles WHERE id = v_user_id;
  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  INSERT INTO companies (name) VALUES (p_company_name) RETURNING id INTO v_company_id;

  INSERT INTO profiles (id, company_id, full_name, role)
  VALUES (v_user_id, v_company_id, p_full_name, 'owner');

  -- Productos demo
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Coca Cola', 'CC-001', 25.00) RETURNING id INTO p_coca;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Brownie', 'BR-001', 35.00) RETURNING id INTO p_brownie;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Azúcar', 'AZ-001', 45.00) RETURNING id INTO p_azucar;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Café Americano', 'CF-001', 40.00) RETURNING id INTO p_cafe;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Agua Natural', 'AG-001', 15.00) RETURNING id INTO p_agua;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Sandwich', 'SW-001', 55.00) RETURNING id INTO p_sandwich;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Galleta', 'GA-001', 20.00) RETURNING id INTO p_galleta;
  INSERT INTO products (company_id, name, sku, price) VALUES
    (v_company_id, 'Leche', 'LE-001', 30.00) RETURNING id INTO p_leche;

  -- Inventario: Coca Cola y Azúcar arrancan bajo mínimo para la demo
  INSERT INTO inventory (product_id, quantity, min_stock) VALUES
    (p_coca, 8, 15),
    (p_brownie, 40, 10),
    (p_azucar, 18, 20),
    (p_cafe, 50, 10),
    (p_agua, 60, 20),
    (p_sandwich, 25, 10),
    (p_galleta, 35, 15),
    (p_leche, 30, 10);

  -- Clientes demo: María lleva más de 30 días sin comprar
  INSERT INTO customers (company_id, name, email, phone, last_purchase_at) VALUES
    (v_company_id, 'María González', 'maria@email.com', '555-0101', NOW() - INTERVAL '35 days') RETURNING id INTO c_maria;
  INSERT INTO customers (company_id, name, email, phone, last_purchase_at) VALUES
    (v_company_id, 'Juan Pérez', 'juan@email.com', '555-0102', NOW() - INTERVAL '2 days') RETURNING id INTO c_juan;
  INSERT INTO customers (company_id, name, email, phone, last_purchase_at) VALUES
    (v_company_id, 'Ana López', 'ana@email.com', '555-0103', NOW() - INTERVAL '5 days') RETURNING id INTO c_ana;
  INSERT INTO customers (company_id, name, email, phone, last_purchase_at) VALUES
    (v_company_id, 'Pedro Ruiz', 'pedro@email.com', '555-0104', NOW() - INTERVAL '1 day') RETURNING id INTO c_pedro;
  INSERT INTO customers (company_id, name, email, phone, last_purchase_at) VALUES
    (v_company_id, 'Lucía Martínez', 'lucia@email.com', '555-0105', NOW() - INTERVAL '7 days') RETURNING id INTO c_lucia;

  -- Ventas históricas: café rota mucho, brownie casi nada
  INSERT INTO sales (company_id, customer_id, total, created_at) VALUES
    (v_company_id, c_juan, 80.00, NOW() - INTERVAL '1 day') RETURNING id INTO v_sale_id;
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES
    (v_sale_id, p_cafe, 2, 40.00);

  INSERT INTO sales (company_id, customer_id, total, created_at) VALUES
    (v_company_id, c_ana, 120.00, NOW() - INTERVAL '3 days') RETURNING id INTO v_sale_id;
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES
    (v_sale_id, p_cafe, 3, 40.00);

  INSERT INTO sales (company_id, customer_id, total, created_at) VALUES
    (v_company_id, c_pedro, 50.00, NOW() - INTERVAL '5 days') RETURNING id INTO v_sale_id;
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES
    (v_sale_id, p_coca, 2, 25.00);

  INSERT INTO sales (company_id, customer_id, total, created_at) VALUES
    (v_company_id, c_lucia, 35.00, NOW() - INTERVAL '10 days') RETURNING id INTO v_sale_id;
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES
    (v_sale_id, p_brownie, 1, 35.00);

  INSERT INTO sales (company_id, customer_id, total, created_at) VALUES
    (v_company_id, c_maria, 90.00, NOW() - INTERVAL '35 days') RETURNING id INTO v_sale_id;
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES
    (v_sale_id, p_sandwich, 1, 55.00),
    (v_sale_id, p_agua, 1, 15.00),
    (v_sale_id, p_galleta, 1, 20.00);

  -- El trigger de ventas sobrescribe last_purchase_at; restauramos la
  -- antigüedad de María para que el agente la detecte como inactiva.
  UPDATE customers SET last_purchase_at = NOW() - INTERVAL '35 days' WHERE id = c_maria;
  UPDATE customers SET last_purchase_at = NOW() - INTERVAL '10 days' WHERE id = c_lucia;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION setup_new_user(TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT USING (id = get_user_company_id());

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS products_all ON products;
CREATE POLICY products_all ON products FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS customers_all ON customers;
CREATE POLICY customers_all ON customers FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS sales_all ON sales;
CREATE POLICY sales_all ON sales FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS alerts_all ON alerts;
CREATE POLICY alerts_all ON alerts FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS recommendations_all ON recommendations;
CREATE POLICY recommendations_all ON recommendations FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS promotions_all ON promotions;
CREATE POLICY promotions_all ON promotions FOR ALL USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS inventory_select ON inventory;
CREATE POLICY inventory_select ON inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = inventory.product_id AND p.company_id = get_user_company_id())
);

DROP POLICY IF EXISTS inventory_insert ON inventory;
CREATE POLICY inventory_insert ON inventory FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = inventory.product_id AND p.company_id = get_user_company_id())
);

DROP POLICY IF EXISTS inventory_update ON inventory;
CREATE POLICY inventory_update ON inventory FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = inventory.product_id AND p.company_id = get_user_company_id())
);

DROP POLICY IF EXISTS sale_items_select ON sale_items;
CREATE POLICY sale_items_select ON sale_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id())
);

DROP POLICY IF EXISTS sale_items_insert ON sale_items;
CREATE POLICY sale_items_insert ON sale_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id())
);

-- -----------------------------------------------------------------------------
-- 7. Permisos de esquema (RLS sigue protegiendo cada fila)
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Realtime (dashboard y panel del agente en vivo)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'La publicación supabase_realtime no existe; se omite la configuración de Realtime.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY['alerts', 'recommendations', 'promotions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- Listo. Verifica en "Table Editor" que existan las 10 tablas.
-- =============================================================================
