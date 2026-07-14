#!/bin/zsh

cd -- "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ยังไม่พบไฟล์ .env"
  echo "ให้ขอไฟล์ .env จากพี่หมี แล้ววางไว้ในโฟลเดอร์เดียวกับ app.py"
  read -k 1 "?กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง..."
  echo
  exit 1
fi

if curl -fsS --max-time 1 http://127.0.0.1:8787/api/status >/dev/null 2>&1; then
  open http://127.0.0.1:8787/
  exit 0
fi

/usr/bin/env python3 app.py &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

for _ in {1..20}; do
  if curl -fsS --max-time 1 http://127.0.0.1:8787/api/status >/dev/null 2>&1; then
    open http://127.0.0.1:8787/
    echo "เปิด Web base แล้ว"
    break
  fi
  sleep 0.25
done

wait "$SERVER_PID"
