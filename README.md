# HỆ THỐNG QUẢN LÝ HỌC TẬP TRỰC TUYẾN (SIMPLE LMS)
> **Bài tập lớn môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Đề tài số:** 17 — Hệ thống Học trực tuyến (Simple LMS)  
> **Sinh viên thực hiện:** Lê Tâm An (AnLT)  
> **Mã số sinh viên:** DTC245180066  
> **Trường:** Đại học Công nghệ Thông tin & Truyền thông — Đại học Thái Nguyên (ICTU)

---

## 📌 1. Giới thiệu Dự án
Hệ thống **Simple LMS** là giải pháp học tập trực tuyến xây dựng theo kiến trúc phân tầng MVC (Model - View - Controller) trên nền tảng **Node.js/Express** và **MySQL 8.0**. 

Dự án được đóng gói container hóa toàn diện bằng **Docker & Docker Compose**, đứng sau **Nginx Reverse Proxy** hỗ trợ HTTPS tự ký (SSL/TLS với SAN), phân tách mạng bảo mật (**Network Isolation**) và tuân thủ các nguyên tắc bảo mật công nghiệp (**System Hardening**).

---

## 🏗️ 2. Kiến trúc Hệ thống (Chặng 1)

```
                            [ Người dùng / Trình duyệt ]
                                         │
                    ┌────────────────────┴────────────────────┐
           Port 80 (HTTP) ── 301 Redirect                  Port 443 (HTTPS)
                    └────────────────────┬────────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Nginx Reverse Proxy (lms_nginx)   │
                      │  - SSL/TLS (SAN: DNS + IP)           │
                      │  - 6 Security Headers                │
                      │  - Network: webnet                   │
                      └──────────────────┬───────────────────┘
                                         │ proxy_pass: http://app:3000
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      Node.js LMS App (lms_app)       │
                      │  - Non-root user: anlt (UID 1000)    │
                      │  - Networks: webnet & dbnet (Bridge) │
                      └──────────────────┬───────────────────┘
                                         │ TCP: 3306 (Internal Only)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │        MySQL 8.0 DB (lms_db)         │
                      │  - Port 3306 KHÔNG publish ra ngoài  │
                      │  - Volume: db_data:/var/lib/mysql    │
                      │  - Network: dbnet                    │
                      └──────────────────┬───────────────────┘
                                         ▲
                                         │ Quản trị trực quan
                      ┌──────────────────┴───────────────────┐
                      │    phpMyAdmin (lms_phpmyadmin)       │
                      │  - Port: 8080:80                     │
                      │  - Networks: webnet & dbnet          │
                      └──────────────────────────────────────┘
```

---

## 🛡️ 3. Các biện pháp Bảo mật (System Hardening)
1. **Container Non-Root:** Container `lms_app` chạy dưới user định danh giới hạn `anlt` (UID 1000, GID 1000), loại bỏ nguy cơ leo thang đặc quyền container breakout.
2. **Phân tách mạng nội bộ biệt lập (Network Isolation & Internal Network):**
   - Mạng `webnet`: Mạng mở (DMZ), chỉ gồm `nginx`, `app` và cổng quản trị `phpmyadmin`.
   - Mạng `dbnet`: Kích hoạt cờ `internal: true` cô lập 100% khỏi Internet, chứa `app`, `db` và `phpmyadmin`.
   - **Tuyệt đối không ánh xạ cổng MySQL 3306 ra ngoài máy chủ.**
3. **Phân quyền Cơ sở Dữ liệu tối thiểu (Principle of Least Privilege):**
   - Tài khoản ứng dụng `lms_user` bị thu hồi toàn bộ quyền quản trị cấu trúc nguy hiểm (`DROP`, `ALTER`, `GRANT OPTION`).
   - Chỉ được cấp đúng 4 quyền thao tác dữ liệu (DML): `SELECT, INSERT, UPDATE, DELETE`, ngăn chặn hoàn toàn nguy cơ tấn công SQL Injection phá hủy bảng.
4. **Nginx Security Headers:** Cấu hình 6 headers chuẩn OWASP:
   - `X-Frame-Options: SAMEORIGIN` (Chống Clickjacking).
   - `X-Content-Type-Options: nosniff` (Chống MIME-sniffing).
   - `X-XSS-Protection: 1; mode=block` (Chống Cross-site Scripting).
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Strict-Transport-Security` (Ép duyệt HTTPS / HSTS).
   - `Content-Security-Policy` (Kiểm soát nguồn nạp script, style, image).
5. **An toàn cấu hình (12-Factor App):** Mọi bí mật kết nối cơ sở dữ liệu và session lưu trong biến môi trường `.env`, tuyệt đối không commit file bí mật và private key lên Git.

---

## 🚀 4. Hướng dẫn Khởi chạy Hệ thống

### 4.1. Yêu cầu Môi trường
- Hệ điều hành: Linux (Ubuntu 20.04/22.04 LTS) hoặc WSL2 / Windows có Docker Desktop.
- Cài đặt sẵn: `docker` ($\ge 24.0$) và `docker compose` ($\ge v2.0$).

### 4.2. Các bước triển khai

#### Bước 1: Clone Repository
```bash
git clone https://github.com/dtc245180066/LMS.git
cd LMS
```

#### Bước 2: Thiết lập biến môi trường
Sao chép cấu hình mẫu từ `.env.example`:
```bash
cp .env.example .env
```
*(Có thể tùy chỉnh mật khẩu DB hoặc Secret Key trong `.env` nếu cần).*

#### Bước 3: Tạo chứng chỉ SSL tự ký cho Nginx
Hệ thống cung cấp sẵn script tự động sinh chứng chỉ chuẩn RSA 2048-bit với Subject Alternative Name (SAN) cho cả tên miền và IP:
```bash
chmod +x nginx/gen-cert.sh
./nginx/gen-cert.sh
```

#### Bước 4: Cấu hình phân giải tên miền ảo (`lms.vn`)
- **Trên máy Ubuntu:** Thêm vào file `/etc/hosts`:
  ```text
  127.0.0.1   lms.vn
  ```
- **Trên máy Windows (nếu chạy qua VMware / máy ảo):** Thêm vào `C:\Windows\System32\drivers\etc\hosts`:
  ```text
  <IP_MAY_AO_UBUNTU>   lms.vn
  ```
  *(Ví dụ: `192.168.142.128  lms.vn`)*

#### Bước 5: Khởi chạy cụm container
```bash
docker compose up -d
```

Kiểm tra trạng thái các container hoạt động:
```bash
docker compose ps
```

---

## 🌐 5. Thông tin Truy cập Dịch vụ & Tài khoản Mẫu

| Dịch vụ | Địa chỉ URL | Giao thức / Cổng | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Hệ thống LMS** | `https://lms.vn` hoặc `https://<IP_UBUNTU>` | HTTPS (Cổng 443, tự chuyển hướng từ 80) | Giao diện học tập, giảng dạy & quản trị |
| **phpMyAdmin** | `http://<IP_UBUNTU>:8080` | HTTP (Cổng 8080) | Quản trị CSDL trực quan |
| **Grafana Dashboard** | `http://<IP_UBUNTU>:3001` | HTTP (Cổng 3001) | Đăng nhập: `admin` / `admin` (Đầy đủ dashboard Container/Web/DB) |
| **Prometheus Web UI** | `http://<IP_UBUNTU>:9090` | HTTP (Cổng 9090) | Bộ não giám sát, kiểm tra Target & PromQL |
| **cAdvisor Web UI** | `http://<IP_UBUNTU>:8081` | HTTP (Cổng 8081) | Giám sát tài nguyên phần cứng Container |

### Danh sách tài khoản thử nghiệm hệ thống (Mật khẩu đã mã hóa Bcrypt trong DB):
| Vai trò (Role) | Email đăng nhập | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@lms.vn` | `Admin@123` | Quản trị tài khoản, danh mục, thống kê hệ thống |
| **Giảng viên (Instructor)** | `gv_nam@lms.vn` | `Gv@123` | Tạo khóa học, bài học, phê duyệt học viên |
| **Học viên (Student)** | `sv_an@lms.vn` | `Sv@123` | Đăng ký khóa học, học bài trực tuyến, xem tiến độ |

---

## 📋 6. Lịch trình Commits (Tuân thủ Barem Đánh giá 3 Commit)
- **Commit 1/3 (Chặng 1):** `feat(infra): deploy LMS with Nginx HTTPS reverse proxy, MySQL 8.0, phpMyAdmin and network isolation`
- **Commit 2/3 (Chặng 2):** `feat(monitoring): integrate Prometheus metrics, Grafana dashboards and container exporters`
- **Commit 3/3 (Chặng 3):** `feat(logging): centralize logs with Loki, Promtail, LogQL queries and project documentation`

