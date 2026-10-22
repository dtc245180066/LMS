// Chiếc lưới hứng lỗi tập trung của ứng dụng
function errorHandler(err, req, res, next) {
  // 1. In chi tiết lỗi ra màn hình terminal của lập trình viên để sửa
  console.error('[HỆ THỐNG GẶP LỖI]:', err.stack || err.message);

  // 2. Trả về trang lỗi chuẩn giao diện EJS của hệ thống
  const statusCode = err.statusCode || err.status || 500;
  try {
    res.status(statusCode).render('error', {
      title: `${statusCode} - Sự Cố Kỹ Thuật`,
      message: err.userMessage || 'Hệ thống đang gặp trục trặc kỹ thuật. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.'
    });
  } catch (renderErr) {
    res.status(statusCode).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #dc3545;">⚠️ Đã xảy ra sự cố!</h2>
        <p style="color: #6c757d;">Hệ thống đang gặp trục trặc kỹ thuật. Vui lòng thử lại sau ít phút.</p>
        <a href="/" style="display: inline-block; padding: 10px 20px; background: #0d6efd; color: white; text-decoration: none; border-radius: 5px;">Quay về Trang chủ</a>
      </div>
    `);
  }
}

module.exports = errorHandler;
