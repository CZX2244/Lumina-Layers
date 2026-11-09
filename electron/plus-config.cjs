"use strict";
/**
 * Lumina Studio Plus desktop configuration (userData/plus-config.json).
 * Settings that the backend reads from its environment at start-up: bug
 * report upload and the optional, user-authorised Registry connections.
 * 个人增强版桌面配置：后端启动时从环境变量读取的设置（反馈上传、用户已获授权的 Registry）。
 */
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILE = "plus-config.json";
const DEFAULT_CONFIG = Object.freeze({
  feedbackUpload: false,
  materialRegistryUrl: "",
  materialRegistryToken: "",
  lutRegistryUrl: "",
  lutRegistryToken: "",
  updateCheck: true,
});

function cleanUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed.replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

function cleanToken(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length <= 500 && !/[\r\n\0]/.test(trimmed) ? trimmed : "";
}

function normalizePlusConfig(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    feedbackUpload: raw.feedbackUpload === true,
    materialRegistryUrl: cleanUrl(raw.materialRegistryUrl),
    materialRegistryToken: cleanToken(raw.materialRegistryToken),
    lutRegistryUrl: cleanUrl(raw.lutRegistryUrl),
    lutRegistryToken: cleanToken(raw.lutRegistryToken),
    updateCheck: raw.updateCheck !== false,
  };
}

function readPlusConfig(userData, fileSystem = fs) {
  try {
    return normalizePlusConfig(JSON.parse(fileSystem.readFileSync(path.join(userData, CONFIG_FILE), "utf8")));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writePlusConfig(userData, value, fileSystem = fs) {
  const config = normalizePlusConfig(value);
  const target = path.join(userData, CONFIG_FILE);
  const temporary = `${target}.${process.pid}.tmp`;
  fileSystem.mkdirSync(userData, { recursive: true });
  fileSystem.writeFileSync(temporary, JSON.stringify(config, null, 2), { mode: 0o600 });
  fileSystem.renameSync(temporary, target);
  return config;
}

/**
 * Backend environment derived from the config. Variables the user already
 * set in the real environment always win.
 * 由配置得出的后端环境变量；真实环境变量中已设置的值优先。
 */
function plusConfigEnv(config, env = {}) {
  const result = {};
  const put = (key, value) => {
    if (env[key]) return;
    if (value) result[key] = value;
  };
  // Bug reports stay local unless the user opts in; "unset" means the
  // backend's default (official) service.
  if (!env.LUMINA_FEEDBACK_SERVER_URL && !config.feedbackUpload) result.LUMINA_FEEDBACK_SERVER_URL = "off";
  put("LUMINA_MATERIAL_REGISTRY_URL", config.materialRegistryUrl);
  put("LUMINA_MATERIAL_REGISTRY_TOKEN", config.materialRegistryUrl ? config.materialRegistryToken : "");
  put("LUMINA_LUT_REGISTRY_URL", config.lutRegistryUrl);
  put("LUMINA_LUT_REGISTRY_TOKEN", config.lutRegistryUrl ? config.lutRegistryToken : "");
  return result;
}

/** Renderer-safe view: tokens are reported as present/absent only. */
function publicPlusConfig(config) {
  return {
    feedbackUpload: config.feedbackUpload,
    materialRegistryUrl: config.materialRegistryUrl,
    materialRegistryTokenSet: Boolean(config.materialRegistryToken),
    lutRegistryUrl: config.lutRegistryUrl,
    lutRegistryTokenSet: Boolean(config.lutRegistryToken),
    updateCheck: config.updateCheck,
  };
}

/** Apply a renderer update; an omitted or null token keeps the stored one. */
function mergePlusConfigUpdate(current, update) {
  const patch = update && typeof update === "object" ? update : {};
  const next = { ...current };
  for (const key of ["feedbackUpload", "updateCheck"]) {
    if (typeof patch[key] === "boolean") next[key] = patch[key];
  }
  for (const key of ["materialRegistryUrl", "lutRegistryUrl"]) {
    if (typeof patch[key] === "string") next[key] = patch[key];
  }
  for (const key of ["materialRegistryToken", "lutRegistryToken"]) {
    if (typeof patch[key] === "string") next[key] = patch[key];
  }
  return normalizePlusConfig(next);
}

// ── Update check ──────────────────────────────────────────────────

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
  DEFAULT_CONFIG,
  isNewerRelease,
  mergePlusConfigUpdate,
  normalizePlusConfig,
  plusConfigEnv,
  publicPlusConfig,
  readBuildInfo,
  readPlusConfig,
  writePlusConfig,
};
