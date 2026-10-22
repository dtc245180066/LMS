const express = require('express');
const instructorRouter = express.Router();
const instructorController = require('../controllers/instructorController');
const { isAuthenticated, hasRole } = require('../middlewares/auth');
const uploadMaterial = require('../middlewares/upload');

// Bảo vệ phân hệ Giảng viên: Bắt buộc đăng nhập & có vai trò 'instructor' hoặc 'admin'
instructorRouter.use(isAuthenticated, hasRole('instructor', 'admin'));

// 1. Dashboard Tổng quan số liệu giảng dạy
instructorRouter.get('/dashboard', instructorController.dashboard);

// 2. Trang Quản lý Khóa học của tôi
instructorRouter.get('/courses', instructorController.renderCourses);

// 3. Đổi trạng thái Công khai (published) <-> Bản nháp (draft)
instructorRouter.post('/courses/:id/toggle-status', instructorController.toggleCourseStatus);

// 4. Tạo khóa học mới
instructorRouter.get('/courses/create', instructorController.renderCreateCourse);
instructorRouter.post('/courses/create', instructorController.createCourse);

// 5. Quản lý danh sách bài học của khóa
instructorRouter.get('/courses/:id/lessons', instructorController.renderLessons);

// 6. Thêm bài học mới (Hỗ trợ upload đa định dạng tài liệu đính kèm)
instructorRouter.get('/courses/:courseId/add-lesson', instructorController.renderAddLesson);
instructorRouter.post('/courses/:courseId/add-lesson', (req, res, next) => {
    uploadMaterial.single('material')(req, res, (err) => {
        if (err) {
            req.fileValidationError = err.message;
        }
        next();
    });
}, instructorController.addLesson);

// 7. Xóa bài học
instructorRouter.post('/lessons/:id/delete', instructorController.deleteLesson);

// 8. Trang Danh sách & Tiến độ học viên toàn bộ
instructorRouter.get('/students', instructorController.renderAllStudents);

// 9. Xem danh sách sinh viên của riêng một khóa học
instructorRouter.get('/courses/:courseId/students', instructorController.viewCourseStudents);

// 10. Quản lý duyệt đăng ký khóa học
instructorRouter.get('/enrollments', instructorController.renderEnrollments);
instructorRouter.post('/enrollments/:id/approve', instructorController.approveEnrollment);
instructorRouter.post('/enrollments/:id/reject', instructorController.rejectEnrollment);

module.exports = instructorRouter;
