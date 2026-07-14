@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo ยังไม่พบไฟล์ .env
  echo ให้คัดลอก .env.example เป็น .env แล้วกรอกข้อมูล NVR ก่อน
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo ไม่พบ Python ใน PATH
  echo ให้รัน install_windows.bat แล้วเปิดหน้าต่างใหม่
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8787/api/status | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://127.0.0.1:8787/
  echo CCTV Automation เปิดอยู่แล้ว
  exit /b 0
)

start "CCTV Automation Server" cmd /k "cd /d ""%~dp0"" && python app.py"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8787/
echo เปิดเว็บ CCTV Automation แล้ว
pause
