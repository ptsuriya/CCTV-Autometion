@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo ยังไม่พบไฟล์ .env
  echo ให้ขอไฟล์ .env จากพี่หมี แล้ววางไว้ในโฟลเดอร์เดียวกับ app.py
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo ไม่พบ Python ใน PATH
  echo ให้รัน ติดตั้งระบบ_windows.bat แล้วเปิดหน้าต่างใหม่
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8787/api/status | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://127.0.0.1:8787/
  exit /b 0
)

start "CCTV Web base" cmd /k "cd /d ""%~dp0"" && python app.py"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8787/
