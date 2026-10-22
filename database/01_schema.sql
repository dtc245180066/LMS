SET NAMES 'utf8mb4';

-- ============================================================================
-- CẤU TRÚC CƠ SỞ DỮ LIỆU LMS (DATABASE SCHEMA DDL)
-- ============================================================================

-- 1. Bảng Người dùng (Học viên, Giảng viên, Admin)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Mật khẩu băm Bcrypt an toàn
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'instructor', 'student') DEFAULT 'student',
    status ENUM('active', 'locked') DEFAULT 'active', -- Trạng thái tài khoản: Hoạt động hoặc Bị khóa
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Khóa học (Có liên kết với Giảng viên phụ trách)
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id INT NOT NULL,
    status ENUM('published', 'draft') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Bảng Bài học
CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    lesson_order INT DEFAULT 1,
    attachment_path VARCHAR(255) NULL,
    attachment_name VARCHAR(255) NULL,
    attachment_size INT NULL,
    attachment_type VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 4. Bảng Đăng ký khóa học (Có cơ chế Giảng viên duyệt & Chống đăng ký trùng)
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMP NULL,
    note VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_course (user_id, course_id) -- Chống đăng ký trùng lặp
);

-- 5. Bảng Tiến độ: Đánh dấu bài học đã hoàn thành
CREATE TABLE IF NOT EXISTS lesson_completions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_lesson (user_id, lesson_id)
);

-- 6. Bảng Nhật Ký Hoạt Động Của Users (Audit Trail / Activity Log)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 7. NGUYÊN TẮC BẢO MẬT ĐẶC QUYỀN TỐI THIỂU (LEAST PRIVILEGE) CHO ỨNG DỤNG
-- ============================================================================
-- Thu hồi toàn bộ quyền quản trị cấu trúc nguy hiểm (DROP, ALTER, GRANT OPTION...)
REVOKE ALL PRIVILEGES ON `lms\_db`.* FROM 'lms_user'@'%';

-- Chỉ cấp đúng 4 quyền thao tác dữ liệu (DML) cần thiết cho Web LMS hoạt động:
--   - SELECT: Cho phép xem danh sách khóa học, bài học, thông tin tài khoản
--   - INSERT: Cho phép đăng ký học, tạo bài học, thêm tài khoản, ghi log
--   - UPDATE: Cho phép sửa nội dung, duyệt học viên, cập nhật tiến độ
--   - DELETE: Cho phép xóa bài học, xóa khóa học
GRANT SELECT, INSERT, UPDATE, DELETE ON `lms\_db`.* TO 'lms_user'@'%';


