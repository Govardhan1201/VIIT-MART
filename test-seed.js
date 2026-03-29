// test-seeder.js
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./nirvanamart.db');

async function seed() {
  const hash = await bcrypt.hash('Buyer@123', 10);
  // Add a test buyer if not exists
  db.run("INSERT OR IGNORE INTO users (id, name, roll_number, branch, year, phone, email, password_hash, role) VALUES (2, 'Test Buyer', 'TEST001', 'IT', '3', '9876543210', 'buyer@test.com', ?, 'buyer')", [hash], function() {
    console.log("Buyer created");
    
    // Create random completed orders
    const productId = 1;
    for (let i = 0; i < 15; i++) {
        const orderId = 'ORD' + Date.now() + i;
        const total = Math.floor(Math.random() * 5000) + 100;
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 120)); // spread over last 4 months
        
        db.run(`INSERT INTO orders (id, product_id, product_title, buyer_roll, buyer_name, buyer_phone, seller_roll, seller_name, seller_phone, payment_method, product_price, total_paid, seller_payout, status, ordered_at) 
                VALUES (?, ?, 'MacBook Pro M1', 'TEST001', 'Test Buyer', '9876543210', 'DEMO001', 'Demo Seller', '9000000001', 'cash', ?, ?, ?, 'completed', ?)`,
            [orderId, productId, total, total + 50, total - 15, date.toISOString()]
        );
    }
    
    // Create random notifications
    for (let i = 0; i < 5; i++) {
        db.run("INSERT INTO notifications (user_roll, title, message, is_read) VALUES ('TEST001', 'Test Notif', 'This is a test notification ' + " + i + ", 0)");
    }
    
    setTimeout(() => {
        db.close();
        console.log("Seeding complete. Use roll: TEST001, pass: Buyer@123");
    }, 1000);
  });
}
seed();
