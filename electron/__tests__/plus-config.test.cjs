"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  isNewerRelease, mergePlusConfigUpdate, normalizePlusConfig, plusConfigEnv, publicPlusConfig, readPlusConfig, writePlusConfig,
} = require("../plus-config.cjs");

test("bug reports stay local by default", () => {
  assert.deepEqual(plusConfigEnv(normalizePlusConfig({})), { LUMINA_FEEDBACK_SERVER_URL: "off" });
  assert.deepEqual(plusConfigEnv(normalizePlusConfig({ feedbackUpload: true })), {});
});

test("registry settings become backend variables, real environment wins", () => {
  const config = normalizePlusConfig({ materialRegistryUrl: "https://registry.example/", materialRegistryToken: "abc", feedbackUpload: true });
  assert.deepEqual(plusConfigEnv(config), { LUMINA_MATERIAL_REGISTRY_URL: "https://registry.example", LUMINA_MATERIAL_REGISTRY_TOKEN: "abc" });
  assert.deepEqual(plusConfigEnv(config, { LUMINA_MATERIAL_REGISTRY_URL: "https://env.example" }), { LUMINA_MATERIAL_REGISTRY_TOKEN: "abc" });
  assert.deepEqual(plusConfigEnv(normalizePlusConfig({}), { LUMINA_FEEDBACK_SERVER_URL: "https://mine.example" }), {});
});

test("invalid urls and tokens are dropped", () => {
  const config = normalizePlusConfig({ materialRegistryUrl: "javascript:alert(1)", lutRegistryUrl: "ftp://x", materialRegistryToken: "a\nb" });
  assert.equal(config.materialRegistryUrl, "");
  assert.equal(config.lutRegistryUrl, "");
  assert.equal(config.materialRegistryToken, "");
});

test("the renderer never sees stored tokens and omitted tokens are kept", () => {
  const stored = normalizePlusConfig({ lutRegistryUrl: "https://lut.example", lutRegistryToken: "secret" });
  assert.equal(JSON.stringify(publicPlusConfig(stored)).includes("secret"), false);
  assert.equal(publicPlusConfig(stored).lutRegistryTokenSet, true);
  assert.equal(mergePlusConfigUpdate(stored, { feedbackUpload: true }).lutRegistryToken, "secret");
  assert.equal(mergePlusConfigUpdate(stored, { lutRegistryToken: "" }).lutRegistryToken, "");
});

test("config round-trips through userData", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-plus-config-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.equal(readPlusConfig(dir).feedbackUpload, false);
  writePlusConfig(dir, { feedbackUpload: true, updateCheck: false });
  assert.equal(readPlusConfig(dir).feedbackUpload, true);
  assert.equal(readPlusConfig(dir).updateCheck, false);
});

test("a release counts as newer only when published well after this build", () => {
  const build = { builtAt: "2026-11-09T08:00:00Z" };
  assert.equal(isNewerRelease({ published_at: "2026-11-09T08:30:00Z" }, build), false);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z" }, build), true);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z", prerelease: true }, build), false);
  assert.equal(isNewerRelease({ published_at: "2026-11-12T08:00:00Z" }, null), false);
});
