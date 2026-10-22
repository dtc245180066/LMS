# 1. Base image Node.js 20 trên nền Alpine Linux
FROM node:20-alpine

# 2. Khai báo chế độ production
ENV NODE_ENV=production

# 3. TẠO USER VÀ GROUP RIÊNG MANG TÊN BẠN (ANLT)
RUN addgroup -S anlt && adduser -S anlt -G anlt

# 4. Đặt thư mục làm việc trong nhà của user anlt
WORKDIR /home/anlt/app

# 5. Trao quyền sở hữu thư mục cho anlt
RUN chown -R anlt:anlt /home/anlt/app

# 6. KÍCH HOẠT CHẠY DƯỚI QUYỀN USER ANLT (Non-root Hardening)
USER anlt

# 7. Copy file thư viện vào với quyền sở hữu anlt (Tận dụng Docker Cache)
COPY --chown=anlt:anlt package*.json ./

# 8. Cài đặt thư viện phụ thuộc
RUN npm install --omit=dev

# 9. Copy toàn bộ mã nguồn vào (thuộc quyền sở hữu của anlt)
COPY --chown=anlt:anlt . .

# 10. Khai báo cổng ứng dụng
EXPOSE 3000

# 11. Khởi chạy server
CMD ["node", "server.js"]