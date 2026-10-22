const db = require('../config/db');

/**
 * Middleware cung cấp biến chung và hàm tiện ích cho view templates (EJS)
 */
const setCurrentUser = async (req, res, next) => {
    try {
        res.locals.currentUser = req.session.user || null;
        res.locals.currentPath = req.path;
        res.locals.currentQuery = req.query || {};
        res.locals.pendingEnrollmentsCount = 0;

        // Nếu người dùng là giảng viên, tự động đếm số đơn đăng ký đang chờ duyệt
        if (req.session.user && req.session.user.role === 'instructor') {
            const [[row]] = await db.query(`
                SELECT COUNT(*) AS pendingCount 
                FROM enrollments e 
                JOIN courses c ON e.course_id = c.id 
                WHERE c.instructor_id = ? AND e.status = 'pending'
            `, [req.session.user.id]);
            res.locals.pendingEnrollmentsCount = row ? row.pendingCount : 0;
        }

        // Helper tạo URL phân trang giữ nguyên các tham số tìm kiếm/lọc hiện có
        res.locals.buildPageUrl = (pageNumber) => {
            const queryParams = new URLSearchParams();
            const currentParams = req.query || {};

            for (const [key, value] of Object.entries(currentParams)) {
                if (key !== 'page' && value !== undefined && value !== null && value !== '') {
                    queryParams.set(key, value);
                }
            }

            queryParams.set('page', pageNumber);
            const basePath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
            return `${basePath}?${queryParams.toString()}`;
        };

        next();
    } catch (err) {
        next();
    }
};

module.exports = setCurrentUser;