const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Thư mục lưu trữ tài liệu bài giảng
const uploadDir = path.join(__dirname, '../../public/uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ tệp trên đĩa
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Đảm bảo tên file an toàn, duy nhất
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext);
    const safeName = rawName
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')
      .slice(0, 60);
    cb(null, `${safeName}_${uniqueSuffix}${ext}`);
  }
});

// Danh mục định dạng đa dạng: Tài liệu văn phòng, nén, ảnh, mã nguồn
const ALLOWED_EXTENSIONS = [
  // Văn phòng & Tài liệu đọc
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv',
  // Tệp nén tài nguyên / bài tập
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Hình ảnh sơ đồ / minh họa
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  // Mã nguồn lập trình
  '.c', '.cpp', '.h', '.hpp', '.java', '.py', '.js', '.ts', '.html', '.css', '.json', '.sql'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Định dạng tệp "${ext}" không được hỗ trợ! Vui lòng tải tài liệu (.pdf, .docx, .pptx, .xlsx, .zip, .rar, .txt, .cpp, .py, hình ảnh...).`));
  }
};

const uploadMaterial = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // Tối đa 50MB
  }
});

module.exports = uploadMaterial;
