const db = require('../config/db');

/**
 * Ghi lại nhật ký hoạt động của người dùng vào cơ sở dữ liệu
 * @param {number|null} userId - ID người dùng thực hiện (hoặc null nếu là khách)
 * @param {string} action - Mô tả hành động
 */
async function logActivity(userId, action) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId || null, action]
    );
  } catch (err) {
    console.error('⚠️ Không thể ghi activity_log:', err.message);
  }
}

module.exports = { logActivity };
