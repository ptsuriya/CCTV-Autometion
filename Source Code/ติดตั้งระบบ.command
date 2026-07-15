#!/bin/zsh

set -e
cd -- "$(dirname "$0")"

echo "CCTV Automation - ตรวจสอบส่วนประกอบที่จำเป็น"
echo

if ! command -v brew >/dev/null 2>&1; then
  echo "ไม่พบ Homebrew"
  echo "กรุณาติดตั้ง Homebrew จาก https://brew.sh แล้วเปิดไฟล์นี้อีกครั้ง"
  read -k 1 "?กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง..."
  echo
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  echo "พบ Python: $(python3 --version)"
else
  echo "กำลังติดตั้ง Python..."
  brew install python
fi

if command -v ffmpeg >/dev/null 2>&1; then
  echo "พบ ffmpeg: $(ffmpeg -version 2>/dev/null | head -1)"
else
  echo "กำลังติดตั้ง ffmpeg..."
  brew install ffmpeg
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  echo "พบ Node.js: $(node --version)"
else
  echo "กำลังติดตั้ง Node.js สำหรับ build หน้า React..."
  brew install node
fi

echo "กำลังติดตั้งแพ็กเกจ React และ build หน้าเว็บ..."
npm --prefix frontend install
npm --prefix frontend run build

echo
echo "ติดตั้งส่วนประกอบและ build หน้าเว็บเรียบร้อยแล้ว"
echo "Web base พร้อมใช้งานแล้ว"
echo "Node.js ใช้ตอนติดตั้ง/build เท่านั้น การเปิดโปรแกรมใช้ Python เสิร์ฟไฟล์ที่ build แล้ว"
echo "หมายเหตุ: Electron เก็บไว้ใน developer/electron และยังไม่ใช้ในรุ่นนี้"
read -k 1 "?กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง..."
echo
