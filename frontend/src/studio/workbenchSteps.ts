/**
 * Converter workbench steps and their anchors in the settings column.
 * 图像转换工作台的步骤及其在设置栏中的定位。
 */
export const WORKBENCH_STEPS = [
  { id: "source", labelKey: "studio.step.source" },
  { id: "color", labelKey: "studio.step.color" },
  { id: "size", labelKey: "studio.step.size" },
  { id: "product", labelKey: "studio.step.product" },
  { id: "advanced", labelKey: "studio.step.advanced" },
] as const;
export type WorkbenchStepId = (typeof WORKBENCH_STEPS)[number]["id"];

export const WORKBENCH_SETTINGS_SELECTOR = '[data-testid="studio-workbench-settings"]';

/** Locate a step's first element inside the settings column. */
export function stepElement(root: ParentNode, step: WorkbenchStepId): HTMLElement | null {
  switch (step) {
    case "source":
      return root.querySelector<HTMLElement>('[data-tutorial="image-upload"]');
    case "color":
      return root.querySelector<HTMLElement>('[data-tutorial="color-source"]');
    case "size": {
      // BasicSettings renders "size & base plate" right after the colour source block.
      const color = root.querySelector<HTMLElement>('[data-tutorial="color-source"]');
      return (color?.nextElementSibling as HTMLElement | null) ?? null;
    }
    default:
      return root.querySelector<HTMLElement>(`[data-studio-step="${step}"]`);
  }
}

/** Scroll the settings column to a step. */
export function scrollWorkbenchStep(step: WorkbenchStepId): void {
  const root = document.querySelector<HTMLElement>(WORKBENCH_SETTINGS_SELECTOR);
  if (!root) return;
  stepElement(root, step)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Ask the workbench to expand (and scroll to) one product-type card. */
export const OPEN_PRODUCT_EVENT = "lumina-plus:open-product";

/** Product-type cards in the workbench; ids match ConverterWorkbench. */
export const WORKBENCH_PRODUCTS = [
  { id: "keychain", titleKey: "widget.keychainLoop", keywords: "keychain loop hole 钥匙扣 挂环 挂孔" },
  { id: "fridge-magnet", titleKey: "widget.fridgeMagnetSettings", keywords: "fridge magnet 冰箱贴 磁铁" },
  { id: "relief", titleKey: "widget.reliefSettings", keywords: "relief heightmap 浮雕 高度" },
  { id: "outline", titleKey: "widget.outlineSettings", keywords: "outline border 描边 外轮廓" },
  { id: "coating", titleKey: "widget.coatingSettings", keywords: "coating clear 涂层 透明" },
  { id: "puzzle", titleKey: "widget.puzzleSettings", keywords: "puzzle jigsaw 拼图" },
  { id: "model-surface", titleKey: "widget.modelSurfaceSettings", keywords: "model surface texture stl 模型 覆面 贴图" },
] as const;
