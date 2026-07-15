# คู่มือ Deploy Night Night CCTV บน mhee-dev

เอกสารนี้สำหรับติดตั้งระบบ Night Night CCTV บน `mhee-dev.rbru.ac.th` และเพิ่ม SSO ก่อนเปิดใช้งานจริง

## สถานะเครื่องปลายทางที่ตรวจแล้ว

- Host: `mhee-dev.rbru.ac.th` (`10.5.1.114`)
- SSH: เข้าได้ด้วย public key ในชื่อผู้ใช้ `poramart`
- OS: Ubuntu 24.04 / systemd
- Python: 3.12.3
- Node.js: 20.20.2
- พื้นที่ว่าง: ประมาณ 6.1 GB
- ยังไม่มี `ffmpeg` และ `nginx`
- ผู้ใช้ปัจจุบันไม่มี passwordless sudo

> ต้องให้ผู้ดูแลเซิร์ฟเวอร์ติดตั้งแพ็กเกจและสร้าง service ตามหัวข้อด้านล่าง หรือมอบสิทธิ์ sudo ที่เหมาะสมก่อน

## สถาปัตยกรรมที่แนะนำ

```text
ผู้ใช้ภายใน / VPN
        │ HTTPS + SSO
        ▼
Nginx :443 ──► OAuth2 Proxy :4180 ──► CCTV App :8787 (127.0.0.1 เท่านั้น)
                                                │
                                                ▼
                                          NVR ภายใน :554
```

- ห้ามเปิดพอร์ต `8787` หรือ RTSP `554` ออกสู่ Internet
- เก็บรหัส NVR ในไฟล์สิทธิ์ `600` ฝั่งเซิร์ฟเวอร์เท่านั้น และห้าม commit ลง Git
- เปิด HTTPS ก่อนเปิด SSO จริง เพราะ cookie ของ SSO ต้องเป็น secure cookie
- ตั้งสิทธิ์ SSO เฉพาะกลุ่มผู้ปฏิบัติงาน CCTV เช่น `cctv-operators`

## 1. ตรวจเครือข่ายจากเครื่องปลายทาง

SSH เข้าเครื่อง แล้วตรวจว่า NVR เข้าถึงได้ก่อน deploy:

```bash
ssh poramart@mhee-dev.rbru.ac.th

getent hosts arit-camera.rbru.ac.th
getent hosts itnvr.rbru.ac.th
nc -vz arit-camera.rbru.ac.th 554
nc -vz itnvr.rbru.ac.th 554
```

ต้องได้ผลเชื่อมต่อพอร์ต `554` สำเร็จจากเครื่อง `mhee-dev` มิฉะนั้นเว็บจะเปิดได้แต่ภาพสด/ย้อนหลังใช้ไม่ได้

## 2. ติดตั้ง dependency (ผู้ดูแลระบบ)

```bash
sudo apt update
sudo apt install -y ffmpeg nginx python3-venv git
```

Node.js มีอยู่แล้ว ใช้เฉพาะขั้น build หน้าเว็บ ไม่จำเป็นต่อการรัน backend หลัง build เสร็จ

## 3. วางโปรเจกต์และสร้างไฟล์ environment

ตัวอย่างนี้ใช้ path มาตรฐาน `/opt/night-night-cctv`:

```bash
sudo install -d -o poramart -g poramart /opt/night-night-cctv
sudo -u poramart git clone <REPOSITORY_URL> /opt/night-night-cctv
cd /opt/night-night-cctv

npm --prefix frontend ci
npm --prefix frontend run build
```

สร้าง `/etc/night-night-cctv/cctv.env` โดยให้ผู้ดูแล NVR หรือ “หมี” ส่งค่า credential ผ่านช่องทางที่ปลอดภัย:

```dotenv
CCTV_WEB_HOST=127.0.0.1
CCTV_WEB_PORT=8787
CCTV_TIMEZONE=Asia/Bangkok

# ขอค่าเหล่านี้จากผู้ดูแล NVR — ห้ามใส่ลง Git
CCTV_LIVE_HOST=
CCTV_LIVE_PORT=554
CCTV_USERNAME=
CCTV_PASSWORD=
CCTV_PLAYBACK_HOST=
CCTV_PLAYBACK_PORT=554
CCTV_PLAYBACK_USERNAME=
CCTV_PLAYBACK_PASSWORD=
CCTV_ISAPI_HOST=
CCTV_ISAPI_PORT=80
CCTV_ISAPI_USERNAME=
CCTV_ISAPI_PASSWORD=
```

```bash
sudo install -d -m 750 /etc/night-night-cctv
sudo chown root:poramart /etc/night-night-cctv
sudo chmod 750 /etc/night-night-cctv
sudo chmod 640 /etc/night-night-cctv/cctv.env
```

## 4. สร้าง systemd service

สร้าง `/etc/systemd/system/night-night-cctv.service`:

```ini
[Unit]
Description=Night Night CCTV local application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=poramart
Group=poramart
WorkingDirectory=/opt/night-night-cctv
EnvironmentFile=/etc/night-night-cctv/cctv.env
ExecStart=/usr/bin/python3 /opt/night-night-cctv/app.py
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

เปิด service และตรวจ log:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now night-night-cctv
sudo systemctl status night-night-cctv
journalctl -u night-night-cctv -f
```

ทดสอบจากเครื่องปลายทาง:

```bash
curl -I http://127.0.0.1:8787/
```

## 5. Nginx และ HTTPS

ตัวอย่าง virtual host (แทน `<CCTV_DOMAIN>` ด้วย domain ที่อนุมัติจริง):

```nginx
server {
    listen 443 ssl http2;
    server_name <CCTV_DOMAIN>;

    ssl_certificate     /etc/letsencrypt/live/<CCTV_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<CCTV_DOMAIN>/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;

        # สำคัญกับ MJPEG ของภาพสด/ย้อนหลัง
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. เพิ่ม SSO (แนะนำก่อนเปิดใช้จริง)

ใช้ OAuth2 Proxy หน้า Nginx และต่อกับ Identity Provider ที่มหาวิทยาลัยมีอยู่แล้ว:

- ถ้าองค์กรใช้ Microsoft 365: Microsoft Entra ID
- ถ้ามีระบบ Identity ภายใน: Keycloak / OIDC

สิ่งที่ต้องขอจากผู้ดูแล SSO:

1. OIDC issuer URL
2. Client ID และ Client Secret
3. Redirect URL: `https://<CCTV_DOMAIN>/oauth2/callback`
4. กลุ่มที่อนุญาต เช่น `cctv-operators`
5. ค่า cookie secret แบบสุ่มที่ปลอดภัย

ตัวอย่าง `/etc/oauth2-proxy/cctv.cfg`:

```toml
provider = "oidc"
oidc_issuer_url = "<OIDC_ISSUER_URL>"
client_id = "<CLIENT_ID>"
client_secret = "<CLIENT_SECRET>"
redirect_url = "https://<CCTV_DOMAIN>/oauth2/callback"
cookie_secret = "<RANDOM_32_BYTE_BASE64_SECRET>"
cookie_secure = true
email_domains = ["rbru.ac.th"]
upstreams = ["http://127.0.0.1:8787/"]
set_xauthrequest = true
pass_user_headers = true
```

เพิ่ม Nginx auth request ก่อน `location /` แล้วแยก `/oauth2/` ไปที่ OAuth2 Proxy:

```nginx
location = /oauth2/auth {
    proxy_pass http://127.0.0.1:4180;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}

location /oauth2/ {
    proxy_pass http://127.0.0.1:4180;
}

location / {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/sign_in;
    proxy_pass http://127.0.0.1:8787;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}
```

## 7. Checklist ก่อนเปิดใช้งาน

- [ ] NVR ทั้ง live และ playback ใช้งานจาก `mhee-dev` ได้
- [ ] `.env` / `cctv.env` ไม่อยู่ใน Git และมีสิทธิ์อ่านเฉพาะที่จำเป็น
- [ ] พอร์ต 8787 เปิดเฉพาะ loopback
- [ ] Nginx เปิด HTTPS พร้อม certificate ที่ถูกต้อง
- [ ] SSO จำกัดผู้ใช้หรือกลุ่ม CCTV แล้ว
- [ ] ทดสอบภาพสด, Timeline, บันทึกภาพ และดาวน์โหลดผลลัพธ์
- [ ] กำหนดนโยบายลบไฟล์ใน `captures/` และ `exports/` ตามพื้นที่ดิสก์

## คำสั่งอัปเดตภายหลัง

```bash
cd /opt/night-night-cctv
git pull
npm --prefix frontend ci
npm --prefix frontend run build
sudo systemctl restart night-night-cctv
```
