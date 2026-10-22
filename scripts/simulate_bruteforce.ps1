# ==============================================================================
# KỊCH BẢN MÔ PHỎNG TẤN CÔNG DÒ MẬT KHẨU (BRUTE-FORCE) CHO WINDOWS POWERSHELL
# Chạy trên Windows: .\simulate_bruteforce.ps1
# ==============================================================================

param (
    [string]$TargetUrl = "https://192.168.142.128/auth/login",
    [string]$TargetUser = "admin"
)

# Bỏ qua kiểm tra chứng chỉ SSL tự ký
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "🎯 BẮT ĐẦU MÔ PHỎNG TẤN CÔNG BRUTE-FORCE NHẮM VÀO: $TargetUser" -ForegroundColor Yellow
Write-Host "🌐 Mục tiêu: $TargetUrl" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

for ($i = 1; $i -le 20; $i++) {
    $Password = "WrongPass_" + (Get-Random -Minimum 10000 -Maximum 99999)
    $Body = @{
        username = $TargetUser
        password = $Password
    }

    try {
        $response = Invoke-WebRequest -Uri $TargetUrl -Method POST -Body $Body -UseBasicParsing -ErrorAction Stop
        Write-Host "[$i/20] Mật khẩu: $Password -> HTTP $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 429) {
            Write-Host "[$i/20] Mật khẩu: $Password -> HTTP 429: [ĐÃ BỊ CHẶN BỞI NGINX RATE LIMITING!]" -ForegroundColor Red
        } elseif ($status -eq 401) {
            Write-Host "[$i/20] Mật khẩu: $Password -> HTTP 401: [Sai mật khẩu - Đã ghi vết Forensics]" -ForegroundColor Yellow
        } else {
            Write-Host "[$i/20] Mật khẩu: $Password -> HTTP $status" -ForegroundColor Gray
        }
    }
    Start-Sleep -Milliseconds 100
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "✅ HOÀN TẤT 20 LẦN THỬ!" -ForegroundColor Green
Write-Host "1. Kiểm tra Cảnh báo Prometheus: http://192.168.142.128:9090/alerts" -ForegroundColor White
Write-Host "2. Kiểm tra Log trên Grafana:   {job=`"lms_app`"} |= `"Failed login attempt`"" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
