"use strict";
/**
 * Lumina Studio Plus: local-only backend settings and maintenance helpers.
 * 个人增强版：仅本地的后端设置与维护辅助。
 *
 * The personal build connects to no cloud material/LUT registry and never
 * uploads bug reports; reports and logs stay on this computer and can be
 * opened from Settings. Older builds stored registry URLs/tokens in
 * userData/plus-config.json; those are removed on start-up.
 * 个人版不连接云端耗材/LUT 库，也不上传反馈；旧版本写入的 Registry 地址和令牌会在启动时清除。
 */
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILE = "plus-config.json";
const LEGACY_KEYS = ["materialRegistryUrl", "materialRegistryToken", "lutRegistryUrl", "lutRegistryToken", "feedbackUpload"];

/**
 * Backend variables for the personal build. Registry variables are never
 * passed; bug reports stay local unless the user set their own server in the
 * real environment.
 * 个人版传给后端的环境变量：不传 Registry；反馈只存本机（除非真实环境变量另有设置）。
 */
function plusConfigEnv(env = {}) {
  return env.LUMINA_FEEDBACK_SERVER_URL ? {} : { LUMINA_FEEDBACK_SERVER_URL: "off" };
}

/**
 * Remove registry URLs/tokens left by an earlier build. Returns true when the
 * file was rewritten or deleted.
 * 清除旧版本留下的 Registry 地址与令牌。
 */
function scrubLegacyPlusConfig(userData, fileSystem = fs) {
  const file = path.join(userData, CONFIG_FILE);
  let raw;
  try {
    raw = JSON.parse(fileSystem.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  if (!raw || typeof raw !== "object" || !LEGACY_KEYS.some((key) => key in raw)) return false;
  const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !LEGACY_KEYS.includes(key)));
  try {
    if (Object.keys(kept).length === 0) fileSystem.unlinkSync(file);
    else fileSystem.writeFileSync(file, JSON.stringify(kept, null, 2), { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

/** Folders the renderer may ask to open (fixed set, resolved in main). */
const DATA_FOLDER_KINDS = ["feedback", "logs", "data"];

function resolveDataFolder(kind, { userData, distMode, rootDir, desktopLogs }) {
  switch (kind) {
    case "feedback":
      return distMode ? path.join(userData, "feedback") : path.join(rootDir, "feedback");
    case "logs":
      return distMode ? path.join(userData, "backend-logs") : desktopLogs;
    case "data":
      return userData;
    default:
      return null;
  }
}

// ── Update check (manual only) ────────────────────────────────────

/** Compare a published release with this build (ISO timestamps). */
function isNewerRelease(release, buildInfo) {
  if (!release || typeof release.published_at !== "string" || release.draft || release.prerelease) return false;
  const published = Date.parse(release.published_at);
  const built = Date.parse(buildInfo?.builtAt ?? "");
  if (!Number.isFinite(published) || !Number.isFinite(built)) return false;
  // Releases are created after the build finishes; allow an hour of slack.
  return published - built > 60 * 60 * 1000;
}

function readBuildInfo(appRoot, fileSystem = fs) {
  try {
    const info = JSON.parse(fileSystem.readFileSync(path.join(appRoot, "BUILD_INFO.json"), "utf8"));
    return info && typeof info === "object" ? info : null;
  } catch {
    return null;
  }
}

module.exports = {
  DATA_FOLDER_KINDS,
  isNewerRelease,
  plusConfigEnv,
  readBuildInfo,
  resolveDataFolder,
  scrubLegacyPlusConfig,
};
