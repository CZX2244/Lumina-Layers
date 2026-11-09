"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isNewerRelease, plusConfigEnv, resolveDataFolder, scrubLegacyPlusConfig } = require("../plus-config.cjs");

test("bug reports stay local and no registry variables are passed", () => {
  assert.deepEqual(plusConfigEnv({}), { LUMINA_FEEDBACK_SERVER_URL: "off" });
  assert.deepEqual(plusConfigEnv({ LUMINA_FEEDBACK_SERVER_URL: "https://mine.example" }), {});
  assert.equal(Object.keys(plusConfigEnv({})).some((key) => key.includes("REGISTRY")), false);
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
