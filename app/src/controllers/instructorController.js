const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');
const { getPagination } = require('../utils/pagination');

// 1. Dashboard Giảng viên: Tổng quan số liệu giảng dạy & tóm tắt nhanh
const dashboard = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;

        // 1.1 Thống kê 4 chỉ số của giảng viên này (chỉ tính học viên đã được duyệt)
        const [metricRows] = await db.query(`
            SELECT
              (SELECT COUNT(*) FROM courses WHERE instructor_id = ?) AS course_count,
              (SELECT COUNT(l.id) FROM lessons l JOIN courses c ON l.course_id = c.id WHERE c.instructor_id = ?) AS lesson_count,
              (SELECT COUNT(DISTINCT e.user_id) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.instructor_id = ? AND e.status = 'approved') AS student_count,
              (SELECT COUNT(lc.id) FROM lesson_completions lc JOIN lessons l ON lc.lesson_id = l.id JOIN courses c ON l.course_id = c.id WHERE c.instructor_id = ?) AS completion_count
        `, [instructorId, instructorId, instructorId, instructorId]);

        // 1.2 Top 3 khóa học mới nhất của giảng viên này
        const [recentCourses] = await db.query(`
            SELECT c.id, c.title, c.description, c.status, c.created_at,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'approved') AS total_students
            FROM courses c
            WHERE c.instructor_id = ?
            ORDER BY c.id DESC
            LIMIT 3
        `, [instructorId]);

        // 1.3 Top 5 sinh viên vừa được phê duyệt vào các lớp của giảng viên
        const [recentEnrollments] = await db.query(`
            SELECT u.id AS student_id, u.full_name, u.username, c.title AS course_title, e.enrolled_at, e.status
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE c.instructor_id = ? AND e.status = 'approved'
            ORDER BY e.reviewed_at DESC, e.enrolled_at DESC
            LIMIT 5
        `, [instructorId]);

        res.render('instructor/dashboard', {
            title: 'Bảng Giảng Dạy - Giảng Viên',
            metrics: metricRows[0],
            recentCourses,
            recentEnrollments
        });

    } catch (err) {
        next(err);
    }
};

// 2. Trang Quản lý Khóa học của tôi (Hỗ trợ tìm kiếm theo tên và lọc theo trạng thái)
const renderCourses = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const search = req.query.search ? req.query.search.trim() : '';
        const status = req.query.status ? req.query.status.trim() : '';

        let sql = `
            SELECT c.id, c.title, c.description, c.status, c.created_at,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'approved') AS total_students
            FROM courses c
            WHERE c.instructor_id = ?
        `;
        const params = [instructorId];

        let countSql = 'SELECT COUNT(*) AS totalItems FROM courses c WHERE c.instructor_id = ?';
        const countParams = [instructorId];

        if (status && (status === 'published' || status === 'draft')) {
            sql += ' AND c.status = ?';
            params.push(status);
            countSql += ' AND c.status = ?';
            countParams.push(status);
        }

        if (search) {
            sql += ' AND (c.title LIKE ? OR c.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
            countSql += ' AND (c.title LIKE ? OR c.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [[{ totalItems }]] = await db.query(countSql, countParams);
        const limit = 6; // 6 khóa học trên mỗi trang
        const pagination = getPagination(req.query.page, limit, totalItems);

        sql += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
        params.push(pagination.limit, pagination.offset);

        const [myCourses] = await db.query(sql, params);

        let message = null;
        let messageType = 'success';
        if (req.query.success === 'created') message = 'Tạo khóa học mới thành công!';
        else if (req.query.success === 'status_updated') message = 'Cập nhật trạng thái khóa học thành công!';
        else if (req.query.success === 'deleted') message = 'Đã xóa khóa học thành công!';

        res.render('instructor/courses', {
            title: 'Khóa Học Của Tôi - Giảng Viên',
            myCourses,
            pagination,
            search,
            status,
            message,
            messageType
        });
    } catch (err) {
        next(err);
    }
};

// 3. Đổi trạng thái Công khai (published) <-> Bản nháp (draft)
const toggleCourseStatus = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const courseId = req.params.id;

        const [courses] = await db.query('SELECT id, title, status FROM courses WHERE id = ? AND instructor_id = ?', [courseId, instructorId]);
        if (courses.length === 0) {
            return res.status(403).render('error', { title: '403', message: 'Bạn không có quyền chỉnh sửa khóa học này!' });
        }

        const newStatus = courses[0].status === 'published' ? 'draft' : 'published';
        await db.query('UPDATE courses SET status = ? WHERE id = ?', [newStatus, courseId]);

        await logActivity(instructorId, `POST /instructor/courses/${courseId}/toggle-status (status: ${newStatus})`);

        res.redirect('/instructor/courses?success=status_updated');
    } catch (err) {
        next(err);
    }
};

// 4. Form tạo khóa học mới
const renderCreateCourse = (req, res) => {
    res.render('instructor/create-course', {
        title: 'Tạo Khóa Học Mới',
        error: null
    });
};

// 5. Xử lý tạo khóa học mới
const createCourse = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const { title, description, status } = req.body;

        if (!title) {
            return res.render('instructor/create-course', {
                title: 'Tạo Khóa Học Mới',
                error: 'Vui lòng nhập tên khóa học!'
            });
        }

        const courseStatus = status === 'draft' ? 'draft' : 'published';

        const [result] = await db.query(
            'INSERT INTO courses (title, description, instructor_id, status) VALUES (?, ?, ?, ?)',
            [title, description || '', instructorId, courseStatus]
        );

        await logActivity(instructorId, `POST /instructor/courses/create (title: "${title}")`);

        // Điều hướng thẳng vào trang quản lý bài học của khóa vừa tạo
        res.redirect(`/instructor/courses/${result.insertId}/lessons?success=created`);
    } catch (err) {
        next(err);
    }
};

// 6. Quản lý danh sách bài giảng của khóa học
const renderLessons = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const courseId = req.params.id;

        const [courses] = await db.query('SELECT * FROM courses WHERE id = ? AND instructor_id = ?', [courseId, instructorId]);
        if (courses.length === 0) {
            return res.status(403).render('error', { title: '403', message: 'Bạn không có quyền quản lý khóa học này!' });
        }

        const [lessons] = await db.query(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC',
            [courseId]
        );

        let message = null;
        if (req.query.success === 'created') message = 'Khởi tạo khóa học thành công! Hãy thêm các bài học vào giáo trình dưới đây.';
        else if (req.query.success === 'lesson_added') message = 'Thêm bài học mới thành công!';
        else if (req.query.success === 'lesson_deleted') message = 'Đã xóa bài học thành công!';

        res.render('instructor/lessons', {
            title: `Bài Giảng: ${courses[0].title}`,
            course: courses[0],
            lessons,
            message
        });
    } catch (err) {
        next(err);
    }
};

// 7. Form thêm bài học vào khóa học
const renderAddLesson = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const courseId = req.params.courseId;
        const [courseRows] = await db.query('SELECT * FROM courses WHERE id = ? AND instructor_id = ?', [courseId, instructorId]);

        if (courseRows.length === 0) {
            return res.status(403).render('error', { title: '403', message: 'Không tìm thấy khóa học hoặc bạn không có quyền thêm bài!' });
        }

        // Lấy danh sách các bài học hiện có của khóa để hiển thị ở cột bên phải
        const [existingLessons] = await db.query(
            'SELECT id, title, lesson_order, created_at FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC, id ASC',
            [courseId]
        );
        const nextOrder = existingLessons.length + 1;

        res.render('instructor/add-lesson', {
            title: 'Thêm bài học mới',
            course: courseRows[0],
            lessons: existingLessons,
            nextOrder,
            error: null
        });
    } catch (err) {
        next(err);
    }
};

// 8. Xử lý lưu bài học mới (kèm file tài liệu đa định dạng)
const addLesson = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const courseId = req.params.courseId;
        const { title, content, lesson_order } = req.body;

        const [courseRows] = await db.query('SELECT * FROM courses WHERE id = ? AND instructor_id = ?', [courseId, instructorId]);
        if (courseRows.length === 0) {
            return res.status(403).render('error', { title: '403', message: 'Bạn không có quyền thêm bài vào khóa này!' });
        }

        // Bắt lỗi kích thước hoặc định dạng tệp tải lên nếu có
        if (req.fileValidationError) {
            const [existingLessons] = await db.query(
                'SELECT id, title, lesson_order, created_at FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC, id ASC',
                [courseId]
            );
            return res.render('instructor/add-lesson', {
                title: 'Thêm bài học mới',
                course: courseRows[0],
                lessons: existingLessons,
                nextOrder: parseInt(lesson_order, 10) || (existingLessons.length + 1),
                error: req.fileValidationError
            });
        }

        if (!title) {
            const [existingLessons] = await db.query(
                'SELECT id, title, lesson_order, created_at FROM lessons WHERE course_id = ? ORDER BY lesson_order ASC, id ASC',
                [courseId]
            );
            return res.render('instructor/add-lesson', {
                title: 'Thêm bài học mới',
                course: courseRows[0],
                lessons: existingLessons,
                nextOrder: parseInt(lesson_order, 10) || (existingLessons.length + 1),
                error: 'Vui lòng nhập tiêu đề bài học!'
            });
        }

        const order = parseInt(lesson_order, 10) || 1;
        const attachmentPath = req.file ? `/uploads/materials/${req.file.filename}` : null;
        const attachmentName = req.file ? req.file.originalname : null;
        const attachmentSize = req.file ? req.file.size : null;
        const attachmentType = req.file ? (path.extname(req.file.originalname).toLowerCase().replace('.', '') || req.file.mimetype) : null;

        await db.query(
            `INSERT INTO lessons (course_id, title, content, lesson_order, attachment_path, attachment_name, attachment_size, attachment_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [courseId, title, content || '', order, attachmentPath, attachmentName, attachmentSize, attachmentType]
        );

        await logActivity(instructorId, `POST /instructor/courses/${courseId}/add-lesson (title: "${title}", file: "${attachmentName || 'none'}")`);

        res.redirect(`/instructor/courses/${courseId}/lessons?success=lesson_added`);
    } catch (err) {
        next(err);
    }
};

// 9. Xóa bài học (đồng thời xóa tệp tài liệu vật lý trên ổ cứng)
const deleteLesson = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const lessonId = req.params.id;

        // Kiểm tra xem bài học thuộc khóa học của giảng viên này không
        const [rows] = await db.query(`
            SELECT l.id, l.title, l.course_id, l.attachment_path
            FROM lessons l 
            JOIN courses c ON l.course_id = c.id 
            WHERE l.id = ? AND c.instructor_id = ?
        `, [lessonId, instructorId]);

        if (rows.length === 0) {
            return res.status(403).render('error', { title: '403', message: 'Không tìm thấy bài học hoặc bạn không có quyền xóa!' });
        }

        const courseId = rows[0].course_id;

        // Xóa tệp tài liệu vật lý nếu có
        if (rows[0].attachment_path) {
            const filePath = path.join(__dirname, '../../public', rows[0].attachment_path);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkErr) {
                    console.error('Không thể xóa tệp tài liệu cũ:', unlinkErr.message);
                }
            }
        }

        await db.query('DELETE FROM lessons WHERE id = ?', [lessonId]);

        await logActivity(instructorId, `POST /instructor/lessons/${lessonId}/delete`);

        res.redirect(`/instructor/courses/${courseId}/lessons?success=lesson_deleted`);
    } catch (err) {
        next(err);
    }
};

// 10. Trang Danh sách & Tiến độ Học viên (Phân cấp 3 tầng: Sinh viên -> Khóa học -> Bài học)
const renderAllStudents = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const targetStudentId = req.query.studentId ? parseInt(req.query.studentId, 10) : null;

        // 10.1 NẾU ĐANG CHỌN 1 SINH VIÊN (Tầng 2 & 3: Các khóa học của bạn đó & chi tiết bài làm)
        if (targetStudentId) {
            const courseSearch = req.query.courseSearch ? req.query.courseSearch.trim() : '';

            const [studentRows] = await db.query(
                'SELECT id, username, full_name FROM users WHERE id = ?',
                [targetStudentId]
            );

            if (studentRows.length === 0) {
                return res.redirect('/instructor/students');
            }

            const student = studentRows[0];

            // Lấy danh sách các môn mà sinh viên này đã được duyệt vào học của giảng viên (hỗ trợ tìm kiếm theo tên môn)
            let courseSql = `
                SELECT 
                    c.id AS course_id,
                    c.title AS course_title,
                    c.status AS course_status,
                    e.enrolled_at,
                    (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                    (SELECT COUNT(*) FROM lesson_completions lc 
                     JOIN lessons l ON lc.lesson_id = l.id 
                     WHERE lc.user_id = ? AND l.course_id = c.id) AS completed_lessons
                FROM courses c
                JOIN enrollments e ON e.course_id = c.id
                WHERE e.user_id = ? AND c.instructor_id = ? AND e.status = 'approved'
            `;
            const courseParams = [targetStudentId, targetStudentId, instructorId];

            if (courseSearch) {
                courseSql += ' AND c.title LIKE ?';
                courseParams.push(`%${courseSearch}%`);
            }

            courseSql += ' ORDER BY c.id ASC';

            const [courses] = await db.query(courseSql, courseParams);

            // Lấy danh sách bài giảng của từng môn
            if (courses.length > 0) {
                const courseIds = courses.map(c => c.course_id);
                const [lessonRows] = await db.query(`
                    SELECT 
                        l.id AS lesson_id,
                        l.course_id,
                        l.title AS lesson_title,
                        l.lesson_order,
                        lc.completed_at,
                        CASE WHEN lc.id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
                    FROM lessons l
                    JOIN courses c ON l.course_id = c.id
                    LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.user_id = ?
                    WHERE c.instructor_id = ? AND l.course_id IN (?)
                    ORDER BY l.course_id ASC, l.lesson_order ASC
                `, [targetStudentId, instructorId, courseIds]);

                courses.forEach(c => {
                    c.lessons = lessonRows.filter(l => l.course_id === c.course_id);
                    c.progress = c.total_lessons > 0 
                        ? Math.round((c.completed_lessons / c.total_lessons) * 100) 
                        : 0;
                });
            }

            const overallCompleted = courses.reduce((acc, cur) => acc + cur.completed_lessons, 0);
            const overallTotal = courses.reduce((acc, cur) => acc + cur.total_lessons, 0);
            const overallProgress = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

            return res.render('instructor/students', {
                title: `Tiến Độ Học Viên: ${student.full_name}`,
                mode: 'detail',
                student,
                courses,
                courseSearch,
                overallCompleted,
                overallTotal,
                overallProgress
            });
        }

        // 10.2 NẾU CHƯA CHỌN SINH VIÊN (Tầng 1: Danh sách phẳng tất cả sinh viên duy nhất)
        const search = req.query.search ? req.query.search.trim() : '';
        const courseId = req.query.courseId ? parseInt(req.query.courseId, 10) : null;

        // Lấy danh sách toàn bộ khóa học để nạp vào bộ lọc
        const [myCourses] = await db.query(
            'SELECT id, title FROM courses WHERE instructor_id = ? ORDER BY id DESC',
            [instructorId]
        );

        let studentSql = `
            SELECT 
                u.id AS student_id,
                u.full_name,
                u.username,
                COUNT(DISTINCT c.id) AS course_count,
                (SELECT COUNT(DISTINCT lc.id) 
                 FROM lesson_completions lc 
                 JOIN lessons l ON lc.lesson_id = l.id 
                 JOIN courses c2 ON l.course_id = c2.id 
                 WHERE lc.user_id = u.id AND c2.instructor_id = ?) AS completed_lessons,
                (SELECT COUNT(l2.id)
                 FROM lessons l2
                 JOIN courses c3 ON l2.course_id = c3.id
                 JOIN enrollments e2 ON e2.course_id = c3.id AND e2.user_id = u.id AND e2.status = 'approved'
                 WHERE c3.instructor_id = ?) AS total_lessons
            FROM users u
            JOIN enrollments e ON e.user_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE c.instructor_id = ? AND e.status = 'approved'
        `;
        const studentParams = [instructorId, instructorId, instructorId];

        let countSql = `
            SELECT COUNT(DISTINCT u.id) AS totalItems
            FROM users u
            JOIN enrollments e ON e.user_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE c.instructor_id = ? AND e.status = 'approved'
        `;
        const countParams = [instructorId];

        if (courseId) {
            studentSql += ' AND c.id = ?';
            studentParams.push(courseId);
            countSql += ' AND c.id = ?';
            countParams.push(courseId);
        }

        if (search) {
            studentSql += ' AND (u.full_name LIKE ? OR u.username LIKE ?)';
            studentParams.push(`%${search}%`, `%${search}%`);
            countSql += ' AND (u.full_name LIKE ? OR u.username LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [[{ totalItems }]] = await db.query(countSql, countParams);
        const limit = 8; // 8 sinh viên trên 1 trang
        const pagination = getPagination(req.query.page, limit, totalItems);

        studentSql += ' GROUP BY u.id, u.full_name, u.username ORDER BY u.id ASC LIMIT ? OFFSET ?';
        studentParams.push(pagination.limit, pagination.offset);

        const [students] = await db.query(studentSql, studentParams);

        students.forEach(s => {
            s.progress = s.total_lessons > 0 
                ? Math.round((s.completed_lessons / s.total_lessons) * 100) 
                : 0;
        });

        res.render('instructor/students', {
            title: 'Tiến Độ Học Viên - Giảng Viên',
            mode: 'list',
            courses: myCourses,
            students,
            pagination,
            search,
            courseId
        });
    } catch (err) {
        next(err);
    }
};

// 11. Xem danh sách sinh viên của riêng 1 khóa học -> Chuyển hướng về trang chuẩn kèm query
const viewCourseStudents = (req, res) => {
    res.redirect('/instructor/students?courseId=' + req.params.courseId);
};

// 12. Quản lý duyệt đăng ký khóa học: Xem danh sách đơn đăng ký chờ duyệt
const renderEnrollments = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const courseId = req.query.courseId ? parseInt(req.query.courseId, 10) : null;

        // Lấy danh sách khóa học của giảng viên để nạp bộ lọc
        const [myCourses] = await db.query(
            'SELECT id, title FROM courses WHERE instructor_id = ? ORDER BY id DESC',
            [instructorId]
        );

        // Lấy danh sách đơn đăng ký đang chờ duyệt (status = 'pending')
        let pendingSql = `
            SELECT e.id AS enrollment_id, e.user_id, e.course_id, e.enrolled_at, e.status,
                   u.full_name AS student_name, u.username,
                   c.title AS course_title
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE c.instructor_id = ? AND e.status = 'pending'
        `;
        const pendingParams = [instructorId];

        if (courseId) {
            pendingSql += ' AND c.id = ?';
            pendingParams.push(courseId);
        }

        pendingSql += ' ORDER BY e.enrolled_at ASC';

        const [pendingList] = await db.query(pendingSql, pendingParams);

        // Lấy 8 đơn xét duyệt gần nhất (lịch sử duyệt)
        const [recentHistory] = await db.query(`
            SELECT e.id AS enrollment_id, e.user_id, e.course_id, e.enrolled_at, e.reviewed_at, e.status,
                   u.full_name AS student_name, u.username,
                   c.title AS course_title
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            JOIN courses c ON e.course_id = c.id
            WHERE c.instructor_id = ? AND e.status IN ('approved', 'rejected')
            ORDER BY e.reviewed_at DESC
            LIMIT 8
        `, [instructorId]);

        let message = null;
        let messageType = 'success';
        if (req.query.success === 'approved') {
            message = 'Phê duyệt đơn đăng ký của sinh viên thành công! Sinh viên đã có quyền vào học.';
        } else if (req.query.success === 'rejected') {
            message = 'Đã từ chối đơn đăng ký thành công.';
            messageType = 'danger';
        }

        res.render('instructor/enrollments', {
            title: 'LMS',
            courses: myCourses,
            pendingList,
            recentHistory,
            courseId,
            message,
            messageType
        });
    } catch (err) {
        next(err);
    }
};

// 13. Phê duyệt đơn đăng ký của sinh viên
const approveEnrollment = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const enrollmentId = parseInt(req.params.id, 10);

        // Kiểm tra quyền: đơn này phải thuộc khóa học do giảng viên này phụ trách
        const [rows] = await db.query(`
            SELECT e.id, u.full_name, c.title
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            JOIN users u ON e.user_id = u.id
            WHERE e.id = ? AND c.instructor_id = ?
        `, [enrollmentId, instructorId]);

        if (rows.length === 0) {
            return res.status(403).render('error', { title: 'LMS', message: 'Bạn không có quyền xét duyệt đơn này!' });
        }

        await db.query(
            'UPDATE enrollments SET status = "approved", reviewed_at = NOW() WHERE id = ?',
            [enrollmentId]
        );

        await logActivity(
            instructorId,
            `POST /instructor/enrollments/${enrollmentId}/approve (student: ${rows[0].full_name}, course: ${rows[0].title})`
        );

        res.redirect('/instructor/enrollments?success=approved');
    } catch (err) {
        next(err);
    }
};

// 14. Từ chối đơn đăng ký của sinh viên
const rejectEnrollment = async (req, res, next) => {
    try {
        const instructorId = req.session.user.id;
        const enrollmentId = parseInt(req.params.id, 10);

        const [rows] = await db.query(`
            SELECT e.id, u.full_name, c.title
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            JOIN users u ON e.user_id = u.id
            WHERE e.id = ? AND c.instructor_id = ?
        `, [enrollmentId, instructorId]);

        if (rows.length === 0) {
            return res.status(403).render('error', { title: 'LMS', message: 'Bạn không có quyền xét duyệt đơn này!' });
        }

        await db.query(
            'UPDATE enrollments SET status = "rejected", reviewed_at = NOW() WHERE id = ?',
            [enrollmentId]
        );

        await logActivity(
            instructorId,
            `POST /instructor/enrollments/${enrollmentId}/reject (student: ${rows[0].full_name}, course: ${rows[0].title})`
        );

        res.redirect('/instructor/enrollments?success=rejected');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    dashboard,
    renderCourses,
    toggleCourseStatus,
    renderCreateCourse,
    createCourse,
    renderLessons,
    renderAddLesson,
    addLesson,
    deleteLesson,
    renderAllStudents,
    viewCourseStudents,
    renderEnrollments,
    approveEnrollment,
    rejectEnrollment
};
