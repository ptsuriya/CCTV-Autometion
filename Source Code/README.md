# CCTV Automation

โปรแกรมทำงานในเครื่องนี้เอง มี Web base สำหรับแคปภาพสดตามตารางเวลาและดึงภาพย้อนหลังจาก NVR

โปรเจกต์อยู่ที่:

```text
/Volumes/DriveG/dev/workspace/github/CCTV Autometion
```

คู่มือฉบับเต็ม: [คู่มือการใช้งาน.md](../คู่มือการใช้งาน.md)

## ความสามารถ

- ภาพรวมทุกช่องที่กำหนดไว้ 18 ช่องในครั้งเดียว
- สร้างภาพรวมแบบตารางอัตโนมัติ เช่น 6 x 3 ช่อง
- เก็บภาพกล้องแต่ละช่องและภาพรวมไว้ในโฟลเดอร์ `รวมกล้อง` เดียวกัน ไม่สร้างไฟล์ซ้ำ
- กดบันทึกภาพย้อนหลังโดยระบุวันที่ เวลา และช่วงค้นหา
- เปิด/ปิดการรันข้ามคืนตามเวลาที่กำหนด เช่น 23:00 และ 04:00
- ดูวิดีโอสดจากกล้องที่เลือกผ่านโหมด `LIVE CCTV`
- Frontend ใช้ React + Tailwind และ React Bits components สำหรับ motion/spotlight ที่ควบคุมได้
- เก็บไฟล์แยกเป็นวันที่/เวลา/กลุ่ม พร้อม `manifest.json`
- รวมภาพของรอบเวรเป็น ZIP ในโฟลเดอร์ `exports/` เพื่อส่งงานได้สะดวก
- ค่าที่เป็นความลับอยู่ใน `.env` และไม่อยู่ในโค้ด

## ตั้งค่า

ไฟล์ `.env` มีอยู่ในเครื่องแล้ว และถูกใส่ใน `.gitignore` ให้เรียบร้อย หากต้องตั้งเครื่องใหม่:

```bash
cp .env.example ../.env
chmod 600 ../.env
```

แก้ค่าใน `.env` โดยเฉพาะ:

- `CCTV_LIVE_HOST`, `CCTV_LIVE_PORT`: แหล่งภาพสด
- `CCTV_PLAYBACK_HOST`, `CCTV_PLAYBACK_PORT`: NVR สำหรับภาพย้อนหลัง
- `CCTV_PLAYBACK_SEARCH_TIME`: รูปแบบเวลาค้นหา NVR ใช้ `local` เป็นค่าเริ่มต้น (เวลา Asia/Bangkok) หรือ `utc` หาก NVR ตั้งค่าเป็น UTC
- `CCTV_PLAYBACK_SEARCH_PADDING_SECONDS`: เผื่อช่วงค้นหาก่อน/หลังเวลาที่เลือก ค่าเริ่มต้น 120 วินาที
- `CCTV_USERNAME`, `CCTV_PASSWORD`
- `CCTV_CHANNELS`: ช่องที่จะทำภาพรวมทั้งหมด

ช่องที่ตั้งไว้ปัจจุบันมี 18 ช่อง: `1-13, 15-18, 20`

## โปรแกรมที่ต้องติดตั้ง

โปรเจกต์นี้ต้องใช้:

- Python 3 สำหรับรัน backend และงานแคปภาพ
- ffmpeg สำหรับอ่าน RTSP และสร้างภาพรวม
- Node.js + npm สำหรับติดตั้งแพ็กเกจและ build หน้า React ครั้งแรก

หน้าเว็บใช้งานด้วย React + Tailwind โดย build เป็นไฟล์ static แล้วให้ Python เสิร์ฟ
Node.js ใช้ตอนติดตั้ง/พัฒนา/build หน้าเว็บเท่านั้น ไม่ต้องเปิด Node ค้างตอนใช้งานจริง
ถ้าต้องการเปิดเป็นแอป Desktop ให้ดู [คู่มือ Electron](developer/electron/README.md) โดย Electron จะเปิด Python backend ให้เอง

ติดตั้งทั้งหมดด้วย Homebrew บน macOS:

```bash
brew install python ffmpeg node
npm --prefix frontend install
npm --prefix frontend run build
```

หรือดับเบิลคลิก `ติดตั้งระบบ.command` เพื่อให้ติดตั้ง Python และ ffmpeg อัตโนมัติ

### Windows

ถ้าใช้ Windows 10/11 ที่มี `winget` ให้ดับเบิลคลิก `ติดตั้งระบบ_windows.bat` หรือใช้คำสั่งใน PowerShell/Command Prompt:

```bat
winget install --id Python.Python.3.12 --exact --source winget
winget install --id Gyan.FFmpeg --exact --source winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
npm --prefix frontend install
npm --prefix frontend run build
```

หลังติดตั้งให้ปิดแล้วเปิดหน้าต่าง Terminal ใหม่ จากนั้นคัดลอก `.env.example` เป็น `.env` แล้วดับเบิลคลิก `เปิดโปรแกรม_windows.bat`

## เปิดใช้งานโปรแกรม

```bash
cd "/Volumes/DriveG/dev/workspace/github/CCTV Autometion"
python3 app.py
```

ถ้าต้องการเปิด backend ผ่านเบราว์เซอร์โดยตรง ให้เปิด:

```text
http://127.0.0.1:8787
```

Web base เป็นโหมดใช้งานหลักของโปรเจกต์ ให้ดับเบิลคลิก `../เปิด Web Base macOS.command` หรือเลือกใช้แอป Desktop ที่ build แล้ว

เมื่อสร้าง Desktop app แล้ว ไฟล์ที่เปิดใช้และไฟล์ติดตั้งจะอยู่ที่โฟลเดอร์หลักของโปรเจกต์:

```text
CCTV Automation.app                    # ดับเบิลคลิกเปิดบน macOS
ติดตั้ง CCTV Automation macOS.dmg      # ไฟล์ติดตั้ง macOS
ติดตั้ง CCTV Automation Windows.exe    # ไฟล์ติดตั้ง Windows x64
```

## วิธีใช้งาน Web base:

1. แท็บ `LIVE CCTV`: เลือกกล้องแล้วกด `เปิดภาพสด` เพื่อดูวิดีโอสด หรือเลือกวันที่/เวลาใน Timeline แล้วกด `เปิดย้อนหลังจุดนี้` เพื่อดูย้อนหลัง 1 นาที
2. แท็บ `บันทึกข้ามคืน`: ตั้งเวลาเอง 2 รอบ แล้วกด `เปิดรันข้ามคืน`
3. ภาพกล้องทั้งหมดและภาพรวมจะอยู่ในโฟลเดอร์ `รวมกล้อง` เดียวกัน
4. ถ้างานใช้เวลานานหรือสั่งผิด กด `ยกเลิกงาน` ได้จากกล่องสถานะ
5. ถ้า NVR ไม่มีไฟล์ย้อนหลังทุกกล้อง ระบบจะแสดง `ไม่มีข้อมูลกล้องวงจรปิดในวันที่เลือก`

หน้าใช้งานหลักมี 3 โหมด: `รันข้ามคืน`, `บันทึกย้อนหลัง` และ `LIVE CCTV`

## โครงสร้างไฟล์ผลลัพธ์

```text
captures/YYYY-MM-DD/HH-MM/
├── รวมกล้อง/
│   ├── camera-01_....jpg
│   ├── ...
│   └── ภาพรวม-18-ช่อง_....jpg
└── manifest.json
```

เมื่อกด `รวมชุดส่งงาน` ที่หน้าเว็บ ระบบจะสร้างไฟล์ ZIP ไว้ที่ `exports/` ในโปรเจกต์ และเปิดให้ดาวน์โหลดจากเว็บได้ด้วย

## โครงสร้าง Frontend

```text
frontend/
├── src/                 # React source
├── public/              # โลโก้ Night Night CCTV
├── package.json
└── vite.config.js       # build ไปที่ static/
```

หน้าเว็บที่ build แล้วอยู่ใน `static/` เพื่อให้ Python backend เสิร์ฟได้โดยตรง ตัวเปิดโปรแกรม `.command` และ `.bat` จึงยังทำงานแบบเดิม

ภาพย้อนหลังต้องให้ NVR รองรับ RTSP Playback และเครื่องนี้ต้องเข้าถึง NVR ได้ หากกดบันทึกย้อนหลังแล้วไม่สำเร็จ ให้ดูข้อความในหน้าเว็บและ `data/app.log` โปรแกรมจะค้นหา ffmpeg ในตำแหน่งติดตั้งมาตรฐานของ Windows ให้อัตโนมัติด้วย

## แอป Desktop (Electron)

Electron เปิดหน้าเดิมในหน้าต่างแอปและสตาร์ต Python backend ให้โดยอัตโนมัติ แต่ยังต้องติดตั้ง **Python 3** และ **FFmpeg** ในเครื่อง เนื่องจากเป็นตัวเชื่อมกล้องและ NVR

ใช้คำสั่งและตำแหน่งไฟล์ `.env` ตาม [developer/electron/README.md](developer/electron/README.md) สำหรับ macOS และ Windows

## คู่มือในเว็บ

กดปุ่ม `คู่มือ` ที่หัวหน้าเว็บเพื่อเปิดคู่มือแยกที่ `/guide.html` หน้าใช้งานหลักจะแสดงเฉพาะส่วนสั่งงานและผลลัพธ์ภาพ

ไฟล์ `.env.example` ตั้งค่า Host และบัญชีเป็นช่องว่างไว้ทั้งหมด เพื่อไม่ให้มีข้อมูลของเครื่องใดติดไปกับตัวอย่าง ต้องกรอกค่าจริงในไฟล์ `.env` ก่อนใช้งาน
