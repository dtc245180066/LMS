const express = require('express');
const adminRouter = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, hasRole } = require('../middlewares/auth');

// Toàn bộ đường dẫn Admin CHỈ cho phép vai trò 'admin' (bảo vệ Backend tuyệt đối)
adminRouter.use(isAuthenticated, hasRole('admin'));

// 1. Dashboard Tổng quan số liệu
adminRouter.get('/dashboard', adminController.dashboard);

// 2. Trang Quản lý & Cấp / Khóa tài khoản
adminRouter.get('/users', adminController.renderUsers);
adminRouter.post('/users/create', adminController.createUser);
adminRouter.post('/users/:id/toggle-status', adminController.toggleUserStatus);

// 3. Trang Nhật ký hoạt động người dùng (Audit Trail)
adminRouter.get('/activities', adminController.renderActivities);

// 4. Trang Quản lý Khóa học toàn trường
adminRouter.get('/courses', adminController.renderCourses);
adminRouter.get('/courses/:id', adminController.renderCourseDetail);

module.exports = adminRouter;
