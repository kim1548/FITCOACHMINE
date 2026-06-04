# FITCOACH 백엔드 실행 — 운동 분석 사이드카(3.10) + 메인 백엔드(3.14)를 함께 띄운다.
#
#   사용:  powershell -ExecutionPolicy Bypass -File backend\run_dev.ps1
#
# 영상 사이드카(8003): YOLO 크롭 + MediaPipe + 모델/룰 + 이벤트 점수 (영상 업로드 분석).
# 메인 백엔드(8001): 업로드 영상을 사이드카로 위임한다(VIDEO_SERVICE_URL).
$root = $PSScriptRoot
$venvPy = Join-Path $root "..\.venv310\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "[!] 3.10 venv가 없습니다: $venvPy" -ForegroundColor Red
    Write-Host "    먼저 만들어 주세요:" -ForegroundColor Yellow
    Write-Host "      py -3.10 -m venv ..\.venv310"
    Write-Host "      ..\.venv310\Scripts\python.exe -m pip install -r backend\requirements-models.txt"
    exit 1
}

Write-Host "영상 분석 사이드카 시작 → http://127.0.0.1:8003" -ForegroundColor Cyan
Start-Process -FilePath $venvPy `
    -ArgumentList "-m","uvicorn","video_service:app","--host","127.0.0.1","--port","8003" `
    -WorkingDirectory $root -WindowStyle Hidden

Start-Sleep -Seconds 3
Write-Host "메인 백엔드 시작 → http://127.0.0.1:8001" -ForegroundColor Cyan
Start-Process -FilePath "python" `
    -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8001" `
    -WorkingDirectory $root

Write-Host "서버를 시작했습니다. (영상 사이드카가 먼저 떠야 운동 분석이 동작합니다)" -ForegroundColor Green
