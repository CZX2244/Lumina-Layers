/**
 * Command registry for the studio shell: everything the command palette
 * (Ctrl+K) and keyboard shortcuts can do.
 * 新版工作台命令注册表：命令面板（Ctrl+K）和快捷键能执行的所有操作。
 */
import { useSettingsStore } from "../stores/settingsStore";
import { useWidgetStore } from "../stores/widgetStore";
import { useTutorialStore } from "../stores/tutorialStore";
import { allStudioNavItems, navigateStudio, STUDIO_PAGE_SECTIONS } from "./navigation";
import { requestProjectCommand } from "./projectCommands";
import { useStudioPrefsStore } from "./studioPrefsStore";
import { OPEN_PRODUCT_EVENT, scrollWorkbenchStep, WORKBENCH_PRODUCTS, WORKBENCH_STEPS, type WorkbenchStepId } from "./workbenchSteps";
import { applyProductTemplate, PRODUCT_TEMPLATES } from "./templates/productTemplates";

export type CommandGroup = "navigate" | "converter" | "project" | "app";

export interface StudioCommand {
  id: string;
  group: CommandGroup;
  /** i18n key of the title. */
  titleKey: string;
  /** Optional i18n key appended to the title (e.g. the page a section belongs to). */
  contextKey?: string;
  keywords?: string;
  /** Display-only shortcut, e.g. "Ctrl+Enter". */
  shortcut?: string;
  run: () => void;
}

export interface CommandContext {
  openBugReport: () => void;
  openAbout: () => void;
  openShortcuts: () => void;
}

/** Click a control rendered by an existing panel (keeps its own enabled state). */
export function clickStudioControl(selector: string): boolean {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (!element || element.disabled) return false;
  element.click();
  return true;
}

export function runPreview(): boolean {
  return clickStudioControl('[data-tutorial="preview-button"] button');
}

export function runGenerateExport(): boolean {
  return clickStudioControl('[data-studio-action="generate-export"]');
}

export function openConverterMode(mode: "core" | "color"): void {
  navigateStudio("converter");
  useWidgetStore.getState().setActiveConverterSubTab(mode);
}

export function goToWorkbenchStep(step: WorkbenchStepId): void {
  const widgets = useWidgetStore.getState();
  const needsNavigation = widgets.activeTab !== "converter" || useStudioPrefsStore.getState().view !== "app";
  if (widgets.activeConverterSubTab === "color") widgets.setActiveConverterSubTab("core");
  navigateStudio("converter");
  // Let the workbench mount before scrolling.
  window.setTimeout(() => scrollWorkbenchStep(step), needsNavigation ? 120 : 0);
}

export function buildStudioCommands(context: CommandContext): StudioCommand[] {
  const commands: StudioCommand[] = [
    { id: "nav.home", group: "navigate", titleKey: "studio.nav.home", keywords: "home start 首页 开始", run: () => useStudioPrefsStore.getState().showHome() },
  ];
  for (const item of allStudioNavItems()) {
    commands.push({ id: `nav.${item.tab}`, group: "navigate", titleKey: item.labelKey, keywords: item.keywords, run: () => navigateStudio(item.tab) });
  }
  for (const section of STUDIO_PAGE_SECTIONS) {
    for (const entry of section.tabs) {
      if (entry.tab === section.owner) continue;
      const owner = allStudioNavItems().find((item) => item.tab === section.owner);
      commands.push({ id: `nav.${entry.tab}`, group: "navigate", titleKey: entry.labelKey, contextKey: owner?.labelKey, run: () => navigateStudio(entry.tab) });
    }
  }

  WORKBENCH_STEPS.forEach((step, index) => {
    commands.push({
      id: `step.${step.id}`, group: "converter", titleKey: step.labelKey, contextKey: "tab.converter",
      shortcut: `Alt+${index + 1}`, run: () => goToWorkbenchStep(step.id),
    });
  });
  for (const product of WORKBENCH_PRODUCTS) {
    commands.push({
      id: `product.${product.id}`, group: "converter", titleKey: product.titleKey, contextKey: "studio.step.product", keywords: product.keywords,
      run: () => {
        goToWorkbenchStep("product");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_PRODUCT_EVENT, { detail: product.id })), 200);
      },
    });
  }
  for (const template of PRODUCT_TEMPLATES) {
    commands.push({
      id: `template.${template.id}`, group: "converter", titleKey: template.titleKey, contextKey: "studio.template.title",
      keywords: "template 模板", run: () => applyProductTemplate(template),
    });
  }
  commands.push(
    { id: "converter.preview3d", group: "converter", titleKey: "studio.mode.preview", keywords: "3d view 预览", run: () => openConverterMode("core") },
    { id: "converter.color", group: "converter", titleKey: "studio.mode.color", keywords: "recolor palette 调色 换色 颜色", shortcut: "Ctrl+Shift+C", run: () => openConverterMode("color") },
    { id: "converter.runPreview", group: "converter", titleKey: "studio.cmd.preview", keywords: "preview generate 预览 生成", shortcut: "Ctrl+Enter", run: () => { navigateStudio("converter"); window.setTimeout(runPreview, 0); } },
    { id: "converter.export", group: "converter", titleKey: "studio.cmd.export", keywords: "3mf slicer download export 导出 下载 切片", shortcut: "Ctrl+Shift+E", run: () => { navigateStudio("converter"); window.setTimeout(runGenerateExport, 0); } },
  );

  commands.push(
    { id: "project.open", group: "project", titleKey: "studio.cmd.project_open", keywords: "open lum 打开 工程", shortcut: "Ctrl+O", run: () => requestProjectCommand({ action: "open" }) },
    { id: "project.save", group: "project", titleKey: "studio.cmd.project_save", keywords: "save 保存", shortcut: "Ctrl+S", run: () => requestProjectCommand({ action: "save" }) },
    { id: "project.saveAs", group: "project", titleKey: "studio.cmd.project_save_as", keywords: "save as 保存 另存 另存为", shortcut: "Ctrl+Shift+S", run: () => requestProjectCommand({ action: "saveAs" }) },
    { id: "project.new", group: "project", titleKey: "studio.cmd.project_new", keywords: "new 新建", shortcut: "Ctrl+N", run: () => requestProjectCommand({ action: "new" }) },
    { id: "project.center", group: "project", titleKey: "studio.cmd.project_center", keywords: "recent 最近 工程中心", run: () => requestProjectCommand({ action: "center" }) },
    { id: "project.export", group: "project", titleKey: "studio.cmd.project_export", keywords: "zip bundle 导出 打包", run: () => requestProjectCommand({ action: "export" }) },
  );

  commands.push(
    {
      id: "app.theme", group: "app", titleKey: "studio.cmd.toggle_theme", keywords: "dark light theme 深色 浅色 主题",
      run: () => { const settings = useSettingsStore.getState(); settings.setTheme(settings.theme === "dark" ? "light" : "dark"); },
    },
    {
      id: "app.language", group: "app", titleKey: "studio.cmd.toggle_language", keywords: "language english 中文 语言",
      run: () => { const settings = useSettingsStore.getState(); settings.setLanguage(settings.language === "zh" ? "en" : "zh"); },
    },
    { id: "app.sidebar", group: "app", titleKey: "studio.cmd.toggle_sidebar", keywords: "sidebar 侧栏", shortcut: "Ctrl+B", run: () => useStudioPrefsStore.getState().toggleSidebar() },
    { id: "app.shortcuts", group: "app", titleKey: "studio.cmd.shortcuts", keywords: "keyboard help 快捷键 帮助", shortcut: "?", run: context.openShortcuts },
    { id: "app.tutorial", group: "app", titleKey: "studio.cmd.tutorial", keywords: "tour guide 教程 引导", run: () => { useStudioPrefsStore.getState().setShell("classic"); useTutorialStore.getState().startTour("manual"); } },
    { id: "app.checklist", group: "app", titleKey: "studio.cmd.checklist", keywords: "setup 首启 清单", run: () => { useStudioPrefsStore.getState().restoreChecklist(); useStudioPrefsStore.getState().showHome(); } },
    { id: "app.classic", group: "app", titleKey: "studio.cmd.classic", keywords: "classic old 经典 旧版 界面", run: () => useStudioPrefsStore.getState().setShell("classic") },
    { id: "app.report", group: "app", titleKey: "studio.cmd.report", keywords: "bug feedback 反馈 报告", run: context.openBugReport },
    { id: "app.about", group: "app", titleKey: "studio.cmd.about", keywords: "about version 关于 版本", run: context.openAbout },
  );
  return commands;
}

/** Case-insensitive match on title, context and keywords; every term must match. */
export function filterCommands(commands: StudioCommand[], query: string, translate: (key: string) => string): StudioCommand[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return commands;
  const scored: { command: StudioCommand; score: number }[] = [];
  for (const command of commands) {
    const title = translate(command.titleKey).toLowerCase();
    const haystack = `${title} ${command.contextKey ? translate(command.contextKey).toLowerCase() : ""} ${command.keywords ?? ""} ${command.id}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    const score = title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2;
    scored.push({ command, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.command);
}
