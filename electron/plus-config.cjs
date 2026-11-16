"use strict";
/**
 * Lumina Studio Plus: local-only backend settings and maintenance helpers.
 * 个人增强版：仅本地的后端设置与维护辅助。
 *
 * The personal build is local only: no cloud material/LUT registry, no bug
 * report upload, no Creative Workshop downloads. Reports and logs stay on this
 * computer and can be opened from Settings. The only network use is the
 * manual "check for updates" button. Older builds stored registry URLs/tokens in
 * userData/plus-config.json; those are removed on start-up.
 * 个人版不连接云端耗材/LUT 库，也不上传反馈；旧版本写入的 Registry 地址和令牌会在启动时清除。
 */
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILE = "plus-config.json";
const LEGACY_KEYS = ["materialRegistryUrl", "materialRegistryToken", "lutRegistryUrl", "lutRegistryToken", "feedbackUpload"];

/**
 * Backend variables that keep the personal build local only. They override
 * whatever the user's environment contains (the backend inherits it), so no
 * registry, feedback server, seed download, database or Creative Workshop
 * network access can be switched on from outside. An empty value disables
 * the registries; the feedback server needs "off" because empty falls back
 * to the official server.
 * 个人版只靠本地：强制覆盖后端会继承的环境变量，外部无法打开任何联网功能。
 */
const LOCAL_ONLY_ENV = Object.freeze({
  LUMINA_FEEDBACK_SERVER_URL: "off",
  LUMINA_MATERIAL_REGISTRY_URL: "",
  LUMINA_MATERIAL_REGISTRY_FALLBACK_URL: "",
  LUMINA_MATERIAL_REGISTRY_TOKEN: "",
  LUMINA_MATERIAL_REGISTRY_TEAM_TOKEN: "",
  LUMINA_LUT_REGISTRY_URL: "",
  LUMINA_LUT_REGISTRY_FALLBACK_URL: "",
  LUMINA_LUT_REGISTRY_TOKEN: "",
  LUMINA_MATERIAL_SYNC_STARTUP_REFRESH: "0",
  LUMINA_MATERIAL_SYNC_REFRESH_INTERVAL_S: "0",
  LUMINA_MATERIALS_SEED_URL: "",
  LUMINA_DATABASE_URL: "",
  LUMINA_WORKSHOP_NETWORK: "off",
});

function plusConfigEnv() {
  return { ...LOCAL_ONLY_ENV };
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
    // Windows PowerShell 5.1 writes UTF-8 with a BOM.
    const text = fileSystem.readFileSync(path.join(appRoot, "BUILD_INFO.json"), "utf8").replace(/^\uFEFF/, "");
    const info = JSON.parse(text);
    return info && typeof info === "object" ? info : null;
  } catch {
    return null;
  }
}

module.exports = {
  DATA_FOLDER_KINDS,
  LOCAL_ONLY_ENV,
  isNewerRelease,
  plusConfigEnv,
  readBuildInfo,
  resolveDataFolder,
  scrubLegacyPlusConfig,
};
