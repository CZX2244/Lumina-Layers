/**
 * Built-in finished-product templates and preset file import/export (pure).
 * 内置成品模板与预设文件导入导出（纯逻辑）。
 */
import type { ConverterActions, ConverterState } from "../../stores/converter/types";
import { useConverterStore } from "../../stores/converter";
import { navigateStudio } from "../navigation";
import { OPEN_PRODUCT_EVENT } from "../workbenchSteps";
import {
  normalizeConversionPreferences,
  validatePresetName,
  type ConversionPreset,
} from "../../stores/conversionPreferences";

type Store = ConverterState & ConverterActions;

export interface ProductTemplate {
  id: string;
  titleKey: string;
  detailKey: string;
  /** Long edge in millimetres. */
  sizeMm: number;
  /** Workbench product card this template switches on (expanded after applying). */
  productId?: string;
  apply: (state: Store, context: { bedWidthMm: number | null; bedHeightMm: number | null }) => void;
}

/** Turn off every product feature so templates start from a plain picture. */
function resetProductFeatures(state: Store): void {
  if (state.add_loop) state.setAddLoop(false);
  if (state.enable_fridge_magnet) state.setEnableFridgeMagnet(false);
  if (state.puzzleEnabled) state.setPuzzleEnabled(false);
  if (state.largeFormatEnabled) state.setLargeFormatEnabled(false);
  if (state.enable_relief) state.setEnableRelief(false);
}

function setLongEdge(state: Store, sizeMm: number): void {
  const ratio = state.aspectRatio;
  if (ratio !== null && ratio < 1) state.setTargetHeightMm(sizeMm);
  else state.setTargetWidthMm(sizeMm);
}

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: "keychain",
    productId: "keychain",
    titleKey: "studio.template.keychain",
    detailKey: "studio.template.keychain_detail",
    sizeMm: 50,
    apply: (state) => {
      resetProductFeatures(state);
      setLongEdge(state, 50);
      state.setAddLoop(true);
    },
  },
  {
    id: "fridge-magnet",
    productId: "fridge-magnet",
    titleKey: "studio.template.fridge_magnet",
    detailKey: "studio.template.fridge_magnet_detail",
    sizeMm: 70,
    apply: (state) => {
      resetProductFeatures(state);
      setLongEdge(state, 70);
      state.setEnableFridgeMagnet(true);
    },
  },
  {
    id: "framed",
    titleKey: "studio.template.framed",
    detailKey: "studio.template.framed_detail",
    sizeMm: 150,
    apply: (state) => {
      resetProductFeatures(state);
      setLongEdge(state, 150);
    },
  },
  {
    id: "puzzle",
    productId: "puzzle",
    titleKey: "studio.template.puzzle",
    detailKey: "studio.template.puzzle_detail",
    sizeMm: 180,
    apply: (state) => {
      resetProductFeatures(state);
      setLongEdge(state, 180);
      state.setPuzzleEnabled(true);
      state.setPuzzleSizingMode("grid");
      state.setPuzzleRows(4);
      state.setPuzzleCols(5);
    },
  },
  {
    id: "large-format",
    titleKey: "studio.template.large_format",
    detailKey: "studio.template.large_format_detail",
    sizeMm: 400,
    apply: (state, { bedWidthMm, bedHeightMm }) => {
      resetProductFeatures(state);
      setLongEdge(state, 400);
      state.setLargeFormatEnabled(true);
      // Leave room on the plate for a wipe tower / brim.
      if (bedWidthMm && bedHeightMm) {
        state.setTileWidthMm(Math.max(50, Math.floor(bedWidthMm - 20)));
        state.setTileHeightMm(Math.max(50, Math.floor(bedHeightMm - 20)));
      }
    },
  },
];

/** Apply a template to the live converter and open the workbench. */
export function applyProductTemplate(template: ProductTemplate): void {
  const state = useConverterStore.getState();
  const bed = state.bedSizes.find((item) => item.label === state.bed_label) ?? null;
  template.apply(state, { bedWidthMm: bed?.width_mm ?? null, bedHeightMm: bed?.height_mm ?? null });
  navigateStudio("converter");
  const productId = template.productId;
  if (productId) window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_PRODUCT_EVENT, { detail: productId })), 200);
}

// ── Preset files ──────────────────────────────────────────────────

export const PRESET_FILE_FORMAT = "lumina-plus-presets";

export function serializePresets(presets: ConversionPreset[]): string {
  return JSON.stringify({ format: PRESET_FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), presets }, null, 2);
}

export interface PresetImportResult {
  merged: ConversionPreset[];
  added: number;
  skipped: number;
}

/**
 * Validate presets from a file (same whitelist as saved settings) and merge
 * them into the current list. Name clashes get a numeric suffix; every
 * imported preset gets a fresh id.
 * 用与设置相同的白名单校验导入的预设并合并；重名自动加序号，id 重新生成。
 */
export function mergeImportedPresets(
  current: ConversionPreset[],
  text: string,
  makeId: () => string = () => (globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`),
): PresetImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("invalid-json"); }
  const list = Array.isArray(raw) ? raw : (raw as { presets?: unknown })?.presets;
  if (!Array.isArray(list)) throw new Error("no-presets");
  const candidates = list.map((entry, index) => ({
    ...(entry && typeof entry === "object" ? entry : {}),
    id: `import-${index}`,
  }));
  // normalizeConversionPreferences drops invalid entries and duplicate names.
  const valid = normalizeConversionPreferences({ presets: candidates }).presets;
  const merged = [...current];
  for (const preset of valid) {
    let name = preset.name;
    for (let suffix = 2; validatePresetName(name, merged) !== null; suffix += 1) {
      const base = preset.name.slice(0, 34);
      name = `${base} (${suffix})`;
      if (suffix > 99) break;
    }
    if (validatePresetName(name, merged) !== null) continue;
    merged.push({ id: makeId(), name, parameters: preset.parameters });
  }
  return { merged, added: merged.length - current.length, skipped: list.length - (merged.length - current.length) };
}
