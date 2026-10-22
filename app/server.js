const path = require('path');
const fs = require('fs');
// 1. Đọc file .env ở thư mục gốc
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const client = require('prom-client');
const db = require('./src/config/db'); // Dùng pool kết nối chuẩn từ db.js

// Tạo thư mục logs nếu chưa tồn tại
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Khởi tạo Prometheus Registry & Default Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'lms_' });

// Khởi tạo các Custom Metrics đo đạc HTTP
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'lms_http_request_duration_seconds',
  help: 'Thời gian phản hồi HTTP request tính bằng giây',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new client.Counter({
  name: 'lms_http_requests_total',
  help: 'Tổng số lượt HTTP requests đến hệ thống',
  labelNames: ['method', 'route', 'status_code']
});

// Metric đếm số lần đăng nhập thất bại (Dùng để phát hiện Brute-force & Alerting)
const authFailedTotal = new client.Counter({
  name: 'lms_auth_failed_total',
  help: 'Tổng số lần đăng nhập thất bại (Security Brute-force Detection)',
  labelNames: ['username']
});

// Import các Router và Middleware
const authRouter = require('./src/routes/auth.routes');
const studentRouter = require('./src/routes/student.routes');
const instructorRouter = require('./src/routes/instructor.routes');
const adminRouter = require('./src/routes/admin.routes');

const { isAuthenticated } = require('./src/middlewares/auth');
const errorHandler = require('./src/middlewares/errorHandler');
const setCurrentUser = require('./src/middlewares/viewLocals');
const { getPagination } = require('./src/utils/pagination');

const app = express();
app.locals.authFailedTotal = authFailedTotal;
const PORT = process.env.APP_PORT || 3000;

// 2. Cấu hình giao diện EJS và thư mục tĩnh (Static Files)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Phục vụ Favicon chuẩn cho mọi trình duyệt
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/favicon.svg'));
});

// 3. Middlewares phân tích dữ liệu gửi lên
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 3.1. Middleware tự động đo thời gian phản hồi và số lượng requests cho Prometheus & ghi log cho Loki
app.use((req, res, next) => {
  if (req.path === '/metrics') return next(); // Không đo chính trang metrics
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route: route, status_code: res.statusCode });
    httpRequestDurationMicroseconds.observe({ method: req.method, route: route, status_code: res.statusCode }, durationInSeconds);

    // Ghi nhật ký tập trung ra file cho Promtail thu gom đẩy về Loki
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    const logLine = `[${new Date().toISOString()}] ${logLevel} [HTTP] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${(durationInSeconds * 1000).toFixed(1)}ms ip=${clientIp}\n`;
    fs.appendFile(path.join(logDir, 'app.log'), logLine, () => {});
  });
  next();
});

// Endpoint chuẩn Prometheus để Scraper kéo dữ liệu
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// 4. Cấu hình Session (Quản lý phiên đăng nhập)
app.use(session({
  secret: process.env.SESSION_SECRET || 'lms_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Để false khi test ở môi trường phát triển (chưa có HTTPS)
    maxAge: 24 * 60 * 60 * 1000 // Phiên đăng nhập tồn tại 1 ngày
  }
}));

// 5. Middleware gắn thông tin người dùng vào giao diện
app.use(setCurrentUser);

// ==================== CÁC ĐƯỜNG DẪN (ROUTES) ====================

// Đường dẫn mặc định: Điều hướng thông minh theo vai trò
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  if (req.session.user.role === 'instructor') {
    return res.redirect('/instructor/dashboard');
  }
  return res.redirect('/student/dashboard');
});

// Gắn các nhánh chức năng chuyên biệt theo vai trò
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/student', studentRouter);
app.use('/instructor', instructorRouter);
app.use('/admin', adminRouter);

// Trang danh mục tất cả khóa học (Yêu cầu phải đăng nhập, hỗ trợ tìm kiếm & phân trang)
app.get('/courses', isAuthenticated, async (req, res, next) => {
  try {
    const isAdmin = req.session.user && req.session.user.role === 'admin';
    const currentUserId = req.session.user ? req.session.user.id : 0;
    const search = req.query.search ? req.query.search.trim() : '';

    let whereClause = isAdmin ? 'WHERE 1=1' : "WHERE c.status = 'published'";
    const countParams = [];

    if (search) {
      whereClause += ' AND (c.title LIKE ? OR c.description LIKE ? OR u.full_name LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = `
      SELECT COUNT(*) AS totalItems 
      FROM courses c 
      JOIN users u ON c.instructor_id = u.id 
      ${whereClause}
    `;
    
    const [[{ totalItems }]] = await db.query(countSql, countParams);
    const limit = 6; // 6 khóa học trên 1 trang
    const pagination = getPagination(req.query.page, limit, totalItems);

    const querySql = `
      SELECT c.*, u.full_name AS instructor_name,
             (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
             (SELECT status FROM enrollments WHERE user_id = ? AND course_id = c.id) AS enrollment_status
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [currentUserId, ...countParams, pagination.limit, pagination.offset];
    const [courses] = await db.query(querySql, queryParams);

    let message = null;
    let messageType = 'success';
    if (req.query.enrolled === 'success' || req.query.enrolled === 'pending') {
      message = 'Ghi danh khóa học thành công! Yêu cầu của bạn đang chờ Giảng viên phê duyệt để bắt đầu học.';
      messageType = 'success';
    }

    res.render('student/courses', { 
      courses, 
      pagination, 
      search,
      message, 
      messageType 
    });
  } catch (err) {
    next(err);
  }
});

// Trang chi tiết khóa học và danh mục bài học (Yêu cầu phải đăng nhập)
app.get('/courses/:id', isAuthenticated, async (req, res, next) => {
  try {
    const courseId = req.params.id;

    // Nếu là Quản trị viên, tự động điều hướng sang trang chi tiết của Admin
    if (req.session.user && req.session.user.role === 'admin') {
      return res.redirect(`/admin/courses/${courseId}`);
    }

    // Nếu là Giảng viên, tự động điều hướng sang trang quản trị bài giảng của khóa đó
    if (req.session.user && req.session.user.role === 'instructor') {
      return res.redirect(`/instructor/courses/${courseId}/lessons`);
    }

    const [courseRows] = await db.query(`
      SELECT c.*, u.full_name AS instructor_name 
      FROM courses c 
      JOIN users u ON c.instructor_id = u.id 
      WHERE c.id = ?
    `, [courseId]);

    if (courseRows.length === 0) {
      return res.status(404).render('error', { title: '404', message: 'Không tìm thấy khóa học này!' });
    }

    const [lessons] = await db.query(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC', 
      [courseId]
    );

    let isEnrolled = false;
    let enrollmentStatus = null;
    let isCourseCompleted = false;
    let completedLessonsCount = 0;

    if (req.session.user) {
      const [enrollRows] = await db.query(
        'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ?',
        [req.session.user.id, courseId]
      );
      if (enrollRows.length > 0) {
        enrollmentStatus = enrollRows[0].status; // 'approved' | 'pending' | 'rejected'
        isEnrolled = enrollRows[0].status === 'approved';
      }

      if (isEnrolled && lessons.length > 0) {
        const [[{ count }]] = await db.query(`
          SELECT COUNT(*) AS count FROM lesson_completions lc
          JOIN lessons l ON lc.lesson_id = l.id
          WHERE lc.user_id = ? AND l.course_id = ?
        `, [req.session.user.id, courseId]);
        completedLessonsCount = count;
        isCourseCompleted = count >= lessons.length;
      }
    }

    let message = null;
    let messageType = 'success';
    if (req.query.enrolled === 'success' || req.query.enrolled === 'pending') {
      message = 'Ghi danh khóa học thành công! Yêu cầu của bạn đang chờ Giảng viên phê duyệt để bắt đầu học.';
      messageType = 'success';
    }

    res.render('student/course-detail', { 
      course: courseRows[0], 
      lessons, 
      isEnrolled,
      enrollmentStatus,
      isCourseCompleted,
      completedLessonsCount,
      message,
      messageType
    });
  } catch (err) {
    next(err);
  }
});

// Xử lý khi người dùng gõ link bậy bạ không tồn tại (Lỗi 404)
app.use((req, res) => {
  res.status(404).render('error', { 
    title: '404 - Không tìm thấy', 
    message: 'Trang bạn đang tìm kiếm không tồn tại!' 
  });
});

// ==================== TẤM LƯỚI BẮT LỖI CUỐI CÙNG ====================
// Luôn luôn nằm ở đáy của server.js!
app.use(errorHandler);

// Khởi động server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server LMS đang chạy tại cổng http://localhost:${PORT}`);
});
