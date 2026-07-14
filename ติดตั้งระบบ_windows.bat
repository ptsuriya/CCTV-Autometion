@echo off
setlocal
cd /d "%~dp0"

echo CCTV Automation - ติดตั้งส่วนประกอบสำหรับ Windows Web base
echo.

where winget >nul 2>&1
if errorlevel 1 (
  echo ไม่พบ winget กรุณาอัปเดต App Installer จาก Microsoft Store ก่อน
  pause
  exit /b 1
)

echo [1/2] ติดตั้งหรืออัปเดต Python 3.12
winget install --id Python.Python.3.12 --exact --source winget --accept-source-agreements --accept-package-agreements

echo.
echo [2/2] ติดตั้งหรืออัปเดต ffmpeg
winget install --id Gyan.FFmpeg --exact --source winget --accept-source-agreements --accept-package-agreements

echo.
echo ติดตั้งส่วนประกอบที่จำเป็นเสร็จแล้ว
echo Web base พร้อมใช้งานแล้ว
echo Electron เก็บไว้ใน developer\electron และยังไม่ใช้ในรุ่นนี้
echo ปิดหน้าต่างนี้แล้วเปิดใหม่ก่อนใช้ เปิดโปรแกรม_windows.bat
pause
