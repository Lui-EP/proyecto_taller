import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';
import { query } from './db.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Solo se permiten imágenes'));
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsDir));

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    subscription: { plan: row.subscription_plan || 'free' },
    seller_profile: row.role === 'seller' || row.role === 'admin'
      ? {
          business_name: row.business_name,
          description: row.seller_description,
          schedule: row.seller_schedule,
          location: row.seller_location
        }
      : null
  };
}

async function maybeAuth(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const userRes = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    req.user = userRes.rows[0] ? toPublicUser(userRes.rows[0]) : null;
  } catch (_e) {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ detail: 'No autenticado' });
  }
  return next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: 'Sin permisos' });
    }
    return next();
  };
}

async function getProductById(productId, user) {
  const productRes = await query(
    `SELECT p.*, c.name AS category_name,
            u.name AS seller_name,
            u.status AS seller_status,
            u.business_name, u.seller_description, u.seller_location
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.id = $1`,
    [productId]
  );

  if (!productRes.rows[0]) return null;

  const p = productRes.rows[0];
  const reviewsRes = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC`,
    [productId]
  );

  const avgRes = await query(
    'SELECT COALESCE(AVG(rating), 0) AS avg_rating FROM reviews WHERE product_id = $1',
    [productId]
  );

  const favCountRes = await query(
    'SELECT COUNT(*)::int AS count FROM favorites WHERE product_id = $1',
    [productId]
  );

  return {
    id: p.id,
    seller_id: p.seller_id,
    category_id: p.category_id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    images: p.images || [],
    status: p.status,
    is_featured: p.is_featured,
    is_local_handmade: p.is_local_handmade,
    local_handmade_verified: p.local_handmade_verified,
    views: p.views,
    created_at: p.created_at,
    category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
    seller_name: p.seller_name,
    seller: {
      id: p.seller_id,
      name: p.seller_name,
      status: p.seller_status,
      seller_profile: {
        business_name: p.business_name,
        description: p.seller_description,
        location: p.seller_location
      }
    },
    reviews: reviewsRes.rows,
    average_rating: Number(avgRes.rows[0]?.avg_rating || 0),
    favorites_count: Number(favCountRes.rows[0]?.count || 0)
  };
}

app.use('/api', maybeAuth);

app.post('/api/uploads/images', requireAuth, requireRoles('seller', 'admin'), upload.array('images', 8), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ detail: 'No se recibieron imágenes' });
  }

  const urls = files.map((file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
  return res.status(201).json({ urls });
});

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({ ok: true, db: 'up' });
  } catch (error) {
    return res.status(500).json({ ok: false, db: 'down', detail: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ detail: 'Faltan datos obligatorios' });
  }

  try {
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows[0]) {
      return res.status(400).json({ detail: 'El correo ya está registrado' });
    }

    const id = uuid();
    const safeRole = ['buyer', 'seller'].includes(role) ? role : 'buyer';
    const hash = await bcrypt.hash(password, 10);

    const created = await query(
      `INSERT INTO users (id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name, email, hash, safeRole, safeRole === 'seller' ? 'new' : 'new']
    );

    const user = toPublicUser(created.rows[0]);
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    return res.status(500).json({ detail: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ detail: 'Correo y contraseña son obligatorios' });
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    const row = userRes.rows[0];
    if (!row) return res.status(401).json({ detail: 'Credenciales inválidas' });

    const looksHashed = String(row.password_hash || '').startsWith('$2');
    const ok = looksHashed
      ? await bcrypt.compare(password, row.password_hash)
      : password === row.password_hash;

    if (!ok) return res.status(401).json({ detail: 'Credenciales inválidas' });

    const user = toPublicUser(row);
    return res.json({ token: signToken(user), user });
  } catch (error) {
    return res.status(500).json({ detail: error.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json(req.user);
});

app.get('/api/categories', async (_req, res) => {
  const rows = await query('SELECT * FROM categories ORDER BY name');
  return res.json(rows.rows);
});

app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ detail: 'Nombre obligatorio' });

  const status = req.user.role === 'admin' ? 'approved' : 'pending';
  const created = await query(
    `INSERT INTO categories (id, name, description, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [uuid(), name, description || null, status]
  );
  return res.status(201).json(created.rows[0]);
});

app.put('/api/categories/:id/status', requireAuth, requireRoles('admin'), async (req, res) => {
  const status = req.query.status;
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    return res.status(400).json({ detail: 'Estado inválido' });
  }

  const updated = await query('UPDATE categories SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  return res.json(updated.rows[0]);
});

app.delete('/api/categories/:id', requireAuth, requireRoles('admin'), async (req, res) => {
  await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  return res.json({ ok: true });
});

app.get('/api/products', async (req, res) => {
  const {
    search,
    category_id,
    seller_id,
    max_price,
    is_local_handmade,
    is_featured,
    sort_by = 'created_at',
    skip = 0,
    limit = 12,
    status
  } = req.query;

  const where = [];
  const params = [];
  let i = 1;

  if (search) {
    where.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`);
    params.push(`%${search}%`);
    i += 1;
  }
  if (category_id) {
    where.push(`p.category_id = $${i}`);
    params.push(category_id);
    i += 1;
  }
  if (seller_id) {
    where.push(`p.seller_id = $${i}`);
    params.push(seller_id);
    i += 1;
  }
  if (max_price) {
    where.push(`p.price <= $${i}`);
    params.push(Number(max_price));
    i += 1;
  }
  if (String(is_local_handmade) === 'true') {
    where.push('p.is_local_handmade = true');
  }
  if (String(is_featured) === 'true') {
    where.push('p.is_featured = true');
  }

  if (req.user?.role === 'admin' && status) {
    where.push(`p.status = $${i}`);
    params.push(status);
    i += 1;
  } else if (req.user?.role === 'seller' && status) {
    where.push(`p.status = $${i}`);
    params.push(status);
    i += 1;
  } else {
    where.push(`p.status = 'approved'`);
  }

  const orderBy = {
    created_at: 'p.created_at DESC',
    price: 'p.price ASC',
    views: 'p.views DESC'
  }[sort_by] || 'p.created_at DESC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const baseSql = `
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN users u ON u.id = p.seller_id
    ${whereSql}
  `;

  const totalRes = await query(`SELECT COUNT(*)::int AS total ${baseSql}`, params);

  const listRes = await query(
    `SELECT p.*, c.name AS category_name, u.name AS seller_name
     ${baseSql}
     ORDER BY ${orderBy}
     OFFSET $${i} LIMIT $${i + 1}`,
    [...params, Number(skip), Number(limit)]
  );

  const productIds = listRes.rows.map((r) => r.id);
  const favMap = new Map();
  const avgMap = new Map();

  if (productIds.length) {
    const favRes = await query(
      `SELECT product_id, COUNT(*)::int AS count
       FROM favorites WHERE product_id = ANY($1) GROUP BY product_id`,
      [productIds]
    );
    favRes.rows.forEach((r) => favMap.set(r.product_id, Number(r.count)));

    const avgRes = await query(
      `SELECT product_id, COALESCE(AVG(rating), 0) AS avg
       FROM reviews WHERE product_id = ANY($1) GROUP BY product_id`,
      [productIds]
    );
    avgRes.rows.forEach((r) => avgMap.set(r.product_id, Number(r.avg)));
  }

  const products = listRes.rows.map((p) => ({
    id: p.id,
    seller_id: p.seller_id,
    category_id: p.category_id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    images: p.images || [],
    status: p.status,
    is_featured: p.is_featured,
    is_local_handmade: p.is_local_handmade,
    local_handmade_verified: p.local_handmade_verified,
    views: p.views,
    created_at: p.created_at,
    category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
    seller_name: p.seller_name,
    favorites_count: favMap.get(p.id) || 0,
    average_rating: avgMap.get(p.id) || 0
  }));

  return res.json({ products, total: totalRes.rows[0]?.total || 0 });
});

app.get('/api/products/seller', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const list = await query('SELECT * FROM products WHERE seller_id = $1 ORDER BY created_at DESC', [req.user.id]);
  return res.json(list.rows.map((p) => ({ ...p, price: Number(p.price) })));
});

app.get('/api/products/featured', async (_req, res) => {
  const rows = await query(
    `SELECT id, seller_id, category_id, name, description, price, images, status, is_featured,
            is_local_handmade, local_handmade_verified, views, created_at
     FROM products
     WHERE is_featured = true AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT 12`
  );
  return res.json(rows.rows.map((p) => ({ ...p, price: Number(p.price) })));
});

app.get('/api/products/:id', async (req, res) => {
  const product = await getProductById(req.params.id, req.user);
  if (!product) return res.status(404).json({ detail: 'Producto no encontrado' });

  await query('UPDATE products SET views = views + 1, updated_at = NOW() WHERE id = $1', [req.params.id]);

  if (req.user) {
    await query(
      `INSERT INTO history (user_id, product_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET viewed_at = NOW()`,
      [req.user.id, req.params.id]
    );
  }

  const refreshed = await getProductById(req.params.id, req.user);
  return res.json(refreshed);
});

app.post('/api/products', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const { name, description, price, category_id, images = [], is_local_handmade = false } = req.body || {};
  if (!name || !price || !category_id) {
    return res.status(400).json({ detail: 'Nombre, precio y categoría son obligatorios' });
  }

  const id = uuid();
  const created = await query(
    `INSERT INTO products (id, seller_id, category_id, name, description, price, images, status, is_local_handmade)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     RETURNING *`,
    [id, req.user.id, category_id, name, description || '', Number(price), JSON.stringify(images), 'pending', !!is_local_handmade]
  );

  return res.status(201).json({ ...created.rows[0], price: Number(created.rows[0].price) });
});

app.put('/api/products/:id', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const exists = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const product = exists.rows[0];
  if (!product) return res.status(404).json({ detail: 'Producto no encontrado' });
  if (req.user.role !== 'admin' && product.seller_id !== req.user.id) {
    return res.status(403).json({ detail: 'Sin permisos' });
  }

  const payload = req.body || {};
  const updated = await query(
    `UPDATE products
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         category_id = COALESCE($4, category_id),
         images = COALESCE($5::jsonb, images),
         is_local_handmade = COALESCE($6, is_local_handmade),
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      payload.name ?? null,
      payload.description ?? null,
      payload.price ?? null,
      payload.category_id ?? null,
      payload.images ? JSON.stringify(payload.images) : null,
      payload.is_local_handmade ?? null,
      req.params.id
    ]
  );

  return res.json({ ...updated.rows[0], price: Number(updated.rows[0].price) });
});

app.delete('/api/products/:id', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const exists = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const product = exists.rows[0];
  if (!product) return res.status(404).json({ detail: 'Producto no encontrado' });
  if (req.user.role !== 'admin' && product.seller_id !== req.user.id) {
    return res.status(403).json({ detail: 'Sin permisos' });
  }

  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  return res.json({ ok: true });
});

app.post('/api/favorites/:productId', requireAuth, async (req, res) => {
  await query(
    `INSERT INTO favorites (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [req.user.id, req.params.productId]
  );
  return res.json({ ok: true });
});

app.delete('/api/favorites/:productId', requireAuth, async (req, res) => {
  await query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  return res.json({ ok: true });
});

app.get('/api/favorites', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT p.id
     FROM favorites f
     JOIN products p ON p.id = f.product_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );

  const products = await Promise.all(rows.rows.map((r) => getProductById(r.id, req.user)));
  return res.json(products.filter(Boolean));
});

app.get('/api/history', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT p.id
     FROM history h
     JOIN products p ON p.id = h.product_id
     WHERE h.user_id = $1
     ORDER BY h.viewed_at DESC
     LIMIT 50`,
    [req.user.id]
  );

  const products = await Promise.all(rows.rows.map((r) => getProductById(r.id, req.user)));
  return res.json(products.filter(Boolean));
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  const { product_id, rating, comment } = req.body || {};
  if (!product_id || !rating) return res.status(400).json({ detail: 'Faltan datos para la reseña' });

  const saved = await query(
    `INSERT INTO reviews (id, product_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
     RETURNING *`,
    [uuid(), product_id, req.user.id, Number(rating), comment || null]
  );

  return res.status(201).json(saved.rows[0]);
});

app.post('/api/reports', requireAuth, async (req, res) => {
  const { target_type, target_id, reason, description } = req.body || {};
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ detail: 'Faltan datos del reporte' });
  }

  const created = await query(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [uuid(), req.user.id, target_type, target_id, reason, description || null]
  );
  return res.status(201).json(created.rows[0]);
});

app.get('/api/reports', requireAuth, requireRoles('admin'), async (req, res) => {
  const { status } = req.query;
  const rows = status
    ? await query(
        `SELECT r.*, u.name AS reporter_name
         FROM reports r JOIN users u ON u.id = r.reporter_id
         WHERE r.status = $1
         ORDER BY r.created_at DESC`,
        [status]
      )
    : await query(
        `SELECT r.*, u.name AS reporter_name
         FROM reports r JOIN users u ON u.id = r.reporter_id
         ORDER BY r.created_at DESC`
      );

  return res.json(rows.rows);
});

app.get('/api/reports/my', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC', [req.user.id]);
  return res.json(rows.rows);
});

app.put('/api/reports/:id', requireAuth, requireRoles('admin'), async (req, res) => {
  const { status, admin_notes = '' } = req.query;
  const updated = await query(
    `UPDATE reports
     SET status = COALESCE($1, status), admin_notes = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status || null, admin_notes, req.params.id]
  );
  return res.json(updated.rows[0]);
});

app.get('/api/sellers', requireAuth, async (_req, res) => {
  const rows = await query('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC', ['seller']);
  return res.json(rows.rows.map(toPublicUser));
});

app.get('/api/sellers/:id', requireAuth, async (req, res) => {
  const row = await query('SELECT * FROM users WHERE id = $1 AND role = $2', [req.params.id, 'seller']);
  if (!row.rows[0]) return res.status(404).json({ detail: 'Vendedor no encontrado' });
  return res.json(toPublicUser(row.rows[0]));
});

app.put('/api/seller/profile', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const { business_name, description, schedule, location } = req.body || {};
  const updated = await query(
    `UPDATE users
     SET business_name = COALESCE($1, business_name),
         seller_description = COALESCE($2, seller_description),
         seller_schedule = COALESCE($3, seller_schedule),
         seller_location = COALESCE($4, seller_location)
     WHERE id = $5
     RETURNING *`,
    [business_name ?? null, description ?? null, schedule ?? null, location ?? null, req.user.id]
  );
  return res.json(toPublicUser(updated.rows[0]));
});

app.get('/api/seller/metrics', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const whereSeller = req.user.role === 'admin' && req.query.seller_id ? req.query.seller_id : req.user.id;

  const productsRes = await query('SELECT COUNT(*)::int AS count FROM products WHERE seller_id = $1', [whereSeller]);
  const viewsRes = await query('SELECT COALESCE(SUM(views), 0)::int AS views FROM products WHERE seller_id = $1', [whereSeller]);
  const favoritesRes = await query(
    `SELECT COALESCE(COUNT(f.*), 0)::int AS favorites
     FROM favorites f JOIN products p ON p.id = f.product_id
     WHERE p.seller_id = $1`,
    [whereSeller]
  );
  const reviewsRes = await query(
    `SELECT COALESCE(AVG(r.rating), 0) AS avg, COALESCE(COUNT(r.*), 0)::int AS total
     FROM reviews r JOIN products p ON p.id = r.product_id
     WHERE p.seller_id = $1`,
    [whereSeller]
  );

  return res.json({
    total_products: productsRes.rows[0].count,
    total_views: viewsRes.rows[0].views,
    total_favorites: favoritesRes.rows[0].favorites,
    average_rating: Number(reviewsRes.rows[0].avg || 0).toFixed(1),
    total_reviews: reviewsRes.rows[0].total
  });
});

app.get('/api/admin/stats', requireAuth, requireRoles('admin'), async (_req, res) => {
  const totalUsers = await query('SELECT COUNT(*)::int AS n FROM users');
  const totalSellers = await query('SELECT COUNT(*)::int AS n FROM users WHERE role = $1', ['seller']);
  const totalProducts = await query('SELECT COUNT(*)::int AS n FROM products');
  const pendingReports = await query('SELECT COUNT(*)::int AS n FROM reports WHERE status = $1', ['pending']);

  return res.json({
    total_users: totalUsers.rows[0].n,
    total_sellers: totalSellers.rows[0].n,
    total_products: totalProducts.rows[0].n,
    pending_reports: pendingReports.rows[0].n
  });
});

app.put('/api/admin/products/:id/status', requireAuth, requireRoles('admin'), async (req, res) => {
  const { status } = req.query;
  const updated = await query('UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, req.params.id]);
  return res.json(updated.rows[0]);
});

app.put('/api/admin/products/:id/verify-local', requireAuth, requireRoles('admin'), async (req, res) => {
  const verified = String(req.query.verified) === 'true';
  const updated = await query(
    'UPDATE products SET local_handmade_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [verified, req.params.id]
  );
  return res.json(updated.rows[0]);
});

app.put('/api/admin/products/:id/feature', requireAuth, requireRoles('admin'), async (req, res) => {
  const days = Number(req.query.days || 7);
  const updated = await query(
    `UPDATE products
     SET is_featured = true,
         featured_until = NOW() + ($1::text || ' days')::interval,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [days, req.params.id]
  );
  return res.json(updated.rows[0]);
});

app.put('/api/admin/sellers/:id/status', requireAuth, requireRoles('admin'), async (req, res) => {
  const { status } = req.query;
  const updated = await query('UPDATE users SET status = $1 WHERE id = $2 AND role = $3 RETURNING *', [status, req.params.id, 'seller']);
  return res.json(toPublicUser(updated.rows[0]));
});

app.post('/api/products/:id/feature', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const days = Number(req.query.days || 7);
  const updated = await query(
    `UPDATE products
     SET is_featured = true,
         featured_until = NOW() + ($1::text || ' days')::interval,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [days, req.params.id]
  );
  return res.json(updated.rows[0]);
});

app.post('/api/subscription', requireAuth, requireRoles('seller', 'admin'), async (req, res) => {
  const plan = req.body?.plan || 'free';
  const updated = await query('UPDATE users SET subscription_plan = $1 WHERE id = $2 RETURNING *', [plan, req.user.id]);
  return res.json(toPublicUser(updated.rows[0]));
});

app.post('/api/saved-searches', requireAuth, async (req, res) => {
  const { name, query: q, filters } = req.body || {};
  if (!name) return res.status(400).json({ detail: 'Nombre obligatorio' });

  const created = await query(
    `INSERT INTO saved_searches (id, user_id, name, query, filters)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [uuid(), req.user.id, name, q || '', JSON.stringify(filters || {})]
  );
  return res.status(201).json(created.rows[0]);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ detail: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`API local en http://localhost:${PORT}/api`);
});
