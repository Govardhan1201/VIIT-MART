require('dotenv').config();
const express = require('express');
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
const { createClient } = require('@libsql/client');
const dbFile = process.env.DB_PATH || path.join(__dirname, 'viitmart.db');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${dbFile}`,
  authToken: process.env.TURSO_AUTH_TOKEN
});
console.log('✅ Database Connected →', process.env.TURSO_DATABASE_URL ? 'Cloud (Turso)' : 'Local File');

// Wrapper mapping Turso's API identically to our previous sqlite3 implementation
const db = {
  get: async (sql, params = []) => {
    const args = Array.isArray(params) ? params : [params];
    const rs = await client.execute({ sql, args });
    return rs.rows[0];
  },
  all: async (sql, params = []) => {
    const args = Array.isArray(params) ? params : [params];
    const rs = await client.execute({ sql, args });
    return rs.rows;
  },
  run: async (sql, params = []) => {
    const args = Array.isArray(params) ? params : [params];
    const rs = await client.execute({ sql, args });
    return { lastID: Number(rs.lastInsertRowid), changes: rs.rowsAffected };
  },
  exec: async (sql) => {
    return client.executeMultiple(sql);
  }
};

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
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      reviewer_roll TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'percent',
      value REAL NOT NULL,
      min_order REAL DEFAULT 0,
      max_uses INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_roll TEXT NOT NULL,
      label TEXT NOT NULL,
      hostel TEXT DEFAULT '',
      room TEXT DEFAULT '',
      landmark TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS return_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      buyer_roll TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_roll TEXT NOT NULL,
      user_name TEXT NOT NULL,
      message TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  try { await db.exec("ALTER TABLE products ADD COLUMN images_json TEXT DEFAULT '[]'"); } catch(e) {}
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
      { title: 'Acoustic Guitar – Yamaha F310', cat: 'instruments', cond: 'Good', price: 4500, orig: 8000, qty: 1, desc: 'Well maintained beginner acoustic guitar. Sounds great, minor scratches on back.', img: 'https://images.unsplash.com/photo-1550985543-f47f38aeea53?w=600', loc: 'East Campus', eco: 0, rating: 4.6 },
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

    // Enforce max 1 buyer + 1 seller per roll number
    const existing = await db.all('SELECT role FROM users WHERE roll_number = ?', [rollNumber]);
    if (existing.some(u => u.role === role))
      return res.status(409).json({ error: `A ${role} account already exists for this roll number` });
    if (existing.length >= 2)
      return res.status(409).json({ error: 'Maximum 2 accounts (buyer + seller) allowed per roll number' });

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
    let rows = await db.all(sql, params);
    // Parse images_json for each product
    rows = rows.map(p => ({ ...p, images: tryParseJSON(p.images_json, [p.image_url].filter(Boolean)) }));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function tryParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

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
    const { title, category, condition, price, originalPrice, quantity, description, imageUrl, imageUrls, location } = req.body;
    // Support up to 5 images
    let imagesArr = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      imagesArr = imageUrls.slice(0, 5).filter(Boolean);
    } else if (imageUrl) {
      imagesArr = [imageUrl];
    }
    const primaryImage = imagesArr[0] || '';
    const imagesJson = JSON.stringify(imagesArr);
    const result = await db.run(
      "INSERT INTO products (title,category,condition,price,original_price,quantity,description,image_url,images_json,location,seller_roll,seller_name,seller_phone,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",
      [title, category, condition, price, originalPrice || null, quantity || 1, description, primaryImage, imagesJson, location || '', req.user.rollNumber, req.user.name, req.user.phone]
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

app.delete('/api/products/:id', authenticate, async (req, res) => {
  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (req.user.role === 'admin') {
      await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    } else if (req.user.role === 'seller' && product.seller_roll === req.user.rollNumber) {
      if (product.status === 'approved') return res.status(403).json({ error: 'Cannot delete an active approved listing. Contact admin.' });
      await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    } else {
      return res.status(403).json({ error: 'Not authorised' });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
      // Auto-delete product when stock hits 0
      const updatedProd = await db.get('SELECT quantity FROM products WHERE id = ?', [product.id]);
      if (updatedProd && updatedProd.quantity <= 0) {
        await db.run('DELETE FROM products WHERE id = ?', [product.id]);
      }
      // Increment coupon usage if coupon code was applied in this order item
      if (item.couponCode) {
        await db.run("UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND is_active = 1", [item.couponCode.toUpperCase()]);
      }
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


// ─── ADMIN STATS & ANALYTICS ──────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const users = await db.get("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
    const products = await db.get("SELECT COUNT(*) as count FROM products WHERE status = 'approved'");
    const pendingProducts = await db.get("SELECT COUNT(*) as count FROM products WHERE status = 'pending'");
    const orders = await db.get("SELECT COUNT(*) as count FROM orders");
    const pendingOrders = await db.get("SELECT COUNT(*) as count FROM orders WHERE status != 'completed' AND status != 'cancelled'");
    const earnings = await db.get("SELECT * FROM earnings WHERE id = 1");

    res.json({
      users: users ? users.count : 0,
      products: products ? products.count : 0,
      pendingProducts: pendingProducts ? pendingProducts.count : 0,
      orders: orders ? orders.count : 0,
      pendingOrders: pendingOrders ? pendingOrders.count : 0,
      earnings: earnings || { total:0, listing_fees:0, service_fees:0, extra_charges:0 }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const totalRevRow = await db.get("SELECT total FROM earnings WHERE id=1");
    const totalOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders");
    const topProducts = await db.all("SELECT product_title as title, COUNT(id) as orders, SUM(total_paid) as revenue FROM orders GROUP BY product_id ORDER BY orders DESC LIMIT 5");
    const statusFunnel = await db.all("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
    const categorySales = await db.all("SELECT p.category, COUNT(o.id) as count, SUM(o.total_paid) as revenue FROM orders o JOIN products p ON o.product_id = p.id GROUP BY p.category ORDER BY count DESC");

    res.json({
      totalRevenue: totalRevRow ? totalRevRow.total : 0,
      totalOrders: totalOrdersRow ? totalOrdersRow.count : 0,
      topProducts,
      statusFunnel,
      categorySales
    });
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
  // Factory reset removed per policy
  res.status(410).json({ error: 'Factory reset is disabled' });
});

// ─── ADMIN: Promote individual user year ──────────────────────────────────────
app.put('/api/admin/users/:roll/year', requireAdmin, async (req, res) => {
  try {
    const { year } = req.body;
    if (!year) return res.status(400).json({ error: 'Year required' });
    await db.run('UPDATE users SET year = ? WHERE roll_number = ?', [String(year), req.params.roll]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: Bulk promote all students one year forward ────────────────────────
app.put('/api/admin/promote-all-years', requireAdmin, async (req, res) => {
  try {
    await db.run("UPDATE users SET year = CAST(MIN(CAST(year AS INTEGER)+1,4) AS TEXT) WHERE role!='admin' AND CAST(year AS INTEGER) BETWEEN 1 AND 3");
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

// ─── REVIEWS ──────────────────────────────────────────────────────────────────
app.get('/api/reviews/:productId', async (req, res) => {
  try { res.json(await db.all('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reviews', authenticate, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    if (!productId || !rating) return res.status(400).json({ error: 'Product ID and rating required' });
    const existing = await db.get('SELECT id FROM reviews WHERE product_id = ? AND reviewer_roll = ?', [productId, req.user.rollNumber]);
    if (existing) {
      await db.run('UPDATE reviews SET rating=?, comment=?, created_at=datetime("now") WHERE product_id=? AND reviewer_roll=?', [rating, comment || '', productId, req.user.rollNumber]);
    } else {
      await db.run('INSERT INTO reviews (product_id,reviewer_roll,reviewer_name,rating,comment) VALUES (?,?,?,?,?)', [productId, req.user.rollNumber, req.user.name, rating, comment || '']);
    }
    const avg = await db.get('SELECT AVG(rating) as avg FROM reviews WHERE product_id = ?', [productId]);
    if (avg && avg.avg) await db.run('UPDATE products SET rating = ? WHERE id = ?', [parseFloat(avg.avg.toFixed(1)), productId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete a review (for moderation)
app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try { await db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: fetch all reviews across the platform
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const reviews = await db.all(`
      SELECT r.*, p.title as product_title 
      FROM reviews r 
      JOIN products p ON r.product_id = p.id 
      ORDER BY r.created_at DESC
    `);
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Lookup: auto-fill registration info from existing roll ─────────────────
app.get('/api/lookup/:roll', async (req, res) => {
  try {
    const user = await db.get('SELECT name, branch, year, phone FROM users WHERE roll_number = ?', [req.params.roll]);
    res.json(user || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── COUPONS ──────────────────────────────────────────────────────────────────
app.get('/api/coupons', requireAdmin, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM coupons ORDER BY created_at DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/coupons', requireAdmin, async (req, res) => {
  try {
    const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
    if (!code || !value) return res.status(400).json({ error: 'Code and value required' });
    await db.run('INSERT INTO coupons (code,type,value,min_order,max_uses,expires_at) VALUES (?,?,?,?,?,?)',
      [code.toUpperCase(), type || 'percent', value, minOrder || 0, maxUses || 100, expiresAt || null]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message || 'Coupon code already exists' }); }
});

app.delete('/api/coupons/:id', requireAdmin, async (req, res) => {
  try { await db.run('DELETE FROM coupons WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, total } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });
    const coupon = await db.get("SELECT * FROM coupons WHERE code = ? AND is_active = 1", [code.toUpperCase()]);
    if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'Coupon has expired' });
    if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (total < coupon.min_order) return res.status(400).json({ error: `Minimum order of ₹${coupon.min_order} required` });
    const discount = coupon.type === 'percent' ? Math.round((total * coupon.value) / 100) : coupon.value;
    const finalDiscount = Math.min(discount, total);
    res.json({ success: true, discount: finalDiscount, type: coupon.type, value: coupon.value, code: coupon.code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADDRESSES ────────────────────────────────────────────────────────────────
app.get('/api/addresses', authenticate, async (req, res) => {
  try { res.json(await db.all('SELECT * FROM addresses WHERE user_roll = ? ORDER BY is_default DESC, created_at DESC', [req.user.rollNumber])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/addresses', authenticate, async (req, res) => {
  try {
    const { label, hostel, room, landmark, isDefault } = req.body;
    if (!label) return res.status(400).json({ error: 'Label required' });
    if (isDefault) await db.run('UPDATE addresses SET is_default=0 WHERE user_roll=?', [req.user.rollNumber]);
    const result = await db.run('INSERT INTO addresses (user_roll,label,hostel,room,landmark,is_default) VALUES (?,?,?,?,?,?)',
      [req.user.rollNumber, label, hostel || '', room || '', landmark || '', isDefault ? 1 : 0]);
    res.json({ id: result.lastID, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/addresses/:id', authenticate, async (req, res) => {
  try { await db.run('DELETE FROM addresses WHERE id = ? AND user_roll = ?', [req.params.id, req.user.rollNumber]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/addresses/:id/default', authenticate, async (req, res) => {
  try {
    await db.run('UPDATE addresses SET is_default=0 WHERE user_roll=?', [req.user.rollNumber]);
    await db.run('UPDATE addresses SET is_default=1 WHERE id=? AND user_roll=?', [req.params.id, req.user.rollNumber]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RETURN REQUESTS (disabled – no returns policy) ──────────────────────────

// ─── HELPDESK (renamed from Live Chat) ───────────────────────────────────────
// Admin: get all users who contacted helpdesk grouped by roll number
app.get('/api/chat/users', requireAdmin, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT user_roll, user_name, MAX(created_at) as last_message,
             COUNT(CASE WHEN is_admin=0 THEN 1 END) as user_messages
      FROM chat_messages
      WHERE is_admin = 0
      GROUP BY user_roll
      ORDER BY last_message DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/chat', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const msgs = isAdmin
      ? await db.all('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100')
      : await db.all('SELECT * FROM chat_messages WHERE user_roll = ? OR is_admin = 1 ORDER BY created_at ASC LIMIT 100', [req.user.rollNumber]);
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat', authenticate, async (req, res) => {
  try {
    const { message, targetRoll } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const isAdmin = req.user.role === 'admin';
    const roll = isAdmin && targetRoll ? targetRoll : req.user.rollNumber;
    const result = await db.run('INSERT INTO chat_messages (user_roll,user_name,message,is_admin) VALUES (?,?,?,?)',
      [roll, req.user.name, message, isAdmin ? 1 : 0]);
    res.json({ success: true, id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/chat/:id', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    if (isAdmin) {
      await db.run('DELETE FROM chat_messages WHERE id = ?', [req.params.id]);
    } else {
      await db.run('DELETE FROM chat_messages WHERE id = ? AND user_roll = ? AND is_admin = 0', [req.params.id, req.user.rollNumber]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat/admin-reply', requireAdmin, async (req, res) => {
  try {
    const { targetRoll, message } = req.body;
    if (!targetRoll || !message) return res.status(400).json({ error: 'Roll and message required' });
    await db.run('INSERT INTO chat_messages (user_roll,user_name,message,is_admin) VALUES (?,?,?,?)',
      [targetRoll, req.user.name, message, 1]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BEST SELLERS (sorted by order count) ────────────────────────────────────
app.get('/api/products/bestsellers', async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.*, COUNT(o.id) as order_count
      FROM products p LEFT JOIN orders o ON p.id = o.product_id
      WHERE p.status = 'approved'
      GROUP BY p.id ORDER BY order_count DESC, p.rating DESC LIMIT 8`);
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Static File Serving ──────────────────────────────────────────────────────
const pages = ['index', 'shop', 'login', 'register', 'buyer', 'seller'];
pages.forEach(p => {
  app.get(`/${p === 'index' ? '' : p}`, (req, res) =>
    res.sendFile(path.join(__dirname, p === 'index' ? 'index.html' : `${p}.html`)));
});
// Admin portal accessible only at hidden URL — not linked publicly
app.get('/viitmart-admin-portal', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ─── Start ────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎓 VIIT Mart is LIVE at http://localhost:${PORT}`);
    console.log(`   → Home:   http://localhost:${PORT}/`);
    console.log(`   → Shop:   http://localhost:${PORT}/shop`);
    console.log(`   → Admin:  http://localhost:${PORT}/viitmart-admin-portal`);
    console.log(`\n   Admin credentials: Secret=ADMIN2025 | Password=Admin123\n`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});
