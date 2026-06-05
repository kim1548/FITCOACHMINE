# Cloudflare 임시 터널을 띄우고, 발급된 주소를 frontend/public/app-link.txt 에 자동 기록한다.
# 앱(SET → Get the app)은 이 파일을 읽으므로, 터널 주소가 바뀌어도 이 스크립트만 실행하면 자동 반영된다.
#
# 사용:  powershell -ExecutionPolicy Bypass -File start-tunnel.ps1
$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$linkFile = Join-Path $root "frontend\public\app-link.txt"
$log = Join-Path $env:TEMP "cf_tunnel.log"

# 기존 cloudflared 종료
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
if (Test-Path $log) { Remove-Item $log -Force }

Write-Host "Cloudflare 터널 시작 (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://localhost:5173" `
    -WindowStyle Hidden -RedirectStandardError $log -RedirectStandardOutput "$env:TEMP\cf_tunnel.out"

# 발급 주소 대기
$url = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
}

if ($url) {
    # BOM 없이 기록 (앱이 깔끔히 읽도록)
    [System.IO.File]::WriteAllText($linkFile, $url)
    Write-Host ""
    Write-Host "터널 주소: $url" -ForegroundColor Green
    Write-Host "→ $linkFile 에 자동 기록 완료. 앱이 자동으로 이 주소를 표시합니다." -ForegroundColor Green
} else {
    Write-Host "주소 발급 실패. 로그:" -ForegroundColor Red
    Get-Content $log | Select-Object -Last 8
}
