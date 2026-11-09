"use strict";
/**
 * Install-folder permission repair for the packaged Windows build.
 *
 * Since 44.5, Electron refuses to start (FATAL in install_dir_access.cc) when
 * the install folder's ACL contains an AppContainer package SID but no entry
 * for ALL APPLICATION PACKAGES (S-1-15-2-1): the sandboxed child processes
 * could not read the program files. Some tools add such SIDs to whole user
 * profiles, which breaks portable copies on the Desktop or in Downloads.
 * Granting S-1-15-2-1 read/execute (what Program Files grants by default)
 * fixes it. The installer does this at install time; this module does it once
 * per folder at start-up as a best effort for portable copies.
 *
 * 打包版安装目录权限修复：给“所有应用程序包”(S-1-15-2-1) 读取/执行权限，
 * 避免 Electron 因沙箱读不到程序目录而启动即崩。每个目录只尝试一次。
 */
const path = require("node:path");

const ALL_APPLICATION_PACKAGES_SID = "S-1-15-2-1";
const MARKER_FILE = "install-acl.json";

/** icacls arguments granting ALL APPLICATION PACKAGES read/execute, inherited. */
function grantArguments(installDir) {
  return [installDir, "/grant", `*${ALL_APPLICATION_PACKAGES_SID}:(OI)(CI)(RX)`, "/Q"];
}

function readMarker(markerPath, fileSystem) {
  try {
    const data = JSON.parse(fileSystem.readFileSync(markerPath, "utf8"));
    return Array.isArray(data?.dirs) ? data.dirs.filter(dir => typeof dir === "string") : [];
  } catch {
    return [];
  }
}

/**
 * @param {{ platform: string, isPackaged: boolean, execPath: string, userData: string, disabled?: boolean,
 *   systemRoot?: string, fileSystem: typeof import("node:fs"),
 *   execFileSync: (file: string, args: string[], options: object) => unknown,
 *   log?: (message: string) => void }} options
 * @returns {"skipped" | "already-done" | "granted" | "failed"}
 */
function ensureInstallDirReadable({ platform, isPackaged, execPath, userData, disabled = false, systemRoot, fileSystem, execFileSync, log = () => {} }) {
  if (disabled || platform !== "win32" || !isPackaged || !execPath || !userData) return "skipped";
  const installDir = path.win32.dirname(execPath);
  const markerPath = path.join(userData, MARKER_FILE);
  const done = readMarker(markerPath, fileSystem);
  const key = installDir.toLowerCase();
  if (done.some(dir => dir.toLowerCase() === key)) return "already-done";
  const icacls = systemRoot ? path.win32.join(systemRoot, "System32", "icacls.exe") : "icacls.exe";
  try {
    execFileSync(icacls, grantArguments(installDir), { windowsHide: true, timeout: 20000, stdio: "ignore" });
  } catch (error) {
    log(`Install folder permission grant failed for ${installDir}: ${error.message}`);
    return "failed";
  }
  try {
    fileSystem.mkdirSync(userData, { recursive: true });
    fileSystem.writeFileSync(markerPath, JSON.stringify({ dirs: [...done, installDir] }, null, 2));
  } catch (error) {
    log(`Install folder permission marker could not be written: ${error.message}`);
  }
  log(`Granted ALL APPLICATION PACKAGES read access to ${installDir}`);
  return "granted";
}

module.exports = { ALL_APPLICATION_PACKAGES_SID, MARKER_FILE, grantArguments, ensureInstallDirReadable };
