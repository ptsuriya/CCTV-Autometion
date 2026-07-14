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

echo
echo "ติดตั้งส่วนประกอบที่จำเป็นเรียบร้อยแล้ว"
echo "หมายเหตุ: โปรเจกต์นี้ไม่จำเป็นต้องใช้ Node.js"
read -k 1 "?กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง..."
echo
