#!/bin/bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/self-signed.key \
  -out nginx/ssl/self-signed.crt \
  -subj "/C=VN/ST=ThaiNguyen/L=ThaiNguyen/O=ICTU/OU=LMS/CN=lms.vn" \
  -addext "subjectAltName=DNS:lms.vn,DNS:localhost,IP:127.0.0.1,IP:192.168.142.128"
echo "Sinh chứng chỉ SSL tự ký cho lms.vn thành công!"