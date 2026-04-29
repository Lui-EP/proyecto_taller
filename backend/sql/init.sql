CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer',
  status TEXT NOT NULL DEFAULT 'new',
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  business_name TEXT,
  seller_description TEXT,
  seller_schedule TEXT,
  seller_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_local_handmade BOOLEAN NOT NULL DEFAULT FALSE,
  local_handmade_verified BOOLEAN NOT NULL DEFAULT FALSE,
  views INTEGER NOT NULL DEFAULT 0,
  featured_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('product', 'seller')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_history_user_viewed ON history(user_id, viewed_at DESC);

-- Seed users (password: 123456)
INSERT INTO users (id, name, email, password_hash, role, status, subscription_plan, business_name, seller_description, seller_location)
VALUES
  ('u-admin', 'Admin MercadoLocal', 'admin@mercadolocal.local', '123456', 'admin', 'verified', 'premium', NULL, NULL, NULL),
  ('u-seller', 'Artesana Luna', 'vendedor@mercadolocal.local', '123456', 'seller', 'verified', 'free', 'Artesanias Luna', 'Productos artesanales hechos a mano', 'Oaxaca, Mexico'),
  ('u-buyer', 'Cliente Demo', 'cliente@mercadolocal.local', '123456', 'buyer', 'new', 'free', NULL, NULL, NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (id, name, description, status)
VALUES
  ('c1', 'Alimentos', 'Productos alimenticios locales', 'approved'),
  ('c2', 'Artesanias', 'Artesanias y manualidades', 'approved'),
  ('c3', 'Textiles', 'Ropa y textiles regionales', 'approved')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (id, seller_id, category_id, name, description, price, images, status, is_featured, is_local_handmade, local_handmade_verified, views)
VALUES
  ('p1', 'u-seller', 'c2', 'Canasta tejida', 'Canasta artesanal de palma', 450, '["https://images.unsplash.com/photo-1542838132-92c53300491e?w=600"]'::jsonb, 'approved', TRUE, TRUE, TRUE, 18),
  ('p2', 'u-seller', 'c1', 'Miel organica', 'Miel pura de floracion local', 220, '["https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=600"]'::jsonb, 'approved', FALSE, TRUE, FALSE, 11)
ON CONFLICT (id) DO NOTHING;
