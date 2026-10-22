// 1. Người gác cổng số 1: Kiểm tra đăng nhập
const isAuthenticated = (req, res, next) => {
    // Kiểm tra xem trong session có thông tin user chưa
    if (req.session && req.session.user) {
        return next(); // Đã đăng nhập -> Cho đi tiếp!
    }
    // Chưa đăng nhập -> Đá về trang đăng nhập
    return res.redirect('/auth/login');
};

// 2. Người gác cổng số 2: Kiểm tra phân quyền (Role)
// Ví dụ sử dụng: hasRole('admin') hoặc hasRole('admin', 'instructor')
const hasRole = (...allowedRoles) => {
    return (req, res, next) => {
        // Nếu chưa đăng nhập hoặc role không nằm trong danh sách cho phép
        if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
            return res.status(403).render('error', { 
                title: '403 Forbidden', 
                message: 'Bạn không có quyền truy cập vào khu vực này!' 
            });
        }
        // Đúng quyền -> Cho đi tiếp!
        return next();
    };
};

module.exports = {
    isAuthenticated,
    hasRole
};