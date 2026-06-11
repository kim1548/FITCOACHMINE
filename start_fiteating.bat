@echo off
title FitEating Launcher

REM ===== Backend (FastAPI / uvicorn on :8001) =====
start "FitEating Backend" /min cmd /k "cd /d C:\Project\FitEating-main\backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

REM ===== Frontend (Vite on :5173) =====
start "FitEating Frontend" /min cmd /k "cd /d C:\Project\FitEating-main\frontend && npm run dev"

REM ===== (터널은 자동 발급하지 않음) =====
REM 폰 접속용 주소가 필요할 때만 수동으로 아래를 1회 실행:
REM   powershell -ExecutionPolicy Bypass -File "C:\Project\FitEating-main\start-tunnel.ps1"

REM ===== Wait for servers, then open browser =====
timeout /t 10 /nobreak >nul
start "" "http://localhost:5173/"

exit
