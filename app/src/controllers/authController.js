const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// 1. Hiển thị trang đăng nhập
const renderLogin = (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
        if (req.session.user.role === 'instructor') return res.redirect('/instructor/dashboard');
        return res.redirect('/student/dashboard');
    }
    res.render('auth/login', { 
        title: 'Đăng nhập',
        error: req.query.error || null,
        success: req.query.registered ? 'Đăng ký thành công! Vui lòng đăng nhập.' : null
    });
};

// 2. Xử lý Đăng nhập
const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('auth/login', { 
                title: 'Đăng nhập', 
                error: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!' 
            });
        }

        // Tìm user trong Database
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user) {
            await logActivity(null, `POST /auth/login (401 Unauthorized - user not found)`);
            return res.render('auth/login', { 
                title: 'Đăng nhập', 
                error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' 
            });
        }

        // So khớp mật khẩu băm
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await logActivity(user.id, `POST /auth/login (401 Unauthorized - invalid password)`);
            return res.render('auth/login', { 
                title: 'Đăng nhập', 
                error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' 
            });
        }

        // KIỂM TRA TRẠNG THÁI KHÓA TÀI KHOẢN CỦA ADMIN
        if (user.status === 'locked') {
            await logActivity(user.id, `POST /auth/login (403 Forbidden - account locked)`);
            return res.render('auth/login', {
                title: 'Đăng nhập',
                error: 'Tài khoản của bạn đã bị Quản trị viên tạm khóa. Vui lòng liên hệ ban quản trị!'
            });
        }

        // Đăng nhập hợp lệ -> Ghi session
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        // Ghi nhật ký hoạt động
        await logActivity(user.id, `POST /auth/login (200 OK)`);

        req.session.save(() => {
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else if (user.role === 'instructor') {
                return res.redirect('/instructor/dashboard');
            } else {
                return res.redirect('/student/dashboard');
            }
        });

    } catch (err) {
        next(err);
    }
};

// 3. Hiển thị trang đăng ký
const renderRegister = (req, res) => {
    if (req.session.user) {
        return res.redirect('/courses');
    }
    res.render('auth/register', { 
        title: 'Đăng ký tài khoản',
        error: null 
    });
};

// 4. Xử lý Đăng ký
const register = async (req, res, next) => {
    try {
        const { username, password, full_name } = req.body;

        if (!username || !password || !full_name) {
            return res.render('auth/register', { 
                title: 'Đăng ký', 
                error: 'Vui lòng điền đầy đủ các trường thông tin!' 
            });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.render('auth/register', { 
                title: 'Đăng ký', 
                error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác!' 
            });
        }

        // Băm mật khẩu bằng bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Mặc định vai trò là sinh viên và trạng thái active
        const [result] = await db.query(
            'INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, "student", "active")',
            [username, hashedPassword, full_name]
        );

        await logActivity(result.insertId, `POST /auth/register (201 Created)`);

        res.redirect('/auth/login?registered=1');

    } catch (err) {
        next(err);
    }
};

// 5. Đăng xuất
const logout = (req, res) => {
    const user = req.session.user;

    if (user) {
        logActivity(user.id, `GET /auth/logout (302 Redirect)`);
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Lỗi khi hủy session:', err);
        }
        res.redirect('/auth/login');
    });
};

module.exports = {
    renderLogin,
    login,
    renderRegister,
    register,
    logout
};