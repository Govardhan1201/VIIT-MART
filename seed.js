const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFile = path.join(__dirname, 'nirvanamart.db');
const rawDb = new sqlite3.Database(dbFile, (err) => {
  if (err) { console.error('DB open error:', err.message); process.exit(1); }
  console.log('✅ SQLite connected for seeding →', dbFile);
});

const db = {
  run: (sql, params = []) => new Promise((res, rej) =>
    rawDb.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); })),
  get: (sql, params = []) => new Promise((res, rej) =>
    rawDb.get(sql, params, (err, row) => err ? rej(err) : res(row)))
};

async function seedData() {
  try {
    const adminHash = await bcrypt.hash('Admin123', 10);
    const sellerHash = await bcrypt.hash('Demo@123', 10);
    const buyerHash = await bcrypt.hash('Demo@123', 10);

    console.log('Creating Admin Account...');
    await db.run('INSERT OR IGNORE INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
      ['Admin', 'ADMIN001', 'Admin', '0', '0000000000', 'admin@nirvanamart.com', adminHash, 'admin']);

    console.log('Creating Seller Account (Demo Seller | DEMO001 | 9000000001)...');
    await db.run('INSERT OR IGNORE INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
      ['Demo Seller', 'DEMO001', 'CSE', '3', '9000000001', 'demo.seller@viit.ac.in', sellerHash, 'seller']);

    console.log('Creating Buyer Account (Demo Buyer | 22VIIT001 | 9000000002)...');
    await db.run('INSERT OR IGNORE INTO users (name,roll_number,branch,year,phone,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)',
      ['Demo Buyer', '22VIIT001', 'IT', '2', '9000000002', 'demo.buyer@viit.ac.in', buyerHash, 'buyer']);

    console.log('Done ✅. Login credentials:');
    console.log('  Admin Code: ADMIN2025 | Password: Admin123');
    console.log('  Seller Roll: DEMO001  | Phone: 9000000001 | Password: Demo@123');
    console.log('  Buyer Roll: 22VIIT001 | Phone: 9000000002 | Password: Demo@123');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    rawDb.close();
  }
}

seedData();
