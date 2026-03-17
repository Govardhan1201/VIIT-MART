require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'viitmart-secret';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ADMIN2025';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ─── Database Setup ───────────────────────────────────────────────────────────
const dbFile = path.join(__dirname, 'viitmart.db');
const rawDb = new sqlite3.Database(dbFile, (err) => {
  if (err) { console.error('DB open error:', err.message); process.exit(1); }
  console.log('✅ SQLite connected →', dbFile);
});

// Promise wrappers
const db = {
  run: (sql, params = []) => new Promise((res, rej) =>
    rawDb.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); })),
  get: (sql, params = []) => new Promise((res, rej) =>
    rawDb.get(sql, params, (err, row) => err ? rej(err) : res(row))),
  all: (sql, params = []) => new Promise((res, rej) =>
    rawDb.all(sql, params, (err, rows) => err ? rej(err) : res(rows))),
  exec: (sql) => new Promise((res, rej) =>
    rawDb.exec(sql, (err) => err ? rej(err) : res())),
};

// Enable WAL mode for performance
rawDb.run('PRAGMA journal_mode=WAL');

async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      roll_number TEXT UNIQUE NOT NULL,
      branch TEXT NOT NULL,
      year TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      registered_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      condition TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      quantity INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      location TEXT DEFAULT '',
      seller_roll TEXT NOT NULL,
      seller_name TEXT NOT NULL,
      seller_phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      listing_fee REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      platform_charge REAL DEFAULT 0,
      eco INTEGER DEFAULT 0,
      rating REAL DEFAULT 4.5,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      product_id INTEGER,
      product_title TEXT,
      product_image TEXT DEFAULT '',
      buyer_roll TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      seller_roll TEXT NOT NULL,
      seller_name TEXT NOT NULL,
      seller_phone TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      product_price REAL NOT NULL,
      service_fee REAL DEFAULT 0,
      platform_charge REAL DEFAULT 0,
      total_paid REAL NOT NULL,
      listing_fee REAL DEFAULT 15,
      seller_payout REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      ordered_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_roll TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS earnings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      listing_fees REAL DEFAULT 0,
      service_fees REAL DEFAULT 0,
      extra_charges REAL DEFAULT 0,
      total REAL DEFAULT 0
    );
  `);
  await db.run('INSERT OR IGNORE INTO earnings (id) VALUES (1)');

  // Seed sample products on first run
  const count = await db.get('SELECT COUNT(*) as cnt FROM products');
  if (count.cnt === 0) {
    await db.run(
      'INSERT OR IGNORE INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
      ['Demo Seller', 'DEMO001', 'CSE', '3', '9000000001', 'demo@viit.ac.in', await bcrypt.hash('Demo@123', 10), 'seller']
    );
    const samples = [
      { title: 'MacBook Pro M1 – Excellent Condition', cat: 'electronics', cond: 'Like New', price: 85000, orig: 120000, qty: 1, desc: 'MacBook Pro M1 chip with 8GB RAM and 256GB SSD. Barely used for 6 months. All accessories included.', img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600', loc: 'North Campus', eco: 0, rating: 4.8 },
      { title: 'Engineering Mathematics Textbook Set', cat: 'books', cond: 'Good', price: 800, orig: 2500, qty: 3, desc: 'Complete set of Engineering Mathematics books for 1st year. All volumes included.', img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600', loc: 'South Campus', eco: 1, rating: 5.0 },
      { title: 'Gaming Chair – Almost New', cat: 'furniture', cond: 'Like New', price: 8500, orig: 15000, qty: 1, desc: 'Ergonomic gaming chair with lumbar support. Used only 3 months.', img: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=600', loc: 'East Campus', eco: 0, rating: 4.6 },
      { title: 'Branded College Backpack', cat: 'fashion', cond: 'Good', price: 1200, orig: 2500, qty: 2, desc: 'Spacious backpack perfect for college with laptop compartment.', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600', loc: 'West Campus', eco: 1, rating: 4.9 },
      { title: 'JBL Bluetooth Speaker', cat: 'electronics', cond: 'Like New', price: 2800, orig: 5000, qty: 1, desc: 'JBL Flip 5 – waterproof, powerful bass, 12hr battery. Includes original box.', img: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600', loc: 'Main Building', eco: 0, rating: 4.7 },
      { title: 'Data Structures & Algorithms Books', cat: 'books', cond: 'New', price: 600, orig: 1200, qty: 5, desc: 'Set of 3 DSA books – Cormen, Sedgewick, and Skiena. Perfect for placements.', img: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600', loc: 'Library Block', eco: 1, rating: 4.8 },
      { title: 'Cricket Kit – Full Set', cat: 'sports', cond: 'Good', price: 3500, orig: 7000, qty: 1, desc: 'Complete cricket kit: bat, pads, gloves, helmet. Used one season.', img: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600', loc: 'Sports Ground', eco: 0, rating: 4.5 },
      { title: 'Web Dev Tutoring Service', cat: 'services', cond: 'New', price: 500, orig: null, qty: 10, desc: 'Expert tutoring for HTML, CSS, JS, React. 2 hours/session. Flexible timings.', img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600', loc: 'Online/Campus', eco: 0, rating: 4.9 }
    ];
    for (const p of samples) {
      await db.run(
        'INSERT INTO products (title,category,condition,price,original_price,quantity,description,image_url,location,seller_roll,seller_name,seller_phone,status,eco,rating) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [p.title, p.cat, p.cond, p.price, p.orig, p.qty, p.desc, p.img, p.loc, 'DEMO001', 'Demo Seller', '9000000001', 'approved', p.eco, p.rating]
      );
    }
    console.log('✅ Sample products seeded');
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, rollNumber, branch, year, phone, email, password, role } = req.body;
    if (!name || !rollNumber || !branch || !year || !phone || !password || !role)
      return res.status(400).json({ error: 'All required fields must be filled' });
    if (role === 'admin') return res.status(403).json({ error: 'Admin registration not allowed' });

    const existing = await db.get('SELECT id FROM users WHERE roll_number = ?', [rollNumber]);
    if (existing) return res.status(409).json({ error: 'Roll number already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
      [name, rollNumber, branch, year, phone, email || '', hash, role]
    );
    const user = { id: result.lastID, name, rollNumber, branch, year, phone, email: email || '', role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { rollNumber, phone, password, role } = req.body;
    const dbUser = await db.get('SELECT * FROM users WHERE roll_number = ? AND phone = ? AND role = ?', [rollNumber, phone, role]);
    if (!dbUser) return res.status(401).json({ error: 'Invalid credentials. Check roll number, phone, password and role.' });

    const valid = await bcrypt.compare(password, dbUser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const user = { id: dbUser.id, name: dbUser.name, rollNumber: dbUser.roll_number, branch: dbUser.branch, year: dbUser.year, phone: dbUser.phone, email: dbUser.email, role: dbUser.role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { secretCode, password } = req.body;
    if (secretCode !== ADMIN_SECRET || password !== ADMIN_PASSWORD)
      return res.status(401).json({ error: 'Invalid admin credentials' });

    let adminUser = await db.get("SELECT * FROM users WHERE role = 'admin'");
    if (!adminUser) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      const result = await db.run(
        'INSERT INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
        ['Admin', 'ADMIN001', 'Admin', '0', '0000000000', 'admin@viitmart.com', hash, 'admin']
      );
      adminUser = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }
    const user = { id: adminUser.id, name: adminUser.name, rollNumber: adminUser.roll_number, phone: adminUser.phone, email: adminUser.email, role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { rollNumber, phone, newPassword } = req.body;
    const user = await db.get('SELECT id FROM users WHERE roll_number = ? AND phone = ?', [rollNumber, phone]);
    if (!user) return res.status(404).json({ error: 'No account found with that roll number and phone' });
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await db.run('UPDATE users SET password_hash = ? WHERE roll_number = ?', [hash, rollNumber]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCT ROUTES ───────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = "SELECT * FROM products WHERE status = 'approved'";
    const params = [];
    if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
    if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC';
    res.json(await db.all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/pending', requireAdmin, async (req, res) => {
  try { res.json(await db.all("SELECT * FROM products WHERE status = 'pending' ORDER BY created_at DESC")); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/mine', authenticate, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM products WHERE seller_roll = ? ORDER BY created_at DESC', [req.user.rollNumber])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/all', requireAdmin, async (req, res) => {
  try { res.json(await db.all("SELECT * FROM products WHERE status = 'approved' ORDER BY created_at DESC")); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'seller') return res.status(403).json({ error: 'Only sellers can list products' });
    const { title, category, condition, price, originalPrice, quantity, description, imageUrl, location } = req.body;
    const result = await db.run(
      "INSERT INTO products (title,category,condition,price,original_price,quantity,description,image_url,location,seller_roll,seller_name,seller_phone,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')",
      [title, category, condition, price, originalPrice || null, quantity || 1, description, imageUrl || '', location || '', req.user.rollNumber, req.user.name, req.user.phone]
    );
    const admin = await db.get("SELECT roll_number FROM users WHERE role = 'admin'");
    if (admin) await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)', [admin.roll_number, '🆕 New Product Pending', `"${title}" by ${req.user.name} needs approval`]);
    res.json({ id: result.lastID, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { listingFee = 0, serviceFee = 0, platformCharge = 0 } = req.body;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await db.run("UPDATE products SET status='approved', listing_fee=?, service_fee=?, platform_charge=? WHERE id=?",
      [listingFee, serviceFee, platformCharge, req.params.id]);
    const totalEarned = Number(listingFee) + Number(serviceFee) + Number(platformCharge);
    await db.run('UPDATE earnings SET listing_fees=listing_fees+?, service_fees=service_fees+?, extra_charges=extra_charges+?, total=total+? WHERE id=1',
      [listingFee, serviceFee, platformCharge, totalEarned]);
    await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
      [product.seller_roll, '✅ Product Approved!', `Your product "${product.title}" is now live on the marketplace!`]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id/reject', requireAdmin, async (req, res) => {
  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await db.run("UPDATE products SET status='rejected' WHERE id=?", [req.params.id]);
    await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
      [product.seller_roll, '❌ Product Rejected', `"${product.title}" was not approved. Review and resubmit.`]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try { await db.run('DELETE FROM products WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ORDER ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/orders/mine', authenticate, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM orders WHERE buyer_roll = ? ORDER BY ordered_at DESC', [req.user.rollNumber])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/received', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });
    res.json(await db.all('SELECT * FROM orders WHERE seller_roll = ? ORDER BY ordered_at DESC', [req.user.rollNumber]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/all', requireAdmin, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM orders ORDER BY ordered_at DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'seller') return res.status(403).json({ error: 'Sellers cannot place orders' });
    const { items, paymentMethod } = req.body;
    const LISTING_FEE = 15;
    const createdOrders = [];
    const admin = await db.get("SELECT roll_number FROM users WHERE role = 'admin'");

    for (const item of items) {
      const product = await db.get('SELECT * FROM products WHERE id = ? AND status = ?', [item.id, 'approved']);
      if (!product) continue;

      const serviceFee = calcServiceFee(product.price);
      const platformCharge = product.platform_charge || 0;
      const totalPaid = product.price + serviceFee + platformCharge;
      const sellerPayout = Math.max(0, product.price - LISTING_FEE);
      const orderId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      await db.run(
        "INSERT INTO orders (id,product_id,product_title,product_image,buyer_roll,buyer_name,buyer_phone,seller_roll,seller_name,seller_phone,payment_method,product_price,service_fee,platform_charge,total_paid,listing_fee,seller_payout,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",
        [orderId, product.id, product.title, product.image_url, req.user.rollNumber, req.user.name, req.user.phone, product.seller_roll, product.seller_name, product.seller_phone, paymentMethod, product.price, serviceFee, platformCharge, totalPaid, LISTING_FEE, sellerPayout]
      );
      await db.run('UPDATE products SET quantity = MAX(0, quantity - 1) WHERE id = ?', [product.id]);
      await db.run("UPDATE products SET status = 'sold' WHERE id = ? AND quantity <= 0", [product.id]);
      await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
        [product.seller_roll, '🛒 New Order!', `Someone ordered your "${product.title}". Check your dashboard.`]);
      if (admin) await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
        [admin.roll_number, '📦 New Order', `${req.user.name} ordered "${product.title}" (₹${totalPaid})`]);
      await db.run('UPDATE earnings SET service_fees=service_fees+?, listing_fees=listing_fees+?, total=total+? WHERE id=1',
        [serviceFee, LISTING_FEE, serviceFee + LISTING_FEE]);
      createdOrders.push(orderId);
    }
    await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
      [req.user.rollNumber, '✅ Order Placed!', `Your order has been placed successfully and is pending seller confirmation.`]);
    res.json({ success: true, orderIds: createdOrders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    await db.run('INSERT INTO notifications (user_roll,title,message) VALUES (?,?,?)',
      [order.buyer_roll, '📬 Order Update', `Your order "${order.product_title}" status changed to: ${status.replace(/-/g, ' ')}`]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', authenticate, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM notifications WHERE user_roll = ? ORDER BY created_at DESC LIMIT 50', [req.user.rollNumber])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read', authenticate, async (req, res) => {
  try { await db.run('UPDATE notifications SET is_read = 1 WHERE user_roll = ?', [req.user.rollNumber]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [users, products, pendingProducts, orders, pendingOrders, earnings] = await Promise.all([
      db.get('SELECT COUNT(*) as cnt FROM users'),
      db.get("SELECT COUNT(*) as cnt FROM products WHERE status = 'approved'"),
      db.get("SELECT COUNT(*) as cnt FROM products WHERE status = 'pending'"),
      db.get('SELECT COUNT(*) as cnt FROM orders'),
      db.get("SELECT COUNT(*) as cnt FROM orders WHERE status != 'completed' AND status != 'cancelled'"),
      db.get('SELECT * FROM earnings WHERE id = 1'),
    ]);
    res.json({ users: users.cnt, products: products.cnt, pendingProducts: pendingProducts.cnt, orders: orders.cnt, pendingOrders: pendingOrders.cnt, earnings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { res.json(await db.all('SELECT id,name,roll_number,branch,year,phone,email,role,registered_at FROM users ORDER BY registered_at DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:roll', requireAdmin, async (req, res) => {
  try {
    if (req.params.roll === req.user.rollNumber) return res.status(400).json({ error: 'Cannot delete yourself' });
    await db.run('DELETE FROM users WHERE roll_number = ?', [req.params.roll]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reset', requireAdmin, async (req, res) => {
  try {
    await db.exec(`
      DELETE FROM orders;
      DELETE FROM notifications;
      DELETE FROM products;
      DELETE FROM users WHERE role != 'admin';
    `);
    await db.run('UPDATE earnings SET listing_fees=0, service_fees=0, extra_charges=0, total=0 WHERE id=1');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcServiceFee(price) {
  if (price <= 500) return Math.max(20, Math.round(price * 0.05));
  if (price <= 2000) return Math.round(price * 0.05);
  if (price <= 10000) return Math.round(price * 0.04);
  if (price <= 30000) return Math.round(price * 0.03);
  return Math.min(1000, Math.round(price * 0.02));
}

// ─── Static File Serving ──────────────────────────────────────────────────────
const pages = ['index', 'shop', 'login', 'register', 'buyer', 'seller', 'admin'];
pages.forEach(p => {
  app.get(`/${p === 'index' ? '' : p}`, (req, res) =>
    res.sendFile(path.join(__dirname, p === 'index' ? 'index.html' : `${p}.html`)));
});

// ─── Start ────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎓 VIIT Mart is LIVE at http://localhost:${PORT}`);
    console.log(`   → Home:     http://localhost:${PORT}/`);
    console.log(`   → Shop:     http://localhost:${PORT}/shop`);
    console.log(`   → Admin:    http://localhost:${PORT}/admin`);
    console.log(`\n   Admin credentials: Secret=ADMIN2025 | Password=Admin123\n`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});
