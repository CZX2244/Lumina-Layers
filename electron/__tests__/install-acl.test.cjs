"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ensureInstallDirReadable, grantArguments, MARKER_FILE } = require("../install-acl.cjs");

function setup(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-acl-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const calls = [];
  return { userData, calls, execFileSync: (file, args, options) => { calls.push({ file, args, options }); } };
}

const execPath = "C:\\Users\\ZC\\Desktop\\新建文件夹\\Lumina Studio Plus.exe";

test("grants ALL APPLICATION PACKAGES read/execute by SID on the exe folder", t => {
  const s = setup(t);
  const result = ensureInstallDirReadable({ platform: "win32", isPackaged: true, execPath, userData: s.userData,
    systemRoot: "C:\\Windows", fileSystem: fs, execFileSync: s.execFileSync });
  assert.equal(result, "granted");
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].file, "C:\\Windows\\System32\\icacls.exe");
  assert.deepEqual(s.calls[0].args, ["C:\\Users\\ZC\\Desktop\\新建文件夹", "/grant", "*S-1-15-2-1:(OI)(CI)(RX)", "/Q"]);
  assert.equal(s.calls[0].options.windowsHide, true);
});

test("runs once per folder and again for a different folder", t => {
  const s = setup(t);
  const options = { platform: "win32", isPackaged: true, execPath, userData: s.userData, fileSystem: fs, execFileSync: s.execFileSync };
  ensureInstallDirReadable(options);
  assert.equal(ensureInstallDirReadable({ ...options, execPath: execPath.toUpperCase() }), "already-done");
  assert.equal(ensureInstallDirReadable({ ...options, execPath: "D:\\LuminaPlus\\Lumina Studio Plus.exe" }), "granted");
  assert.equal(s.calls.length, 2);
  const marker = JSON.parse(fs.readFileSync(path.join(s.userData, MARKER_FILE), "utf8"));
  assert.equal(marker.dirs.length, 2);
});

test("does nothing outside the packaged Windows build", t => {
  const s = setup(t);
  for (const options of [{ platform: "linux", isPackaged: true }, { platform: "win32", isPackaged: false }, { platform: "win32", isPackaged: true, disabled: true }]) {
    assert.equal(ensureInstallDirReadable({ ...options, execPath, userData: s.userData, fileSystem: fs, execFileSync: s.execFileSync }), "skipped");
  }
  assert.equal(s.calls.length, 0);
});

test("a failed grant does not throw and is retried next start", t => {
  const s = setup(t);
  const logs = [];
  const failing = () => { throw new Error("Access is denied."); };
  const options = { platform: "win32", isPackaged: true, execPath, userData: s.userData, fileSystem: fs, log: m => logs.push(m) };
  assert.equal(ensureInstallDirReadable({ ...options, execFileSync: failing }), "failed");
  assert.match(logs[0], /Access is denied/);
  assert.equal(fs.existsSync(path.join(s.userData, MARKER_FILE)), false);
  assert.equal(ensureInstallDirReadable({ ...options, execFileSync: s.execFileSync }), "granted");
});

test("grant arguments only add read/execute", () => {
  assert.deepEqual(grantArguments("C:\\LuminaPlus"), ["C:\\LuminaPlus", "/grant", "*S-1-15-2-1:(OI)(CI)(RX)", "/Q"]);
});
