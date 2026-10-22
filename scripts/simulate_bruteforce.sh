#!/bin/bash
# ==============================================================================
# KỊCH BẢN MÔ PHỎNG TẤN CÔNG DÒ MẬT KHẨU (BRUTE-FORCE ATTACK SIMULATION)
# Gửi 20 requests liên tiếp nhắm vào tài khoản quản trị viên (admin)
# ==============================================================================

TARGET_URL="${1:-https://192.168.142.128/auth/login}"
TARGET_USER="admin"

echo "======================================================================"
echo "🎯 BẮT ĐẦU MÔ PHỎNG TẤN CÔNG BRUTE-FORCE NHẮM VÀO TÀI KHOẢN: ${TARGET_USER}"
echo "🌐 Mục tiêu: ${TARGET_URL}"
echo "======================================================================"

for i in $(seq 1 20); do
    PASSWORD="WrongPass_$(date +%s%N | cut -b10-15)"
    
    # Bắn request POST thử mật khẩu sai
    STATUS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "${TARGET_URL}" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${TARGET_USER}&password=${PASSWORD}")

    if [ "$STATUS_CODE" -eq 429 ]; then
        echo "[Lần $i] Mật khẩu: ${PASSWORD} -> HTTP 429: [ĐÃ BỊ CHẶN BỞI NGINX RATE LIMITING!]"
    elif [ "$STATUS_CODE" -eq 401 ]; then
        echo "[Lần $i] Mật khẩu: ${PASSWORD} -> HTTP 401: [Sai mật khẩu - App ghi vết Forensic]"
    else
        echo "[Lần $i] Mật khẩu: ${PASSWORD} -> HTTP $STATUS_CODE"
    fi
    sleep 0.1
done

echo "======================================================================"
echo "✅ HOÀN TẤT 20 LẦN THỬ! Hãy kiểm tra:"
echo "1. Trạng thái cảnh báo trên Prometheus: http://192.168.142.128:9090/alerts"
echo "2. Truy vết Log trên Grafana Explore:   {job=\"lms_app\"} |= \"Failed login attempt\""
echo "======================================================================"
