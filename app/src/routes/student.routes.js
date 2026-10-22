const express = require('express');
const studentRouter = express.Router();
const studentController = require('../controllers/studentController');
const { isAuthenticated, hasRole } = require('../middlewares/auth');

// Toàn bộ đường dẫn của sinh viên đều yêu cầu Đăng nhập & có vai trò Student (hoặc Admin)
studentRouter.use(isAuthenticated, hasRole('student', 'admin'));

// 1. Tab Tổng quan (Dashboard sinh viên)
studentRouter.get('/dashboard', studentController.dashboard);

// 2. Tab Khóa học của tôi (Chi tiết khóa đang học & đang chờ duyệt)
studentRouter.get('/my-courses', studentController.myCourses);

// 3. Đăng ký khóa học (Chuyển sang trạng thái chờ duyệt)
studentRouter.post('/enroll/:courseId', studentController.enroll);

// 4. Hủy yêu cầu đăng ký đang chờ duyệt
studentRouter.post('/enroll/:courseId/cancel', studentController.cancelEnrollment);

// 5. Vào học bài học (Yêu cầu status = 'approved')
studentRouter.get('/course/:courseId/lesson/:lessonId', studentController.viewLesson);

// 6. Đánh dấu hoàn thành bài học
studentRouter.post('/course/:courseId/lesson/:lessonId/complete', studentController.completeLesson);

module.exports = studentRouter;
