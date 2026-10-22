const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// 1. Dashboard Sinh viên: Tổng quan số liệu học tập, lối tắt học tiếp & tóm tắt nhanh
const dashboard = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;

        // 1.1 Khóa học đã được phê duyệt (Đang theo học)
        const [approvedCourses] = await db.query(`
            SELECT c.id, c.title, c.description, u.full_name AS instructor_name,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM lesson_completions lc 
                    JOIN lessons l ON lc.lesson_id = l.id 
                    WHERE lc.user_id = ? AND l.course_id = c.id) AS completed_lessons
            FROM courses c
            JOIN enrollments e ON e.course_id = c.id
            JOIN users u ON c.instructor_id = u.id
            WHERE e.user_id = ? AND e.status = 'approved'
            ORDER BY e.reviewed_at DESC, e.enrolled_at DESC
        `, [studentId, studentId]);

        // Tính % tiến độ và tìm bài học kế tiếp cho từng môn
        for (const course of approvedCourses) {
            course.progress = course.total_lessons > 0 
                ? Math.round((course.completed_lessons / course.total_lessons) * 100) 
                : 0;

            const [lessons] = await db.query(`
                SELECT l.id, l.title, l.lesson_order,
                       (SELECT COUNT(*) FROM lesson_completions WHERE user_id = ? AND lesson_id = l.id) AS is_done
                FROM lessons l
                WHERE l.course_id = ?
                ORDER BY l.lesson_order ASC
            `, [studentId, course.id]);

            const nextIncomplete = lessons.find(l => l.is_done === 0);
            course.nextLesson = nextIncomplete || (lessons.length > 0 ? lessons[0] : null);
            course.allCompleted = lessons.length > 0 && lessons.every(l => l.is_done > 0);
        }

        // 1.2 Khóa học đang chờ giảng viên duyệt
        const [pendingCourses] = await db.query(`
            SELECT c.id, c.title, c.description, u.full_name AS instructor_name, e.enrolled_at,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons
            FROM courses c
            JOIN enrollments e ON e.course_id = c.id
            JOIN users u ON c.instructor_id = u.id
            WHERE e.user_id = ? AND e.status = 'pending'
            ORDER BY e.enrolled_at DESC
        `, [studentId]);

        // 1.3 Khóa học bị từ chối phê duyệt (để sinh viên biết và có thể gửi lại hoặc liên hệ GV)
        const [rejectedCourses] = await db.query(`
            SELECT c.id, c.title, c.description, u.full_name AS instructor_name, e.reviewed_at,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons
            FROM courses c
            JOIN enrollments e ON e.course_id = c.id
            JOIN users u ON c.instructor_id = u.id
            WHERE e.user_id = ? AND e.status = 'rejected'
            ORDER BY e.reviewed_at DESC
        `, [studentId]);

        // 1.4 Thống kê số liệu học tập tổng quan
        const approvedCount = approvedCourses.length;
        const pendingCount = pendingCourses.length;
        const totalCompletedLessons = approvedCourses.reduce((sum, c) => sum + c.completed_lessons, 0);
        const totalAllLessons = approvedCourses.reduce((sum, c) => sum + c.total_lessons, 0);
        const overallProgress = totalAllLessons > 0 ? Math.round((totalCompletedLessons / totalAllLessons) * 100) : 0;

        // Khóa học gợi ý học tiếp ngay
        const resumeCourse = approvedCourses.find(c => c.nextLesson && !c.allCompleted);

        res.render('student/dashboard', {
            title: 'LMS',
            approvedCourses,
            pendingCourses,
            rejectedCourses,
            approvedCount,
            pendingCount,
            totalCompletedLessons,
            totalAllLessons,
            overallProgress,
            resumeCourse
        });

    } catch (err) {
        next(err);
    }
};

// 2. Tab Khóa học của tôi: Danh sách chi tiết các môn đang học & đang chờ duyệt
const myCourses = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;
        const search = req.query.search ? req.query.search.trim() : '';
        const statusFilter = req.query.status ? req.query.status.trim() : ''; // 'approved' | 'pending' | ''

        // 2.1 Lấy toàn bộ khóa học đã ghi danh của sinh viên này
        let sql = `
            SELECT c.id, c.title, c.description, u.full_name AS instructor_name,
                   e.id AS enrollment_id, e.status AS enrollment_status, e.enrolled_at, e.reviewed_at,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM lesson_completions lc 
                    JOIN lessons l ON lc.lesson_id = l.id 
                    WHERE lc.user_id = ? AND l.course_id = c.id) AS completed_lessons
            FROM courses c
            JOIN enrollments e ON e.course_id = c.id
            JOIN users u ON c.instructor_id = u.id
            WHERE e.user_id = ?
        `;
        const params = [studentId, studentId];

        if (statusFilter && (statusFilter === 'approved' || statusFilter === 'pending' || statusFilter === 'rejected')) {
            sql += ' AND e.status = ?';
            params.push(statusFilter);
        }

        if (search) {
            sql += ' AND (c.title LIKE ? OR c.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY FIELD(e.status, "pending", "approved", "rejected"), e.enrolled_at DESC';

        const [enrolledList] = await db.query(sql, params);

        // Tính % tiến độ và tìm bài học kế tiếp cho từng môn
        for (const course of enrolledList) {
            course.progress = course.total_lessons > 0 
                ? Math.round((course.completed_lessons / course.total_lessons) * 100) 
                : 0;

            if (course.enrollment_status === 'approved') {
                const [lessons] = await db.query(`
                    SELECT l.id, l.title, l.lesson_order,
                           (SELECT COUNT(*) FROM lesson_completions WHERE user_id = ? AND lesson_id = l.id) AS is_done
                    FROM lessons l
                    WHERE l.course_id = ?
                    ORDER BY l.lesson_order ASC
                `, [studentId, course.id]);

                const nextIncomplete = lessons.find(l => l.is_done === 0);
                course.nextLesson = nextIncomplete || (lessons.length > 0 ? lessons[0] : null);
                course.allCompleted = lessons.length > 0 && lessons.every(l => l.is_done > 0);
            }
        }

        const approvedCourses = enrolledList.filter(c => c.enrollment_status === 'approved');
        const pendingCourses = enrolledList.filter(c => c.enrollment_status === 'pending');
        const rejectedCourses = enrolledList.filter(c => c.enrollment_status === 'rejected');

        let message = null;
        let messageType = 'success';
        if (req.query.enrolled === 'pending' || req.query.enrolled === 'success') {
            message = 'Ghi danh khóa học thành công! Yêu cầu của bạn đang chờ Giảng viên phê duyệt để bắt đầu học.';
            messageType = 'success';
        } else if (req.query.canceled === '1') {
            message = 'Đã hủy yêu cầu ghi danh khóa học thành công.';
            messageType = 'info';
        }

        res.render('student/my-courses', {
            title: 'LMS',
            enrolledList,
            approvedCourses,
            pendingCourses,
            rejectedCourses,
            search,
            statusFilter,
            message,
            messageType
        });

    } catch (err) {
        next(err);
    }
};

// 3. Học viên bấm nút "Đăng ký khóa học" -> Chuyển vào trạng thái Chờ Giảng viên duyệt (pending)
const enroll = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;
        const courseId = req.params.courseId;

        // Kiểm tra xem khóa học có tồn tại và đang mở không
        const [courseRows] = await db.query('SELECT id, title, status FROM courses WHERE id = ?', [courseId]);
        if (courseRows.length === 0 || courseRows[0].status !== 'published') {
            return res.status(404).render('error', { title: 'LMS', message: 'Khóa học này hiện không mở đăng ký!' });
        }

        // Tạo hoặc cập nhật lại yêu cầu ghi danh với trạng thái 'pending'
        await db.query(`
            INSERT INTO enrollments (user_id, course_id, status, enrolled_at)
            VALUES (?, ?, 'pending', NOW())
            ON DUPLICATE KEY UPDATE 
                reviewed_at = IF(status = 'rejected', NULL, reviewed_at),
                enrolled_at = IF(status = 'rejected', NOW(), enrolled_at),
                status = IF(status = 'rejected', 'pending', status)
        `, [studentId, courseId]);

        await logActivity(studentId, `POST /student/enroll/${courseId} (status: pending)`);

        // Xem học viên bấm Ghi danh từ trang nào (Chi tiết khóa học hay Khám phá khóa học hay My Courses)
        const referer = req.get('Referer') || '';
        if (referer.includes('/courses/' + courseId)) {
            return res.redirect(`/courses/${courseId}?enrolled=success`);
        } else if (referer.includes('/courses')) {
            return res.redirect(`/courses?enrolled=success`);
        }

        res.redirect('/student/my-courses?enrolled=success');
    } catch (err) {
        next(err);
    }
};

// 4. Sinh viên tự hủy yêu cầu ghi danh đang chờ duyệt hoặc xóa thông báo bị từ chối
const cancelEnrollment = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;
        const courseId = req.params.courseId;

        await db.query(
            'DELETE FROM enrollments WHERE user_id = ? AND course_id = ? AND status IN ("pending", "rejected")',
            [studentId, courseId]
        );

        await logActivity(studentId, `POST /student/enroll/${courseId}/cancel`);

        res.redirect('/student/my-courses?canceled=1');
    } catch (err) {
        next(err);
    }
};

// 5. Xem nội dung bài học cụ thể (Yêu cầu phải được duyệt: status = 'approved')
const viewLesson = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;
        const { courseId, lessonId } = req.params;

        // Kiểm tra bản ghi đăng ký và trạng thái xét duyệt
        const [enrolled] = await db.query(
            'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ?',
            [studentId, courseId]
        );

        if (enrolled.length === 0) {
            return res.status(403).render('error', {
                title: 'LMS',
                message: 'Bạn chưa đăng ký khóa học này! Vui lòng bấm Ghi danh để gửi yêu cầu tham gia.'
            });
        }

        if (enrolled[0].status === 'pending') {
            return res.status(403).render('error', {
                title: 'LMS',
                message: 'Yêu cầu ghi danh môn học này của bạn đang chờ Giảng viên phê duyệt. Bạn sẽ được vào học ngay khi Thầy/Cô duyệt đơn!'
            });
        }

        if (enrolled[0].status === 'rejected') {
            return res.status(403).render('error', {
                title: 'LMS',
                message: 'Yêu cầu tham gia khóa học này của bạn đã bị từ chối. Vui lòng liên hệ Giảng viên để được hỗ trợ.'
            });
        }

        // Lấy thông tin bài học hiện tại
        const [lessonRows] = await db.query(
            'SELECT * FROM lessons WHERE id = ? AND course_id = ?',
            [lessonId, courseId]
        );
        if (lessonRows.length === 0) {
            return res.status(404).render('error', {
                title: 'LMS',
                message: 'Không tìm thấy bài học này!'
            });
        }

        // Lấy danh sách tất cả các bài học trong khóa này + trạng thái đã hoàn thành hay chưa
        const [allLessons] = await db.query(`
            SELECT l.id, l.title, l.lesson_order,
                   (SELECT COUNT(*) FROM lesson_completions WHERE user_id = ? AND lesson_id = l.id) AS is_done
            FROM lessons l
            WHERE l.course_id = ?
            ORDER BY l.lesson_order ASC
        `, [studentId, courseId]);

        const [courseRows] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);

        const currentLessonId = parseInt(lessonId, 10);
        const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
        const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
        const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
        const isCurrentDone = currentIndex >= 0 ? allLessons[currentIndex].is_done > 0 : false;
        
        const completedCount = allLessons.filter(l => l.is_done > 0).length;
        const courseProgress = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;
        const isCourseCompleted = allLessons.length > 0 && completedCount >= allLessons.length;

        res.render('student/lesson', {
            title: 'LMS',
            course: courseRows[0],
            lesson: lessonRows[0],
            allLessons,
            currentIndex,
            prevLesson,
            nextLesson,
            isCurrentDone,
            completedCount,
            courseProgress,
            isCourseCompleted,
            courseCompletedAlert: req.query.course_completed === '1' || (isCourseCompleted && req.query.completed === '1'),
            completedSuccess: req.query.completed && req.query.course_completed !== '1' ? 'Chúc mừng bạn đã hoàn thành bài học này!' : null
        });

    } catch (err) {
        next(err);
    }
};

// 6. Bấm nút "Đánh dấu đã hoàn thành bài học"
const completeLesson = async (req, res, next) => {
    try {
        const studentId = req.session.user.id;
        const { courseId, lessonId } = req.params;

        // Chỉ cho phép hoàn thành khi enrollment là approved
        const [enrolled] = await db.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = "approved"',
            [studentId, courseId]
        );
        if (enrolled.length === 0) {
            return res.status(403).render('error', { title: 'LMS', message: 'Bạn không có quyền thao tác trên khóa học này!' });
        }

        await db.query(
            'INSERT IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)',
            [studentId, lessonId]
        );

        await logActivity(studentId, `POST /student/course/${courseId}/lesson/${lessonId}/complete`);

        // Kiểm tra xem sau khi hoàn thành bài này, sinh viên đã hoàn thành TOÀN BỘ khóa học chưa
        const [[{ totalLessons }]] = await db.query(
            'SELECT COUNT(*) AS totalLessons FROM lessons WHERE course_id = ?',
            [courseId]
        );
        const [[{ completedLessons }]] = await db.query(`
            SELECT COUNT(*) AS completedLessons FROM lesson_completions lc
            JOIN lessons l ON lc.lesson_id = l.id
            WHERE lc.user_id = ? AND l.course_id = ?
        `, [studentId, courseId]);

        const isCourseFinished = totalLessons > 0 && completedLessons >= totalLessons;

        if (isCourseFinished) {
            res.redirect(`/student/course/${courseId}/lesson/${lessonId}?course_completed=1`);
        } else {
            res.redirect(`/student/course/${courseId}/lesson/${lessonId}?completed=1`);
        }
    } catch (err) {
        next(err);
    }
};

module.exports = {
    dashboard,
    myCourses,
    enroll,
    cancelEnrollment,
    viewLesson,
    completeLesson
};
