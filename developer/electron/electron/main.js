"use strict";

const { app, BrowserWindow, dialog } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CCTV_WEB_PORT || 8787);
const URL = `http://${HOST}:${PORT}/`;
let backendProcess = null;
let mainWindow = null;

function projectRoot() {
  if (!app.isPackaged) return path.resolve(__dirname, "../../..");
  const root = path.join(app.getPath("userData"), "backend");
  const resourceRoot = path.join(process.resourcesPath, "backend");
  fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(path.join(root, "app.py"))) {
    fs.cpSync(resourceRoot, root, { recursive: true });
  }
  if (!fs.existsSync(path.join(root, ".env.example")) && fs.existsSync(path.join(resourceRoot, ".env.example"))) {
    fs.copyFileSync(path.join(resourceRoot, ".env.example"), path.join(root, ".env.example"));
  }
  return root;
}

function requestStatus() {
  return new Promise((resolve) => {
    const request = http.get({ host: HOST, port: PORT, path: "/api/status", timeout: 700 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

function pythonCandidates() {
  if (process.platform === "win32") {
    return [
      { command: "python", args: [] },
      { command: "py", args: ["-3"] },
    ];
  }
  return [
    { command: "python3", args: [] },
    { command: "python", args: [] },
  ];
}

function startBackend(root) {
  const env = {
    ...process.env,
    CCTV_WEB_HOST: HOST,
    CCTV_WEB_PORT: String(PORT),
  };
  const candidates = pythonCandidates();
  const launch = (index) => {
    const candidate = candidates[index];
    backendProcess = spawn(candidate.command, [...candidate.args, "app.py"], {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    backendProcess.stdout.on("data", (data) => process.stdout.write(`[cctv] ${data}`));
    backendProcess.stderr.on("data", (data) => process.stderr.write(`[cctv] ${data}`));
    backendProcess.once("error", () => {
      if (index + 1 < candidates.length) launch(index + 1);
    });
  };
  launch(0);
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await requestStatus()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function createWindow() {
  const root = projectRoot();
  if (!fs.existsSync(path.join(root, ".env"))) {
    await dialog.showMessageBox({
      type: "warning",
      title: "ยังไม่พบไฟล์ .env",
      message: "ต้องวางไฟล์ .env ก่อนเริ่มใช้งาน",
      detail: `ขอไฟล์ .env จากพี่หมี แล้ววางไว้ที่:\n${root}`,
    });
    app.quit();
    return;
  }
  if (!(await requestStatus())) startBackend(root);
  if (!(await waitForBackend())) {
    await dialog.showMessageBox({
      type: "error",
      title: "เปิด CCTV Automation ไม่สำเร็จ",
      message: "เชื่อมต่อ Python backend ไม่ได้",
      detail: `ตรวจสอบ Python, FFmpeg และไฟล์ .env ในโฟลเดอร์:\n${root}`,
    });
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    title: "CCTV Automation",
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
