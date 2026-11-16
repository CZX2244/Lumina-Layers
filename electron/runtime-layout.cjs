"use strict";
/**
 * Runtime layout for the desktop host.
 *
 * "dev" keeps the source workflow (repository checkout, project venv, Vite dev
 * server on 4174). "dist" is used by the packaged Windows build and by
 * `LUMINA_ELECTRON_FRONTEND=dist`: the backend serves the built frontend from
 * its own port and runs on a bundled Python runtime, so neither Node nor Vite
 * is needed at runtime.
 *
 * 桌面宿主的运行布局：dev 沿用源码开发流程；dist 用于打包版（或显式
 * LUMINA_ELECTRON_FRONTEND=dist），由后端同源托管前端构建产物、使用内置 Python。
 */
const path = require("node:path");

function isDistMode({ isPackaged, env }) {
  if (env && env.LUMINA_ELECTRON_FRONTEND === "dev") return false;
  return Boolean(isPackaged) || Boolean(env && env.LUMINA_ELECTRON_FRONTEND === "dist");
}

/**
 * @param {{ isPackaged?: boolean, resourcesPath?: string, electronDir: string, env?: Record<string,string|undefined>, platform: string }} options
 */
function resolveRuntimeLayout({ isPackaged, resourcesPath, electronDir, env = {}, platform }) {
  const dist = isDistMode({ isPackaged, env });
  const packagedRoot = isPackaged && resourcesPath ? path.join(resourcesPath, "app") : null;
  const rootDir = packagedRoot || path.join(electronDir, "..");
  const isWin = platform === "win32";
  // Short folder names keep deep package paths under Windows' 260-character limit.
  const bundledPythonDir = isPackaged && resourcesPath ? path.join(resourcesPath, "py") : null;
  const bundledPython = bundledPythonDir
    ? (isWin ? path.join(bundledPythonDir, "python.exe") : path.join(bundledPythonDir, "bin", "python3"))
    : null;
  return {
    mode: dist ? "dist" : "dev",
    rootDir,
    frontendDistDir: env.LUMINA_FRONTEND_DIST_DIR || path.join(rootDir, "frontend", "dist"),
    pythonOverride: env.LUMINA_PYTHON || null,
    bundledPython,
  };
}

/**
 * Writable data locations for the dist build. Every directory lives under the
 * Electron userData folder so reinstalling or updating the app keeps the
 * user's settings, materials, LUTs and caches. Values already present in the
 * environment win, so power users can still redirect any of them.
 *
 * 打包版的可写目录全部放在 userData 下，重装/升级不丢数据；已有环境变量优先。
 */
function distDataEnv({ userData, env = {} }) {
  const defaults = {
    LUMINA_SERVE_FRONTEND_DIST: "1",
    LUMINA_SETTINGS_PATH: path.join(userData, "user_settings.json"),
    LUMINA_OUTPUT_DIR: path.join(userData, "output"),
    LUMINA_RUNTIME_CACHE_DIR: path.join(userData, "runtime-cache"),
    LUMINA_CUSTOM_LUT_DIR: path.join(userData, "lut", "Custom"),
    LUMINA_CLOUD_LUT_DIR: path.join(userData, "lut", "Cloud"),
    LUMINA_LOG_DIR: path.join(userData, "backend-logs"),
    LUMINA_FEEDBACK_DUMP_DIR: path.join(userData, "feedback"),
    LUMINA_CUSTOM_3MF_TEMPLATE_DIR: path.join(userData, "3mf-templates"),
    NUMBA_CACHE_DIR: path.join(userData, "numba-cache"),
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
  };
  const result = {};
  for (const [key, value] of Object.entries(defaults)) {
    result[key] = env[key] ? env[key] : value;
  }
  return result;
}

/**
 * Files a packaged build cannot start without. `buildInfo.sentinels` lists
 * the deepest bundled files (relative to resources/) recorded at build time:
 * Windows' built-in ZIP extraction silently skips files whose full path is
 * longer than 260 characters, so a missing sentinel means the archive was
 * unpacked into a folder that is too deep (or incompletely).
 * The backend serves the interface from `frontend/dist`; without its
 * index.html the window would only show a "not found" page.
 * 打包版启动必需的文件；sentinels 为构建时记录的最深文件，缺失通常表示解压路径过长或解压不完整。
 * 界面由后端从 frontend/dist 提供，缺 index.html 时窗口只会显示“找不到”。
 */
function missingBundleFiles({ resourcesPath, layout, buildInfo, existsSync }) {
  const missing = [];
  if (layout.bundledPython && !existsSync(layout.bundledPython)) missing.push(layout.bundledPython);
  const apiServer = path.join(layout.rootDir, "api_server.py");
  if (!existsSync(apiServer)) missing.push(apiServer);
  const frontendIndex = path.join(layout.frontendDistDir, "index.html");
  if (!existsSync(frontendIndex)) missing.push(frontendIndex);
  const sentinels = Array.isArray(buildInfo?.sentinels) ? buildInfo.sentinels : [];
  for (const relative of sentinels) {
    if (typeof relative !== "string" || !relative || relative.includes("..")) continue;
    const full = path.join(resourcesPath, ...relative.split("/"));
    if (!existsSync(full)) missing.push(full);
  }
  return missing;
}

/**
 * One-time copy of 3MF printer templates that version 2.0.1 and earlier saved
 * in the official app's folder (`%APPDATA%\\Lumina Studio\\3mf-templates`) into
 * this build's own folder. Runs only while the target folder does not exist,
 * then creates it, so it never repeats. Files are copied, never moved, and the
 * official folder is left untouched. Returns the number of copied templates.
 * 一次性把旧版存在官方版目录里的 3MF 模板复制到个人版目录（只复制，不删除、不改官方版目录）。
 */
function copyLegacy3mfTemplates({ fromDir, toDir, fs }) {
  if (!fromDir || !toDir || path.resolve(fromDir) === path.resolve(toDir) || fs.existsSync(toDir)) return 0;
  let names = [];
  try {
    names = fs.readdirSync(fromDir).filter((name) => /\.json$/i.test(name));
  } catch (_) {
    names = [];
  }
  fs.mkdirSync(toDir, { recursive: true });
  let copied = 0;
  for (const name of names) {
    const source = path.join(fromDir, name);
    try {
      if (!fs.statSync(source).isFile()) continue;
      fs.copyFileSync(source, path.join(toDir, name), fs.constants.COPYFILE_EXCL);
      copied += 1;
    } catch (_) {
      // A template that cannot be read stays in the old folder; the rest still copy.
    }
  }
  return copied;
}

module.exports = { isDistMode, resolveRuntimeLayout, distDataEnv, missingBundleFiles, copyLegacy3mfTemplates };
