import { describe, expect, it, vi } from "vitest";
import { buildStudioCommands, filterCommands } from "../commands";
import { allStudioNavItems, findNavItem, localTabFor, navOwnerOf, sectionTabsOf } from "../navigation";
import { translations } from "../../i18n/translations";

const zh = (key: string) => translations[key]?.zh ?? key;
const context = { openBugReport: vi.fn(), openAbout: vi.fn(), openShortcuts: vi.fn() };

describe("studio commands", () => {
  const commands = buildStudioCommands(context);

  it("has unique ids and translated titles", () => {
    expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length);
    for (const command of commands) {
      expect(translations[command.titleKey], command.titleKey).toBeDefined();
      if (command.contextKey) expect(translations[command.contextKey], command.contextKey).toBeDefined();
    }
  });

  it("finds product options and templates by Chinese name", () => {
    const ids = filterCommands(commands, "拼图", zh).map((command) => command.id);
    expect(ids).toContain("product.puzzle");
    expect(ids).toContain("template.puzzle");
  });

  it("matches keywords and requires every term", () => {
    expect(filterCommands(commands, "slicer", zh).map((command) => command.id)).toContain("converter.export");
    expect(filterCommands(commands, "保存 另存", zh).map((command) => command.id)).toEqual(["project.saveAs"]);
    expect(filterCommands(commands, "zzzz-no-match", zh)).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(filterCommands(commands, "  ", zh)).toHaveLength(commands.length);
  });
});

describe("studio navigation", () => {
  it("gives every page in a section the section's sidebar entry", () => {
    expect(navOwnerOf("gradient-card-extract")).toBe("gradient-card-generate");
    expect(navOwnerOf("extractor")).toBe("calibration");
    expect(navOwnerOf("lut-compare")).toBe("lut-details");
    expect(sectionTabsOf("lut-compare")?.map((entry) => entry.tab)).toEqual(["lut-details", "lut-compare"]);
  });

  it("reaches every local page, including LUT merge", () => {
    const reachable = new Set<string>(allStudioNavItems().map((item) => item.tab));
    for (const tab of ["gradient-card-extract", "extractor", "lut-compare"]) reachable.add(tab);
    for (const tab of ["converter", "calibration", "extractor", "gradient-card-generate", "gradient-card-extract", "material-library",
      "material-recipe", "lut-library", "lut-manager", "lut-details", "lut-compare",
      "five-color", "vectorizer", "workshop", "settings"]) {
      expect(reachable.has(tab), tab).toBe(true);
      expect(findNavItem(tab as never), tab).not.toBeNull();
    }
  });

  it("offers no cloud library pages and routes old links to the local library", () => {
    const tabs = allStudioNavItems().map((item) => item.tab);
    expect(tabs).not.toContain("material-cloud-sync");
    expect(tabs).not.toContain("lut-cloud-sync");
    expect(localTabFor("material-cloud-sync")).toBe("material-library");
    expect(localTabFor("lut-cloud-sync")).toBe("lut-library");
    expect(localTabFor("converter")).toBe("converter");
  });

  it("uses distinct labels in the sidebar", () => {
    const labels = allStudioNavItems().map((item) => zh(item.labelKey));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("cloud page redirect", () => {
  it("moves any navigation into a cloud library to the local one", async () => {
    const { useWidgetStore } = await import("../../stores/widgetStore");
    useWidgetStore.getState().setActiveTab("lut-cloud-sync");
    expect(useWidgetStore.getState().activeTab).toBe("lut-library");
    useWidgetStore.getState().setActiveTab("material-cloud-sync");
    expect(useWidgetStore.getState().activeTab).toBe("material-library");
  });
});
