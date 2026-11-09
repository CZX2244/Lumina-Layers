/** Live converter state mapped onto the pre-generation check input. */
import { useShallow } from "zustand/react/shallow";
import { useConverterStore } from "../../stores/converter";
import { StructureMode } from "../../api/types";
import type { PreflightInput } from "./preflight";

export function usePreflightInput(): PreflightInput {
  return useConverterStore(
    useShallow((s): PreflightInput => ({
      hasImage: Boolean(s.imageFile) || (s.batchMode && s.batchFiles.length > 0),
      widthMm: s.target_width_mm,
      heightMm: s.target_height_mm,
      backingMm: s.spacer_thick,
      backingInfillPercent: s.backing_infill_density_percent,
      bed: s.bedSizes.find((bed) => bed.label === s.bed_label) ?? null,
      largeFormatEnabled: s.largeFormatEnabled,
      tileWidthMm: s.tileWidthMm,
      tileHeightMm: s.tileHeightMm,
      puzzleEnabled: s.puzzleEnabled,
      modelSurfaceEnabled: s.modelSurfaceEnabled,
      outlineEnabled: s.enable_outline,
      outlineWidthMm: s.outline_width,
      loopEnabled: s.add_loop,
      loopWidthMm: s.loop_width,
      loopLengthMm: s.loop_length,
      loopHoleMm: s.loop_hole,
      loopPositionPreset: s.loop_position_preset,
      reliefEnabled: s.enable_relief,
      magnetsEnabled: Boolean(s.enable_fridge_magnet),
      magnets: s.fridge_magnets,
      separateBackingProject: s.separate_backing && s.backingOutput === "separate_project",
      singleSided: s.structure_mode === StructureMode.SINGLE_SIDED,
    })),
  );
}
