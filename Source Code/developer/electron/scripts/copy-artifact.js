"use strict";

const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const electronRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(electronRoot, "../../..");
const distRoot = path.join(electronRoot, "dist");
const { version } = require(path.join(electronRoot, "package.json"));

function replaceWithCopy(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  // macOS .app bundles contain relative framework symlinks. Preserve them as
  // written; resolving them here turns the bundle into paths tied to this Mac.
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  console.log(`Created ${path.relative(projectRoot, destination)}`);
}

function artifact(name) {
  const source = path.join(distRoot, name);
  if (!fs.existsSync(source)) throw new Error(`Build artifact not found: ${source}`);
  return source;
}

if (target === "mac") {
  replaceWithCopy(
    artifact(path.join("mac-arm64", "CCTV Automation.app")),
    path.join(projectRoot, "CCTV Automation.app"),
  );
  replaceWithCopy(
    artifact(`CCTV-Automation-${version}-mac-arm64.dmg`),
    path.join(projectRoot, "ติดตั้ง CCTV Automation macOS.dmg"),
  );
} else if (target === "win") {
  replaceWithCopy(
    artifact(`CCTV-Automation-${version}-Setup.exe`),
    path.join(projectRoot, "ติดตั้ง CCTV Automation Windows.exe"),
  );
  replaceWithCopy(
    artifact("win-unpacked"),
    path.join(projectRoot, "CCTV Automation Windows"),
  );
} else {
  throw new Error("Specify target: mac or win");
}
