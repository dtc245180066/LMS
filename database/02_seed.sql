SET NAMES 'utf8mb4';

-- ============================================================================
-- DỮ LIỆU MẪU ĐỂ CHẠY THỬ NGHIỆM VÀ ĐÁNH GIÁ (DEMO SEED DATA)
-- Mật khẩu mặc định của các tài khoản mẫu: 123456 (được băm bcrypt $2a$10$...)
-- ============================================================================

-- 1. Tài khoản Người dùng mẫu (Admin, Giảng viên, Học viên)
INSERT INTO users (id, username, password, full_name, role, status) VALUES
(1, 'admin', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Quản trị viên Hệ thống', 'admin', 'active'),
(2, 'teacher1', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Thầy Nguyễn Văn Giảng', 'instructor', 'active'),
(3, 'student1', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Bạn Trần Thị Học', 'student', 'active'),
(4, 'teacher2', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Thầy Lê Văn Dạy', 'instructor', 'active'),
(5, 'student2', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Lê Hoàng Nam', 'student', 'active'),
(6, 'student3', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Phạm Thị Mai', 'student', 'active'),
(7, 'student4', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Vũ Quốc Huy', 'student', 'active'),
(8, 'student5', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Đỗ Minh Tuấn', 'student', 'active'),
(9, 'student6', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Ngô Thu Trang', 'student', 'active'),
(10, 'student7', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Bùi Đức Anh', 'student', 'active'),
(11, 'student8', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Hoàng Bảo Ngọc', 'student', 'active'),
(12, 'student9', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Đinh Quang Khải', 'student', 'active'),
(13, 'student10', '$2a$10$Aqxzb6PvsPhkbkYBX7rYuuQuG7DcvK1bQpfdvmckLiD56jYZL3Pdy', 'Trịnh Yến Nhi', 'student', 'active')
ON DUPLICATE KEY UPDATE id=id;

-- 2. Khóa học mẫu phục vụ kiểm thử phân trang & trạng thái
INSERT INTO courses (id, title, description, instructor_id, status) VALUES
(1, 'Lập trình Node.js & Express cơ bản', 'Khóa học xây dựng Web Server và kết nối Database từ số 0', 2, 'published'),
(2, 'Quản trị Hệ thống Linux & Docker', 'Làm chủ dòng lệnh Linux, Docker Compose và Nginx Reverse Proxy', 2, 'published'),
(3, 'Giám sát hệ thống với Prometheus & Grafana', 'Thu thập chỉ số, vẽ biểu đồ Dashboard trực quan', 2, 'published'),
(4, 'Phát triển Web Frontend Hiện đại với React', 'Xây dựng Single Page Application với React hooks và component state', 2, 'published'),
(5, 'Cơ sở Dữ liệu Quan hệ & Tối ưu SQL', 'Thiết kế chuẩn hóa lược đồ dữ liệu, indexing và tuning query', 2, 'published'),
(6, 'Bảo mật Ứng dụng Web & OWASP Top 10', 'Nhận diện lỗ hổng XSS, SQL Injection, CSRF và cơ chế phòng thủ', 2, 'published'),
(7, 'Triển khai CI/CD với GitHub Actions', 'Tự động hóa build, test và deploy lên Docker container', 2, 'published'),
(8, 'Kiến trúc Vi dịch vụ (Microservices cơ bản)', 'Tách monolith, quản lý API Gateway và giao tiếp Message Queue', 2, 'draft')
ON DUPLICATE KEY UPDATE id=id;

-- 3. Bài học mẫu có nội dung chi tiết
INSERT INTO lessons (id, course_id, title, content, lesson_order) VALUES
(1, 1, 'Bài 1: Cài đặt môi trường và làm quen package.json', 'Nội dung hướng dẫn chi tiết bài 1...', 1),
(2, 1, 'Bài 2: Tạo Web Server đầu tiên với Express', 'Nội dung hướng dẫn chi tiết bài 2...', 2),
(3, 1, 'Bài 3: Xây dựng RESTful API và Middleware', 'Nội dung hướng dẫn xây dựng REST API...', 3),
(4, 2, 'Bài 1: Khái niệm Container và Port mapping trong Docker', 'Nội dung hướng dẫn container...', 1),
(5, 2, 'Bài 2: Cấu hình Nginx làm Reverse Proxy', 'Nội dung cấu hình Nginx...', 2),
(6, 3, 'Bài 1: Cài đặt Prometheus thu thập Metrics', 'Nội dung Prometheus...', 1)
ON DUPLICATE KEY UPDATE id=id;

-- 4. Ghi danh học viên vào khóa học (Có mẫu đã duyệt và đang chờ duyệt để test chức năng)
INSERT INTO enrollments (id, user_id, course_id, status, reviewed_at) VALUES 
(1, 3, 1, 'approved', CURRENT_TIMESTAMP),
(2, 5, 1, 'approved', CURRENT_TIMESTAMP), 
(3, 5, 2, 'approved', CURRENT_TIMESTAMP),
(4, 6, 1, 'approved', CURRENT_TIMESTAMP), 
(5, 6, 3, 'approved', CURRENT_TIMESTAMP),
(6, 7, 2, 'approved', CURRENT_TIMESTAMP),
(7, 8, 1, 'approved', CURRENT_TIMESTAMP), 
(8, 8, 2, 'approved', CURRENT_TIMESTAMP), 
(9, 8, 3, 'approved', CURRENT_TIMESTAMP),
(10, 9, 1, 'approved', CURRENT_TIMESTAMP),
(11, 10, 2, 'approved', CURRENT_TIMESTAMP),
(12, 11, 1, 'approved', CURRENT_TIMESTAMP), 
(13, 11, 3, 'approved', CURRENT_TIMESTAMP),
(14, 12, 1, 'approved', CURRENT_TIMESTAMP),
(15, 13, 2, 'approved', CURRENT_TIMESTAMP),
-- Đơn đăng ký chờ duyệt mẫu (Pending) để Giảng viên test nút Duyệt / Từ chối
(16, 12, 2, 'pending', NULL),
(17, 13, 3, 'pending', NULL)
ON DUPLICATE KEY UPDATE id=id;

-- 5. Tiến độ hoàn thành bài học (phục vụ biểu đồ % tiến độ)
INSERT INTO lesson_completions (user_id, lesson_id) VALUES
(5, 1), (5, 2),
(6, 1),
(8, 1), (8, 4),
(11, 1)
ON DUPLICATE KEY UPDATE user_id=user_id;

-- 6. Nhật ký hoạt động mẫu ban đầu (Audit log)
INSERT INTO activity_logs (user_id, action) VALUES
(1, 'GET /admin/dashboard'),
(2, 'POST /instructor/courses/create'),
(3, 'POST /student/enroll/1');

