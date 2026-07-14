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

echo [1/4] ติดตั้งหรืออัปเดต Python 3.12
winget install --id Python.Python.3.12 --exact --source winget --accept-source-agreements --accept-package-agreements

echo.
echo [2/4] ติดตั้งหรืออัปเดต ffmpeg
winget install --id Gyan.FFmpeg --exact --source winget --accept-source-agreements --accept-package-agreements

echo.
echo [3/4] ติดตั้งหรืออัปเดต Node.js LTS สำหรับ build หน้า React
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements
set "PATH=%ProgramFiles%\nodejs;%PATH%"

where npm >nul 2>&1
if errorlevel 1 (
  echo ไม่พบ npm หลังติดตั้ง Node.js กรุณาปิดหน้าต่างแล้วเปิดไฟล์นี้ใหม่อีกครั้ง
  pause
  exit /b 1
)

echo.
echo [4/4] ติดตั้งแพ็กเกจ React และ build หน้าเว็บ
call npm --prefix frontend install
if errorlevel 1 (
  echo ติดตั้งแพ็กเกจ React ไม่สำเร็จ
  pause
  exit /b 1
)
call npm --prefix frontend run build
if errorlevel 1 (
  echo build หน้าเว็บไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo ติดตั้งส่วนประกอบและ build หน้าเว็บเสร็จแล้ว
echo Web base พร้อมใช้งานแล้ว
echo Node.js ใช้ตอนติดตั้ง/build เท่านั้น การเปิดโปรแกรมใช้ Python เสิร์ฟไฟล์ที่ build แล้ว
echo Electron เก็บไว้ใน developer\electron และยังไม่ใช้ในรุ่นนี้
echo ปิดหน้าต่างนี้แล้วเปิดใหม่ก่อนใช้ เปิดโปรแกรม_windows.bat
pause
