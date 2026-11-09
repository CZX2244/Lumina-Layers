/**
 * Sidebar information architecture for the studio shell.
 * 新版工作台侧栏的信息架构。
 *
 * Pages are grouped by what the user is doing (create, prepare filament
 * data, manage LUTs) instead of by file type. Every entry maps onto an
 * existing TabId so projects, share cards, the tutorial and the Workshop
 * hand-off keep navigating through useWidgetStore.
 * 按任务分组；每一项都映射到现有 TabId，保持工程/分享卡/教程/工坊的跳转契约。
 */
import type { TabId } from "../types/widget";
import { useWidgetStore } from "../stores/widgetStore";
import { useSingleStageStore } from "../stores/singleStageStore";
import { useStudioPrefsStore } from "./studioPrefsStore";

export type StudioIcon =
  | "home" | "image" | "vector" | "workshop" | "library" | "card" | "flask"
  | "lut" | "camera" | "chart" | "merge" | "cloud" | "settings" | "palette";

export interface StudioNavItem {
  tab: TabId;
  labelKey: string;
  icon: StudioIcon;
  /** Extra search words for the command palette. 命令面板额外检索词。 */
  keywords?: string;
}

export interface StudioNavGroup {
  id: string;
  labelKey: string;
  items: StudioNavItem[];
}

export const STUDIO_NAV_GROUPS: StudioNavGroup[] = [
  {
    id: "create",
    labelKey: "studio.nav.group_create",
    items: [
      { tab: "converter", labelKey: "tab.converter", icon: "image", keywords: "3mf convert image 图片 转换 生成 预览" },
      { tab: "vectorizer", labelKey: "tab.vectorizer", icon: "vector", keywords: "svg vector 矢量" },
      { tab: "workshop", labelKey: "tab.workshop", icon: "workshop", keywords: "module 工坊 拼豆 bead" },
    ],
  },
  {
    id: "material",
    labelKey: "studio.nav.group_material",
    items: [
      { tab: "material-library", labelKey: "tab.materialLibrary", icon: "library", keywords: "filament material 耗材 档案" },
      { tab: "gradient-card-generate", labelKey: "studio.nav.material_profile", icon: "card", keywords: "gradient card calibrate 色卡 建档 梯度" },
      { tab: "material-recipe", labelKey: "studio.nav.material_recipe", icon: "flask", keywords: "recipe 配方 耗材" },
      { tab: "material-cloud-sync", labelKey: "tab.materialCloudSync", icon: "cloud", keywords: "cloud registry 云" },
    ],
  },
  {
    id: "lut",
    labelKey: "studio.nav.group_lut",
    items: [
      { tab: "lut-library", labelKey: "tab.lutLibrary", icon: "lut", keywords: "lut preset 预设" },
      { tab: "calibration", labelKey: "studio.nav.lut_calibrate", icon: "camera", keywords: "calibration extract 校准 提取 色卡" },
      { tab: "lut-details", labelKey: "studio.nav.lut_analyze", icon: "chart", keywords: "details compare analyze 分析 对比 详情" },
      { tab: "five-color", labelKey: "studio.nav.five_color", icon: "palette", keywords: "five color query 五色 查询 配方" },
      { tab: "lut-manager", labelKey: "tab.lutManager", icon: "merge", keywords: "merge lut 合并" },
      { tab: "lut-cloud-sync", labelKey: "tab.lutCloudSync", icon: "cloud", keywords: "cloud 云" },
    ],
  },
];

export const STUDIO_SETTINGS_ITEM: StudioNavItem = {
  tab: "settings", labelKey: "tab.settings", icon: "settings", keywords: "settings preferences 设置 机型 切片",
};

/**
 * Pages that share one sidebar entry and appear as tabs inside it.
 * 共享同一侧栏入口、在页面内以分段标签切换的页面。
 */
export const STUDIO_PAGE_SECTIONS: { owner: TabId; tabs: { tab: TabId; labelKey: string }[] }[] = [
  {
    owner: "gradient-card-generate",
    tabs: [
      { tab: "gradient-card-generate", labelKey: "studio.section.card_generate" },
      { tab: "gradient-card-extract", labelKey: "studio.section.card_extract" },
    ],
  },
  {
    owner: "calibration",
    tabs: [
      { tab: "calibration", labelKey: "tab.calibration" },
      { tab: "extractor", labelKey: "tab.extractor" },
    ],
  },
  {
    owner: "lut-details",
    tabs: [
      { tab: "lut-details", labelKey: "tab.lutDetails" },
      { tab: "lut-compare", labelKey: "tab.lutCompare" },
    ],
  },
];

/** The sidebar entry that represents a tab (pages inside a section map to its owner). */
export function navOwnerOf(tab: TabId): TabId {
  const section = STUDIO_PAGE_SECTIONS.find((entry) => entry.tabs.some((item) => item.tab === tab));
  return section ? section.owner : tab;
}

export function sectionTabsOf(tab: TabId): { tab: TabId; labelKey: string }[] | null {
  return STUDIO_PAGE_SECTIONS.find((entry) => entry.tabs.some((item) => item.tab === tab))?.tabs ?? null;
}

export function allStudioNavItems(): StudioNavItem[] {
  return [...STUDIO_NAV_GROUPS.flatMap((group) => group.items), STUDIO_SETTINGS_ITEM];
}

/** Find the sidebar item (and its group) for a tab. */
export function findNavItem(tab: TabId): { item: StudioNavItem; group: StudioNavGroup | null } | null {
  const owner = navOwnerOf(tab);
  for (const group of STUDIO_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.tab === owner);
    if (item) return { item, group };
  }
  return owner === "settings" ? { item: STUDIO_SETTINGS_ITEM, group: null } : null;
}

/**
 * Navigate to a page from the studio shell.
 * Leaving the colour overlay keeps the converter's sub-tab contract intact.
 * 从工作台跳转到页面；保持图像转换子页契约。
 */
export function navigateStudio(tab: TabId): void {
  const widgets = useWidgetStore.getState();
  if (tab === "gradient-card-extract" && widgets.activeTab !== "gradient-card-extract") {
    // Same behaviour as the classic nav: a fresh extraction starts clean.
    useSingleStageStore.getState().clearMaterialVerification();
  }
  widgets.setActiveTab(tab);
  useStudioPrefsStore.getState().showApp();
}
