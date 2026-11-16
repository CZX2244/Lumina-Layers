"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isNewerRelease, plusConfigEnv, resolveDataFolder, scrubLegacyPlusConfig } = require("../plus-config.cjs");

test("backend network features are forced off whatever the environment says", () => {
  const env = plusConfigEnv({ LUMINA_FEEDBACK_SERVER_URL: "https://mine.example", LUMINA_MATERIAL_REGISTRY_URL: "https://r.example" });
  assert.equal(env.LUMINA_FEEDBACK_SERVER_URL, "off", "empty would fall back to the official server");
  for (const key of ["LUMINA_MATERIAL_REGISTRY_URL", "LUMINA_MATERIAL_REGISTRY_FALLBACK_URL", "LUMINA_MATERIAL_REGISTRY_TOKEN",
    "LUMINA_MATERIAL_REGISTRY_TEAM_TOKEN", "LUMINA_LUT_REGISTRY_URL", "LUMINA_LUT_REGISTRY_FALLBACK_URL", "LUMINA_LUT_REGISTRY_TOKEN",
    "LUMINA_MATERIALS_SEED_URL", "LUMINA_DATABASE_URL"]) {
    assert.equal(env[key], "", key);
  }
  assert.equal(env.LUMINA_MATERIAL_SYNC_STARTUP_REFRESH, "0");
  assert.equal(env.LUMINA_MATERIAL_SYNC_REFRESH_INTERVAL_S, "0");
  assert.equal(env.LUMINA_WORKSHOP_NETWORK, "off");
});

test("legacy registry settings and tokens are scrubbed from userData", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-plus-config-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "plus-config.json");
  assert.equal(scrubLegacyPlusConfig(dir), false, "missing file is fine");
  fs.writeFileSync(file, JSON.stringify({ materialRegistryUrl: "https://r.example", materialRegistryToken: "secret", updateCheck: true }));
  assert.equal(scrubLegacyPlusConfig(dir), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { updateCheck: true });
  fs.writeFileSync(file, JSON.stringify({ lutRegistryToken: "secret" }));
  assert.equal(scrubLegacyPlusConfig(dir), true);
  assert.equal(fs.existsSync(file), false, "a file holding only legacy keys is removed");
});

test("data folders resolve to fixed locations", () => {
  const context = { userData: "/u", distMode: true, rootDir: "/app", desktopLogs: "/u/logs" };
  assert.equal(resolveDataFolder("feedback", context), path.join("/u", "feedback"));
  assert.equal(resolveDataFolder("logs", context), path.join("/u", "backend-logs"));
  assert.equal(resolveDataFolder("feedback", { ...context, distMode: false }), path.join("/app", "feedback"));
  assert.equal(resolveDataFolder("../../etc", context), null);
});

test("a release counts as newer only when published well after this build", () => {
  const build = { builtAt: "2026-11-09T08:00:00Z" };
  assert.equal(isNewerRelease({ published_at: "2026-11-09T08:30:00Z" }, build), false);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z" }, build), true);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z", prerelease: true }, build), false);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z" }, null), false);
});
