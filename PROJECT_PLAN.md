# DỰ ÁN LMS — HỆ THỐNG QUẢN LÝ HỌC TẬP ĐƠN GIẢN
## Kế hoạch, Tiêu chí Barem 10 Điểm và Nhật ký Phát triển

---

### PHẦN 1: BAREM ĐÁNH GIÁ CHÍNH THỨC CỦA MÔN HỌC (THANG ĐIỂM 10)

| STT | Tiêu chí đánh giá | Nội dung đánh giá chi tiết | Điểm | Kế hoạch đáp ứng cụ thể |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Quản lý mã nguồn trên GitHub** | Repository đầy đủ (source + cấu hình), **đủ 03 commit** và nội dung có ý nghĩa, có **README** hướng dẫn chạy hệ thống rõ ràng. Đặt tên tài khoản/repo theo **Mã số SV**. | **1.5** | Khởi tạo Git repo, phân chia chính xác 3 commit theo 3 mốc barem, viết file `README.md` chi tiết từ A-Z. |
| **2** | **Triển khai ứng dụng + Database** | Ứng dụng chạy ổn định, kết nối DB thành công, có **phpMyAdmin** hoạt động. | **1.5** | Web LMS Node.js kết nối MySQL 8.0 ổn định, tích hợp container phpMyAdmin quản lý trực quan. |
| **3** | **Nginx Reverse Proxy** | Cấu hình reverse proxy đúng, truy cập website qua Nginx (có **HTTPS tự ký** hoặc **security headers** cơ bản). *(-> Chốt Commit 1)* | **1.5** | Nginx đón cổng 80/443, cấp chứng chỉ SSL tự ký, thêm các security headers (`X-Frame-Options`, `X-Content-Type-Options`...). |
| **4** | **Hệ thống giám sát (Prometheus + Grafana)** | Prometheus thu thập metrics, Grafana có dashboard giám sát **container / web / DB**. *(-> Chốt Commit 2)* | **1.5** | Tích hợp Prometheus + cAdvisor (container) + Node Exporter (server) + MySQL Exporter + Nginx Exporter + Dashboard Grafana trực quan. |
| **5** | **Hệ thống log tập trung (Loki)** | Loki + Promtail hoạt động, truy vấn được log bằng **LogQL (ít nhất 2–3 query cơ bản)**. *(-> Chốt Commit 3)* | **1.5** | Promtail thu gom log Nginx & App đẩy về Loki, chuẩn bị sẵn 3 câu truy vấn LogQL mẫu có giải thích. |
| **6** | **Hardening hệ thống** | Áp dụng ít nhất **3–4 biện pháp bảo mật**: non-root container, network isolation, mật khẩu mạnh, security headers Nginx, hạn chế quyền DB... | **1.5** | - Non-root container (Node user)<br>- Network isolation (tách mạng `frontend_net`, `backend_net`, `monitor_net`)<br>- Bảo mật `.env`<br>- Nginx Security Headers |
| **7** | **Tổng thể & Trình bày** | Hệ thống chạy hoàn chỉnh bằng `docker-compose`, demo rõ ràng, có screenshot/minh chứng, chắc kiến thức, hiểu bài. **Báo cáo tổng hợp tối thiểu 10 trang**. | **1.0** | Viết file khung Báo cáo $\ge 10$ trang, chụp ảnh minh chứng từng bước, nắm vững bản chất nhờ phương pháp `learn`. |
| **TỔNG** | **TOÀN BỘ DỰ ÁN** | | **10.0** | **Mục tiêu đạt điểm 9.5 – 10.0** |

---

### PHẦN 2: YÊU CẦU ĐẶC THÙ ĐỀ 17 & KHUNG KỸ NGHỆ PHẦN MỀM
* **Đề tài:** Đề 17 - Hệ thống Học trực tuyến (LMS đơn giản).
* **Nghiệp vụ cốt lõi:** Quản lý Khóa học, Bài học, Học viên, Đăng ký khóa học.
* **Các vai trò:**
  1. **Admin (Quản trị viên):** Quản lý tài khoản, danh mục khóa học, xem thống kê tổng quan.
  2. **Instructor (Giảng viên):** Tạo/sửa khóa học phụ trách, thêm bài học, xem danh sách học viên.
  3. **Student (Học viên):** Đăng ký/đăng nhập, xem khóa học, đăng ký tham gia, theo dõi tiến độ.
* **Cấu trúc Backend:** Mô hình phân tầng MVC sạch sẽ (`config`, `controllers`, `routes`, `middlewares`, `views`).

---

### PHẦN 3: LỘ TRÌNH THỰC HIỆN 13 GIAI ĐOẠN

#### 🔴 CHẶNG 1: HOÀN THIỆN WEB LMS, DATABASE, NGINX SSL & BẢO MẬT (Mục tiêu: 4.5 Điểm - Tiêu chí 1, 2, 3, 6)
- [x] **Giai đoạn 0:** Khảo sát môi trường, kiểm tra repository và chốt tiêu chí barem.
- [x] **Giai đoạn 1:** Phân tích nghiệp vụ MVP cho 3 vai trò (Admin, Instructor, Student).
- [x] **Giai đoạn 2:** Thiết kế kiến trúc thư mục phân tầng MVC.
- [x] **Giai đoạn 3:** Thiết kế CSDL (ERD Mermaid) và module hóa `database/01_schema.sql` (Schema) & `database/02_seed.sql` (Seed Data có mã hóa Bcrypt).
- [x] **Giai đoạn 4:** Khởi tạo Git repo, cấu hình `.gitignore` và bảo mật file `.env`.
- [x] **Giai đoạn 5:** Tách lớp Backend: cấu hình kết nối MySQL Pool và middleware xử lý lỗi tập trung.
- [x] **Giai đoạn 6:** Xây dựng module Xác thực & Phân quyền (Đăng ký, Đăng nhập, Session).
- [x] **Giai đoạn 7:** Xây dựng module Quản lý Khóa học & Bài học (Admin & Giảng viên).
- [x] **Giai đoạn 8:** Xây dựng module Học viên (Xem bài học, Đăng ký học, chống trùng lặp).
- [x] **Giai đoạn 9:** Xây dựng module Tiến độ học tập & Dashboard thống kê (dữ liệu thật từ DB).
- [x] **Giai đoạn 10:** Đóng gói Dockerfile (non-root) + Nginx SSL tự ký + phpMyAdmin + `docker-compose.yml` (network isolation) $\rightarrow$ **CHỐT VÀ PUSH COMMIT 1**.

#### 🟡 CHẶNG 2: HỆ THỐNG GIÁM SÁT PROMETHEUS + GRAFANA (Mục tiêu: 1.5 Điểm - Tiêu chí 4)
- [ ] **Giai đoạn 11:** Tích hợp Prometheus + cAdvisor + Node Exporter + MySQL Exporter + Nginx Exporter + Dashboard Grafana $\rightarrow$ **CHỐT VÀ PUSH COMMIT 2**.

#### 🟢 CHẶNG 3: HỆ THỐNG LOG LOKI + BÁO CÁO (Mục tiêu: 2.5 Điểm - Tiêu chí 5, 7)
- [ ] **Giai đoạn 12:** Tích hợp Loki + Promtail, viết và kiểm thử 2-3 câu query LogQL $\rightarrow$ **CHỐT VÀ PUSH COMMIT 3**.
- [ ] **Giai đoạn 13:** Kiểm thử toàn diện, viết `README.md` và hoàn thiện Báo cáo tổng hợp $\ge 10$ trang.

---

### PHẦN 4: NGUYÊN TẮC ĐỒNG HÀNH (`learn`)
* Giải thích rõ mục tiêu và bản chất kỹ thuật trước khi làm.
* Chia việc thành từng bước nhỏ, người học tự kiểm tra và nắm vững kiến thức.
* Không sinh code ồ ạt; giải thích cặn kẽ luồng dữ liệu giữa Frontend $\leftrightarrow$ Backend $\leftrightarrow$ Database.

