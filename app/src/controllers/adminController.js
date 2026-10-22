const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');
const { getPagination } = require('../utils/pagination');

// 1. Dashboard Quản trị viên: Tinh gọn, chỉ hiển thị số liệu tổng quan & tóm tắt nhanh
const dashboard = async (req, res, next) => {
    try {
        // 1.1 Thống kê chỉ số trọng yếu
        const [metricRows] = await db.query(`
            SELECT
              (SELECT COUNT(*) FROM users) AS total_users,
              (SELECT COUNT(*) FROM users WHERE role = 'student') AS student_count,
              (SELECT COUNT(*) FROM users WHERE role = 'instructor') AS instructor_count,
              (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
              (SELECT COUNT(*) FROM users WHERE status = 'locked') AS locked_users,
              (SELECT COUNT(*) FROM courses) AS course_count,
              (SELECT COUNT(*) FROM enrollments) AS enrollment_count
        `);

        // 1.2 Nhật ký hoạt động gần đây nhất (5 dòng tóm tắt)
        const [recentActivities] = await db.query(`
            SELECT a.id, a.action, a.created_at,
                   u.username, u.full_name, u.role
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT 5
        `);

        // 1.3 Khóa học mới nhất (4 khóa)
        const [recentCourses] = await db.query(`
            SELECT c.id, c.title, u.full_name AS instructor_name, c.created_at,
                   (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            ORDER BY c.id DESC
            LIMIT 4
        `);

        res.render('admin/dashboard', {
            title: 'Tổng Quan Hệ Thống',
            metrics: metricRows[0],
            recentActivities,
            recentCourses
        });

    } catch (err) {
        next(err);
    }
};

// 2. Trang Quản lý tài khoản: Cấp tài khoản mới + Bảng danh sách & Khóa/Mở khóa (Hỗ trợ phân trang)
const renderUsers = async (req, res, next) => {
    try {
        const pageQuery = req.query.page;
        const limit = 8; // 8 người dùng trên mỗi trang
        const [[{ totalItems }]] = await db.query('SELECT COUNT(*) AS totalItems FROM users');
        const pagination = getPagination(pageQuery, limit, totalItems);

        const [users] = await db.query(`
            SELECT id, username, full_name, role, status, created_at 
            FROM users 
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `, [pagination.limit, pagination.offset]);

        let message = null;
        let messageType = 'success';
        if (req.query.success === 'created') {
            message = 'Cấp tài khoản mới thành công!';
        } else if (req.query.success === 'locked') {
            message = 'Đã khóa tài khoản thành công. Người dùng này sẽ không thể đăng nhập!';
            messageType = 'danger';
        } else if (req.query.success === 'active') {
            message = 'Đã mở khóa tài khoản thành công!';
        } else if (req.query.error === 'self_lock') {
            message = 'Bạn không thể tự khóa tài khoản Admin của chính mình!';
            messageType = 'danger';
        } else if (req.query.error === 'user_not_found') {
            message = 'Không tìm thấy tài khoản người dùng!';
            messageType = 'danger';
        } else if (req.query.error === 'username_exists') {
            message = 'Tên đăng nhập này đã tồn tại trên hệ thống!';
            messageType = 'danger';
        } else if (req.query.error === 'missing_fields') {
            message = 'Vui lòng điền đầy đủ thông tin cấp tài khoản!';
            messageType = 'danger';
        }

        res.render('admin/users', {
            title: 'Quản Lý Tài Khoản Người Dùng',
            users,
            pagination,
            message,
            messageType
        });
    } catch (err) {
        next(err);
    }
};

// 3. Xử lý Cấp tài khoản mới
const createUser = async (req, res, next) => {
    try {
        const { username, password, full_name, role } = req.body;

        if (!username || !password || !full_name || !role) {
            return res.redirect('/admin/users?error=missing_fields');
        }

        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.redirect('/admin/users?error=username_exists');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.query(
            'INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, "active")',
            [username, hashedPassword, full_name, role]
        );

        await logActivity(
            req.session.user.id,
            `POST /admin/users/create (username: ${username}, role: ${role})`
        );

        res.redirect('/admin/users?success=created');
    } catch (err) {
        next(err);
    }
};

// 4. Xử lý Khóa / Mở khóa tài khoản
const toggleUserStatus = async (req, res, next) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        const currentAdminId = req.session.user.id;

        if (targetUserId === currentAdminId) {
            return res.redirect('/admin/users?error=self_lock');
        }

        const [rows] = await db.query('SELECT id, username, full_name, role, status FROM users WHERE id = ?', [targetUserId]);
        if (rows.length === 0) {
            return res.redirect('/admin/users?error=user_not_found');
        }

        const targetUser = rows[0];
        const newStatus = targetUser.status === 'active' ? 'locked' : 'active';

        await db.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, targetUserId]);

        await logActivity(
            currentAdminId,
            `POST /admin/users/${targetUserId}/toggle-status (status: ${newStatus})`
        );

        res.redirect(`/admin/users?success=${newStatus}`);
    } catch (err) {
        next(err);
    }
};

// 5. Trang Nhật ký hoạt động toàn hệ thống (Hỗ trợ phân trang)
const renderActivities = async (req, res, next) => {
    try {
        const pageQuery = req.query.page;
        const limit = 12; // 12 sự kiện trên mỗi trang
        const [[{ totalItems }]] = await db.query('SELECT COUNT(*) AS totalItems FROM activity_logs');
        const pagination = getPagination(pageQuery, limit, totalItems);

        const [activities] = await db.query(`
            SELECT a.id, a.action, a.created_at,
                   u.username, u.full_name, u.role, u.status AS user_status
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT ? OFFSET ?
        `, [pagination.limit, pagination.offset]);

        res.render('admin/activities', {
            title: 'Nhật Ký Hoạt Động Hệ Thống',
            activities,
            pagination
        });
    } catch (err) {
        next(err);
    }
};

// 6. Trang Quản lý Khóa học toàn trường (Hỗ trợ phân trang)
const renderCourses = async (req, res, next) => {
    try {
        const pageQuery = req.query.page;
        const limit = 6; // 6 khóa học trên mỗi trang
        const [[{ totalItems }]] = await db.query('SELECT COUNT(*) AS totalItems FROM courses');
        const pagination = getPagination(pageQuery, limit, totalItems);

        const [courses] = await db.query(`
            SELECT c.id, c.title, c.description, c.created_at, u.full_name AS instructor_name,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            ORDER BY c.id DESC
            LIMIT ? OFFSET ?
        `, [pagination.limit, pagination.offset]);

        res.render('admin/courses', {
            title: 'Quản Lý Khóa Học Toàn Trường',
            courses,
            pagination
        });
    } catch (err) {
        next(err);
    }
};

// 7. Chi tiết khóa học & Giáo trình dành riêng cho Quản trị viên
const renderCourseDetail = async (req, res, next) => {
    try {
        const courseId = req.params.id;

        const [courseRows] = await db.query(`
            SELECT c.*, u.full_name AS instructor_name, u.username AS instructor_username
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            WHERE c.id = ?
        `, [courseId]);

        if (courseRows.length === 0) {
            return res.status(404).render('error', { title: '404', message: 'Không tìm thấy khóa học này!' });
        }

        const course = courseRows[0];

        // Lấy danh sách bài giảng
        const [lessons] = await db.query(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC, id ASC',
            [courseId]
        );

        // Lấy danh sách sinh viên đã được phê duyệt tham gia khóa này
        const [students] = await db.query(`
            SELECT u.id, u.full_name, u.username, e.enrolled_at, e.reviewed_at,
                   (SELECT COUNT(*) FROM lesson_completions lc 
                    JOIN lessons l ON lc.lesson_id = l.id 
                    WHERE lc.user_id = u.id AND l.course_id = ?) AS completed_lessons
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            WHERE e.course_id = ? AND e.status = 'approved'
            ORDER BY e.reviewed_at DESC, e.enrolled_at DESC
        `, [courseId, courseId]);

        students.forEach(s => {
            s.progress = lessons.length > 0 
                ? Math.round((s.completed_lessons / lessons.length) * 100) 
                : 0;
        });

        res.render('admin/course-detail', {
            title: `Chi tiết: ${course.title}`,
            course,
            lessons,
            students
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    dashboard,
    renderUsers,
    createUser,
    toggleUserStatus,
    renderActivities,
    renderCourses,
    renderCourseDetail
};
