#!/bin/zsh

cd -- "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ยังไม่พบ .env"
  echo "ให้คัดลอก .env.example เป็น .env แล้วกรอกข้อมูลกล้องก่อน"
  read -k 1 "?กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง..."
  echo
  exit 1
fi

if curl -fsS --max-time 1 http://127.0.0.1:8787/api/status >/dev/null 2>&1; then
  open http://127.0.0.1:8787/
  echo "CCTV Automation เปิดอยู่แล้ว"
  exit 0
fi

/usr/bin/env python3 app.py &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

for _ in {1..20}; do
  if curl -fsS --max-time 1 http://127.0.0.1:8787/api/status >/dev/null 2>&1; then
    open http://127.0.0.1:8787/
    echo "เปิดเว็บ CCTV Automation แล้ว"
    break
  fi
  sleep 0.25
done

wait "$SERVER_PID"
