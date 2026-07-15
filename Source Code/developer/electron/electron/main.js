"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

app.setName("CCTV Automation");

const HOST = "127.0.0.1";
const PORT = Number(process.env.CCTV_WEB_PORT || 8787);
const LOCAL_ORIGIN = `http://${HOST}:${PORT}`;
const APP_URL = `${LOCAL_ORIGIN}/`;
let backendProcess = null;
let mainWindow = null;

function projectRoot() {
  if (!app.isPackaged) return path.resolve(__dirname, "../../..");
  const root = path.join(app.getPath("userData"), "backend");
  const resourceRoot = path.join(process.resourcesPath, "backend");
  fs.mkdirSync(root, { recursive: true });
  // Update bundled program files on every app update. The packaged resources do
  // not contain .env, captures, exports, or data, so local operational data is kept.
  fs.cpSync(resourceRoot, root, { recursive: true, force: true });
  return root;
}

function applicationIcon(root) {
  const candidates = [
    path.join(root, "frontend", "public", "night-night-cctv.png"),
    path.join(root, "static", "night-night-cctv.png"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function environmentFile(root) {
  const localProjectRoot = process.platform === "darwin"
    ? path.resolve(path.dirname(process.execPath), "../../..")
    : path.resolve(path.dirname(process.execPath), "..");
  const candidates = app.isPackaged
    ? [
      path.join(localProjectRoot, ".env"),
      path.join(root, ".env"),
    ]
    : [
      path.join(root, ".env"),
      path.join(root, "..", ".env"),
    ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

async function showSetupWindow({ root, title, heading, detail, envFile }) {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 530,
    minWidth: 620,
    minHeight: 480,
    title,
    icon: applicationIcon(root),
    backgroundColor: "#020617",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadFile(path.join(__dirname, "setup.html"), {
    query: { title, heading, detail, envFile },
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
    const child = spawn(candidate.command, [...candidate.args, "app.py"], {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    backendProcess = child;
    child.stdout.on("data", (data) => process.stdout.write(`[cctv] ${data}`));
    child.stderr.on("data", (data) => process.stderr.write(`[cctv] ${data}`));
    child.once("error", () => {
      if (backendProcess === child) backendProcess = null;
      if (index + 1 < candidates.length) launch(index + 1);
    });
    child.once("exit", () => {
      if (backendProcess === child) backendProcess = null;
    });
  };
  launch(0);
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  const child = backendProcess;
  backendProcess = null;
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGTERM");
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
  const envFile = environmentFile(root);
  if (!fs.existsSync(envFile)) {
    await showSetupWindow({
      root,
      title: "ยังไม่พบไฟล์ .env",
      heading: "ต้องวางไฟล์ .env ก่อนเริ่มใช้งาน",
      detail: "ขอไฟล์ .env จากพี่หมี แล้ววางไว้ตามตำแหน่งด้านล่าง",
      envFile,
    });
    return;
  }
  if (!(await requestStatus())) startBackend(root);
  if (!(await waitForBackend())) {
    await showSetupWindow({
      root,
      title: "เปิด CCTV Automation ไม่สำเร็จ",
      heading: "เชื่อมต่อ Python backend ไม่ได้",
      detail: "ตรวจสอบว่า Python 3, FFmpeg และไฟล์ .env พร้อมใช้งาน แล้วเปิดแอปใหม่",
      envFile,
    });
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    title: "CCTV Automation",
    icon: applicationIcon(root),
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(LOCAL_ORIGIN)) event.preventDefault();
  });
  await mainWindow.loadURL(APP_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  stopBackend();
});
