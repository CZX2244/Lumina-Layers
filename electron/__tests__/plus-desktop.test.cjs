"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createSavedPathTracker, formatDownloadName, normalizeNamingContext, normalizeNamingTemplate, taskbarProgressValue,
} = require("../plus-desktop.cjs");

const NOW = new Date(2026, 10, 9, 14, 5);

test("download names follow the template and keep compound extensions", () => {
  assert.equal(formatDownloadName("{name}_{size}_{date}", "cat.3mf", { size: "120x80mm" }, NOW), "cat_120x80mm_20261109.3mf");
  assert.equal(formatDownloadName("{printer}-{name}-{time}", "panda.gcode.3mf", { printer: "Bambu H2D" }, NOW), "Bambu H2D-panda-1405.gcode.3mf");
  assert.equal(formatDownloadName("{name}", "tiles.zip", {}, NOW), "tiles.zip");
});

test("missing tokens collapse separators instead of leaving gaps", () => {
  assert.equal(formatDownloadName("{name}_{size}_{date}", "cat.3mf", {}, NOW), "cat_20261109.3mf");
});

test("invalid templates fall back to the original file name", () => {
  assert.equal(formatDownloadName("", "cat.3mf", {}, NOW), "cat.3mf");
  assert.equal(formatDownloadName("{date}", "cat.3mf", {}, NOW), "cat.3mf", "templates must keep {name}");
  assert.equal(normalizeNamingTemplate("x".repeat(200) + "{name}"), "");
  assert.equal(formatDownloadName("{name}", "../../evil.3mf", {}, NOW), "evil.3mf");
});

test("windows-forbidden characters are replaced", () => {
  assert.equal(formatDownloadName("{name}_{printer}", "a.3mf", normalizeNamingContext({ printer: 'X1<>:"/\\|?*' }), NOW), "a_X1.3mf");
});

test("only tracked absolute paths can be revealed", () => {
  const tracker = createSavedPathTracker(2);
  const a = path.resolve("/tmp/a.3mf"), b = path.resolve("/tmp/b.3mf"), c = path.resolve("/tmp/c.3mf");
  tracker.add("relative.3mf");
  assert.equal(tracker.has("relative.3mf"), false);
  tracker.add(a); tracker.add(b); tracker.add(c);
  assert.equal(tracker.has(a), false, "oldest entry is evicted");
  assert.equal(tracker.has(b), true);
  assert.equal(tracker.has(c), true);
});

test("taskbar progress maps renderer states", () => {
  assert.equal(taskbarProgressValue("indeterminate"), 2);
  assert.equal(taskbarProgressValue(0.5), 0.5);
  assert.equal(taskbarProgressValue(4), 1);
  assert.equal(taskbarProgressValue("none"), -1);
});
