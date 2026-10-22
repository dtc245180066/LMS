const mysql = require('mysql2/promise');
const path = require('path');

// Đọc file .env nếu chạy ở môi trường ngoài Docker
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Tạo chùm dây kết nối MySQL (Connection Pool) hoàn toàn qua Biến Môi Trường
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306, // 3306 là cổng chuẩn quốc tế của MySQL
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Xuất khẩu để các file khác có thể dùng chung
module.exports = db;