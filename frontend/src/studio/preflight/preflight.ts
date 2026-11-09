/**
 * Pre-generation checks (pure). Surface printing risks before the user
 * downloads a 3MF or opens the slicer.
 * 生成前检查（纯函数）：在下载 3MF 或送入切片器之前提示打印风险。
 *
 * Rules that the backend enforces are mirrored as "error" so the user sees
 * them before a request fails; physical risks are "warning"; automatic
 * adjustments are "info".
 * 后端会拒绝的组合标为 error；物理风险为 warning；自动调整为 info。
 */
import type { BedSizeItem, FridgeMagnetItem } from "../../api/types";

/** Space we like to keep free on the plate for a wipe tower / brim. */
export const PLATE_MARGIN_MM = 10;
/** Thinnest keychain ring wall (each side) we consider sturdy. */
export const MIN_RING_WALL_MM = 1.2;
/** Closest a magnet pocket may get to the outer edge. */
export const MIN_MAGNET_EDGE_MM = 1.5;

export type PreflightLevel = "error" | "warning" | "info";

export interface PreflightIssue {
  id: string;
  level: PreflightLevel;
  /** i18n key; `{name}` placeholders are filled from params. */
  messageKey: string;
  params?: Record<string, string | number>;
}

export interface PreflightInput {
  hasImage: boolean;
  widthMm: number;
  heightMm: number;
  /** Backing the user chose. 用户设置的底板厚度。 */
  baseBackingMm: number;
  /** Backing that will be generated (after automatic magnet thickening). 实际生成的底板厚度。 */
  backingMm: number;
  backingInfillPercent: number;
  bed: BedSizeItem | null;
  largeFormatEnabled: boolean;
  tileWidthMm: number;
  tileHeightMm: number;
  puzzleEnabled: boolean;
  modelSurfaceEnabled: boolean;
  outlineEnabled: boolean;
  outlineWidthMm: number;
  loopEnabled: boolean;
  loopWidthMm: number;
  loopLengthMm: number;
  loopHoleMm: number;
  loopPositionPreset: string;
  reliefEnabled: boolean;
  magnetsEnabled: boolean;
  magnets: FridgeMagnetItem[];
  separateBackingProject: boolean;
  singleSided: boolean;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function fits(width: number, height: number, bed: BedSizeItem, margin = 0): boolean {
  const bw = bed.width_mm - margin;
  const bh = bed.height_mm - margin;
  return (width <= bw && height <= bh) || (width <= bh && height <= bw);
}

/** Overall footprint including the outline and a protruding keychain loop. */
export function footprintMm(input: PreflightInput): { width: number; height: number } {
  const outline = input.outlineEnabled ? Math.max(0, input.outlineWidthMm) * 2 : 0;
  let width = input.widthMm + outline;
  let height = input.heightMm + outline;
  if (input.loopEnabled) {
    const preset = input.loopPositionPreset.toLowerCase();
    if (preset.includes("left") || preset.includes("right")) {
      if (!preset.includes("top") && !preset.includes("bottom")) width += input.loopLengthMm;
      else height += input.loopLengthMm;
    } else {
      height += input.loopLengthMm;
    }
  }
  return { width: round1(width), height: round1(height) };
}

function magnetHalfExtent(magnet: FridgeMagnetItem): { x: number; y: number } {
  if (magnet.shape === "round") {
    const radius = (magnet.diameter_mm ?? 0) / 2;
    return { x: radius, y: radius };
  }
  return { x: (magnet.width_mm ?? 0) / 2, y: (magnet.height_mm ?? 0) / 2 };
}

export function runPreflight(input: PreflightInput): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  if (!input.hasImage) {
    return [{ id: "no-image", level: "info", messageKey: "studio.preflight.no_image" }];
  }

  // ── Backend-enforced combinations ──
  if (input.modelSurfaceEnabled && input.largeFormatEnabled) {
    issues.push({ id: "surface-large-format", level: "error", messageKey: "studio.preflight.surface_large_format" });
  }
  if (input.reliefEnabled && input.backingInfillPercent < 100) {
    issues.push({ id: "relief-infill", level: "error", messageKey: "studio.preflight.relief_infill" });
  }
  if (input.separateBackingProject && (!input.singleSided || input.reliefEnabled)) {
    issues.push({ id: "separate-backing", level: "error", messageKey: "studio.preflight.separate_backing" });
  }

  // ── Plate fit ──
  const footprint = footprintMm(input);
  if (input.bed && !input.modelSurfaceEnabled) {
    if (input.largeFormatEnabled) {
      if (!fits(input.tileWidthMm, input.tileHeightMm, input.bed)) {
        issues.push({
          id: "tile-exceeds-bed", level: "error", messageKey: "studio.preflight.tile_exceeds_bed",
          params: { tile: `${round1(input.tileWidthMm)}×${round1(input.tileHeightMm)}`, bed: input.bed.label },
        });
      }
    } else if (!input.puzzleEnabled) {
      const size = `${footprint.width}×${footprint.height}`;
      if (!fits(footprint.width, footprint.height, input.bed)) {
        issues.push({ id: "exceeds-bed", level: "warning", messageKey: "studio.preflight.exceeds_bed", params: { size, bed: input.bed.label } });
      } else if (!fits(footprint.width, footprint.height, input.bed, PLATE_MARGIN_MM)) {
        issues.push({ id: "tight-bed", level: "warning", messageKey: "studio.preflight.tight_bed", params: { size, bed: input.bed.label } });
      }
    }
  }

  // ── Physical risks ──
  if (Math.min(input.widthMm, input.heightMm) < 15 && !input.largeFormatEnabled) {
    issues.push({ id: "tiny", level: "warning", messageKey: "studio.preflight.tiny", params: { size: round1(Math.min(input.widthMm, input.heightMm)) } });
  }
  if (input.loopEnabled) {
    const wall = (input.loopWidthMm - input.loopHoleMm) / 2;
    if (wall < MIN_RING_WALL_MM) {
      issues.push({ id: "ring-wall", level: "warning", messageKey: "studio.preflight.ring_wall", params: { wall: round1(Math.max(0, wall)), min: MIN_RING_WALL_MM } });
    }
  }
  if (input.magnetsEnabled && input.magnets.length) {
    // The store resolves the thickened backing with the same rule as the
    // generation validator (constants/fridgeMagnets.ts), so preview and 3MF agree.
    if (input.backingMm > input.baseBackingMm + 1e-6) {
      issues.push({ id: "magnet-backing", level: "info", messageKey: "studio.preflight.magnet_backing", params: { from: Math.round(input.baseBackingMm * 100) / 100, to: Math.round(input.backingMm * 100) / 100 } });
    }
    const halfW = input.widthMm / 2;
    const halfH = input.heightMm / 2;
    const nearEdge = input.magnets.filter((magnet) => {
      const extent = magnetHalfExtent(magnet);
      const edgeX = halfW - (Math.abs(magnet.center_x_mm) + extent.x);
      const edgeY = halfH - (Math.abs(magnet.center_y_mm) + extent.y);
      return Math.min(edgeX, edgeY) < MIN_MAGNET_EDGE_MM;
    });
    if (nearEdge.length) {
      issues.push({ id: "magnet-edge", level: "warning", messageKey: "studio.preflight.magnet_edge", params: { count: nearEdge.length, min: MIN_MAGNET_EDGE_MM } });
    }
  }
  return issues;
}

/** Fill `{name}` placeholders of a translated message. */
export function formatPreflightMessage(template: string, params: PreflightIssue["params"]): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}
