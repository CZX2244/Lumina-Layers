"use strict";
/**
 * Lumina Studio Plus desktop helpers: download naming template, saved-file
 * tracking for "Show in Explorer", and taskbar progress state.
 * 个人增强版桌面辅助：下载文件名模板、"在资源管理器中显示"的已保存文件记录、任务栏进度。
 */
const path = require("node:path");

const MAX_TEMPLATE_LENGTH = 120;
const MAX_TRACKED_PATHS = 64;
const TEMPLATE_TOKENS = ["name", "date", "time", "size", "printer"];

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Replace characters Windows forbids in file names and trim the result. */
function sanitizeFileStem(value) {
  return String(value)
    .replace(/[\\/<>:"|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 150);
}

function normalizeNamingTemplate(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEMPLATE_LENGTH || !trimmed.includes("{name}")) return "";
  return trimmed;
}

function normalizeNamingContext(value) {
  const context = {};
  if (value && typeof value === "object") {
    for (const key of ["size", "printer"]) {
      if (typeof value[key] === "string" && value[key].length <= 60) context[key] = sanitizeFileStem(value[key]);
    }
  }
  return context;
}

/**
 * Apply the user's template to a downloaded file name, keeping the extension
 * (including compound ones such as `.gcode.3mf`). Unknown tokens are kept.
 * 套用下载文件名模板，保留扩展名；未知占位符原样保留。
 */
function formatDownloadName(template, filename, context = {}, now = new Date()) {
  const base = path.basename(String(filename || "download"));
  const normalized = normalizeNamingTemplate(template);
  if (!normalized) return base;
  const match = /^(.*?)((?:\.gcode)?\.[a-z0-9]{1,8})$/i.exec(base);
  const stem = match ? match[1] : base;
  const extension = match ? match[2] : "";
  const values = {
    name: stem,
    date: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    time: `${pad(now.getHours())}${pad(now.getMinutes())}`,
    size: context.size || "",
    printer: context.printer || "",
  };
  const filled = normalized.replace(/\{(\w+)\}/g, (token, key) => (TEMPLATE_TOKENS.includes(key) ? values[key] : token));
  const cleaned = sanitizeFileStem(filled.replace(/[_\- ]{2,}/g, (run) => run[0]).replace(/^[_\- ]+|[_\- ]+$/g, ""));
  return `${cleaned || sanitizeFileStem(stem) || "download"}${extension}`;
}

/** Paths this app wrote; only these may be revealed in the file manager. */
function createSavedPathTracker(limit = MAX_TRACKED_PATHS) {
  const paths = [];
  return {
    add(filePath) {
      if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return;
      const normalized = path.normalize(filePath);
      const existing = paths.indexOf(normalized);
      if (existing >= 0) paths.splice(existing, 1);
      paths.push(normalized);
      while (paths.length > limit) paths.shift();
    },
    has(filePath) {
      return typeof filePath === "string" && paths.includes(path.normalize(filePath));
    },
  };
}

/** Map a renderer taskbar request onto BrowserWindow.setProgressBar values. */
function taskbarProgressValue(state) {
  if (state === "indeterminate") return 2; // >1 shows the indeterminate bar on Windows.
  if (typeof state === "number" && Number.isFinite(state)) return Math.min(1, Math.max(0, state));
  return -1;
}

module.exports = {
  createSavedPathTracker,
  formatDownloadName,
  normalizeNamingContext,
  normalizeNamingTemplate,
  sanitizeFileStem,
  taskbarProgressValue,
};
