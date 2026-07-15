# CCTV Automation Desktop (Electron)

Desktop app เปิดหน้า CCTV ในหน้าต่างของตัวเองและสตาร์ต Python backend ให้อัตโนมัติ จึงไม่ต้องเปิด Terminal หรือเบราว์เซอร์เอง

> Electron เป็นเปลือก Desktop ของระบบเดิม: เครื่องใช้งานยังต้องมี **Python 3** และ **FFmpeg** เพราะทั้งสองตัวใช้เชื่อมต่อและประมวลผลภาพจากกล้อง/NVR

## สำหรับผู้ใช้แอปที่ build แล้ว

1. ติดตั้ง Python 3 และ FFmpeg
   - macOS: `brew install python ffmpeg`
   - Windows (PowerShell/Command Prompt):

   ```bat
   winget install --id Python.Python.3.12 --exact --source winget
   winget install --id Gyan.FFmpeg --exact --source winget
   ```

2. ติดตั้งไฟล์ `.dmg` บน macOS หรือ `Setup.exe` บน Windows
3. ถ้าเปิด App Base จาก root ของโปรเจกต์ (`CCTV Automation.app` หรือ `CCTV Automation Windows`) ระบบจะใช้ `.env` ที่ root นั้นทันที
4. หากติดตั้งจาก DMG/Setup.exe ลงในตำแหน่งอื่น ให้เปิดแอป 1 ครั้ง ระบบจะแสดงหน้า Setup ค้างไว้หากยังไม่มี `.env` แล้ววางไฟล์ตามระบบปฏิบัติการ:

   ```text
   macOS
   ~/Library/Application Support/CCTV Automation/backend/.env

   Windows
   %APPDATA%\CCTV Automation\backend\.env
   ```

5. เปิดแอปอีกครั้ง

ห้ามนำ `.env` ไปใส่ในโฟลเดอร์แอปหรือส่งเข้า Git เพราะไฟล์นี้มีค่าการเชื่อมต่อกล้อง

## สำหรับนักพัฒนา

จากโฟลเดอร์ `Source Code`:

```bash
npm --prefix frontend run build
npm --prefix developer/electron ci
npm --prefix developer/electron run check
npm --prefix developer/electron start
```

โหมดพัฒนาจะอ่าน `.env` จากโฟลเดอร์หลักของโปรเจกต์โดยตรง

## สร้างไฟล์ติดตั้ง

สร้างบนระบบปฏิบัติการปลายทางเพื่อให้ทดสอบได้ตรงที่สุด:

```bash
# macOS: ไฟล์ DMG จะถูกคัดลอกไปที่โฟลเดอร์หลักของโปรเจกต์
npm --prefix frontend run build
npm --prefix developer/electron run dist:mac

# Windows x64: ไฟล์ Setup.exe จะถูกคัดลอกไปที่โฟลเดอร์หลักของโปรเจกต์
npm --prefix frontend run build
npm --prefix developer/electron run dist:win
```

ไฟล์ผลลัพธ์และ `node_modules` ถูกละเว้นจาก Git แล้ว แอปที่สร้างในเครื่องนี้ยังไม่ได้ code-sign/notarize; เมื่อแจกบน macOS เครื่องอื่น อาจต้องเปิดผ่านคลิกขวา **Open** ครั้งแรก หรือทำ code signing เพิ่มก่อนใช้งานจริงในองค์กร

คำสั่ง build จะคัดลอกไฟล์ที่พร้อมใช้งานไปที่โฟลเดอร์หลักของโปรเจกต์อัตโนมัติ ได้แก่ `CCTV Automation.app`, `ติดตั้ง CCTV Automation macOS.dmg` และ `ติดตั้ง CCTV Automation Windows.exe`
