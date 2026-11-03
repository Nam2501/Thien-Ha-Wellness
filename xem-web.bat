@echo off
chcp 65001 >nul
rem Build website roi mo xem tren may: http://localhost:8080
cd /d "%~dp0"
node build.mjs || (echo Build loi, xem thong bao o tren. & pause & exit /b 1)
start "" http://localhost:8080/
where py >nul 2>nul && (py -m http.server 8080 --directory dist) || (python -m http.server 8080 --directory dist)
