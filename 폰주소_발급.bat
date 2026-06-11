@echo off
chcp 65001 >nul
title 폰 접속 주소 발급
echo ================================================
echo  폰 접속(HTTPS) 주소를 발급합니다...
echo  (프론트가 먼저 켜져 있어야 합니다 - 5173)
echo ================================================
echo.
powershell -ExecutionPolicy Bypass -File "C:\Project\FitEating-main\start-tunnel.ps1"
echo.
echo ------------------------------------------------
echo  위 "터널 주소"를 폰 브라우저에서 열거나,
echo  앱의 SET - Get the app 에서도 확인할 수 있습니다.
echo  이 창은 닫아도 터널은 계속 유지됩니다.
echo ------------------------------------------------
pause
