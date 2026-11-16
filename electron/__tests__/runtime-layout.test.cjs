"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { copyLegacy3mfTemplates, distDataEnv } = require("../runtime-layout.cjs");

function folders(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-template-copy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fromDir = path.join(root, "Lumina Studio", "3mf-templates");
  const toDir = path.join(root, "Lumina Studio Plus", "3mf-templates");
  return { root, fromDir, toDir };
}

test("copies the old templates once and leaves the official folder untouched", t => {
  const { fromDir, toDir } = folders(t);
  fs.mkdirSync(fromDir, { recursive: true });
  fs.writeFileSync(path.join(fromDir, "a.json"), "A");
  fs.writeFileSync(path.join(fromDir, "b.json"), "B");
  fs.writeFileSync(path.join(fromDir, "notes.txt"), "not a template");
  fs.mkdirSync(path.join(fromDir, "nested.json"));

  assert.equal(copyLegacy3mfTemplates({ fromDir, toDir, fs }), 2);
  assert.deepEqual(fs.readdirSync(toDir).sort(), ["a.json", "b.json"]);
  assert.equal(fs.readFileSync(path.join(toDir, "a.json"), "utf8"), "A");
  assert.deepEqual(fs.readdirSync(fromDir).sort(), ["a.json", "b.json", "nested.json", "notes.txt"]);

  fs.writeFileSync(path.join(fromDir, "c.json"), "C");
  assert.equal(copyLegacy3mfTemplates({ fromDir, toDir, fs }), 0, "never repeats once this build has its folder");
  assert.ok(!fs.existsSync(path.join(toDir, "c.json")));
});

test("does not overwrite templates this build already has", t => {
  const { fromDir, toDir } = folders(t);
  fs.mkdirSync(fromDir, { recursive: true });
  fs.mkdirSync(toDir, { recursive: true });
  fs.writeFileSync(path.join(fromDir, "a.json"), "old");
  fs.writeFileSync(path.join(toDir, "a.json"), "mine");

  assert.equal(copyLegacy3mfTemplates({ fromDir, toDir, fs }), 0);
  assert.equal(fs.readFileSync(path.join(toDir, "a.json"), "utf8"), "mine");
});

test("creates the folder when there is nothing to copy", t => {
  const { fromDir, toDir } = folders(t);
  assert.equal(copyLegacy3mfTemplates({ fromDir, toDir, fs }), 0);
  assert.ok(fs.statSync(toDir).isDirectory());
});

test("ignores a target that is the official folder itself", t => {
  const { fromDir } = folders(t);
  fs.mkdirSync(fromDir, { recursive: true });
  fs.writeFileSync(path.join(fromDir, "a.json"), "A");
  assert.equal(copyLegacy3mfTemplates({ fromDir, toDir: fromDir, fs }), 0);
});

test("the dist build keeps templates in its own data folder unless the user redirected them", () => {
  const userData = path.join("C:", "Users", "me", "AppData", "Roaming", "Lumina Studio Plus");
  assert.equal(distDataEnv({ userData }).LUMINA_CUSTOM_3MF_TEMPLATE_DIR, path.join(userData, "3mf-templates"));
  assert.equal(
    distDataEnv({ userData, env: { LUMINA_CUSTOM_3MF_TEMPLATE_DIR: "D:\\templates" } }).LUMINA_CUSTOM_3MF_TEMPLATE_DIR,
    "D:\\templates",
  );
});
