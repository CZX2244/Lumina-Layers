/**
 * "Save assembly reference" for large-format and puzzle work.
 * 大画幅 / 拼图的“保存装配参考图”。
 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../../i18n/context";
import { useConverterStore } from "../../stores/converter";
import { resolveLargeFormatTotalHeightMm } from "../../utils/largeFormatTileLayout";
import { saveGeneratedFile } from "../../utils/saveGeneratedFile";
import { assemblySheetFileName, largeFormatAssembly, puzzleAssembly } from "./assemblyLayout";
import { renderAssemblySheet } from "./renderAssemblySheet";

export function AssemblySheetButton() {
  const { t } = useI18n();
  const s = useConverterStore(useShallow((state) => ({
    largeFormat: state.largeFormatEnabled && !state.modelSurfaceEnabled,
    puzzle: state.puzzleEnabled,
    width: state.target_width_mm,
    height: state.target_height_mm,
    tileW: state.tileWidthMm,
    tileH: state.tileHeightMm,
    previewW: state.previewPixelWidth,
    previewH: state.previewPixelHeight,
    rows: state.puzzleResolvedRows,
    cols: state.puzzleResolvedCols,
    overlay: state.puzzleOverlayUrl,
    artwork: state.previewImageUrl ?? state.imagePreviewUrl,
    name: state.imageFile?.name ?? null,
    failedTiles: state.largeFormatFailedTiles,
  })));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!s.largeFormat && !s.puzzle) return null;

  const layout = s.largeFormat
    ? largeFormatAssembly({
      widthMm: s.width,
      heightMm: resolveLargeFormatTotalHeightMm(s.width, s.height, s.previewW, s.previewH),
      tileWidthMm: s.tileW,
      tileHeightMm: s.tileH,
      failedTiles: s.failedTiles,
    })
    : s.rows && s.cols ? puzzleAssembly({ widthMm: s.width, heightMm: s.height, rows: s.rows, cols: s.cols }) : null;
  const reason = !s.artwork ? t("studio.assembly.need_image") : !layout ? t(s.puzzle ? "studio.assembly.need_puzzle_preview" : "studio.assembly.need_size") : null;

  const save = async () => {
    if (!layout || !s.artwork) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob = await renderAssemblySheet(layout, { artworkUrl: s.artwork, overlayUrl: s.puzzle ? s.overlay : null }, {
        title: t(layout.kind === "puzzle" ? "studio.assembly.title_puzzle" : "studio.assembly.title_tiles"),
        subtitle: t("studio.assembly.subtitle").replace("{count}", String(layout.cells.length)).replace("{rows}", String(layout.rows)).replace("{cols}", String(layout.cols)),
        orientation: t("studio.assembly.orientation"),
        legendTitle: t(layout.kind === "puzzle" ? "studio.assembly.legend_puzzle" : "studio.assembly.legend_tiles"),
        footnote: t(layout.kind === "puzzle" ? "studio.assembly.footnote_puzzle" : "studio.assembly.footnote_tiles"),
        missing: t("studio.assembly.missing"),
        formatSize: (w, h) => t("studio.assembly.total").replace("{w}", w.toFixed(1)).replace("{h}", h.toFixed(1)),
      });
      const outcome = await saveGeneratedFile(blob, assemblySheetFileName(s.name), "assembly");
      if (outcome !== "canceled") setStatus(t("studio.assembly.saved"));
    } catch {
      setStatus(t("studio.assembly.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="studio-assembly" className="mx-3 mt-3 flex flex-col gap-1.5">
      <button type="button" disabled={Boolean(reason) || busy} onClick={() => void save()} className="action-control rounded-[4px] px-3 py-2 text-sm font-medium disabled:opacity-40">
        {busy ? t("studio.assembly.saving") : t("studio.assembly.save").replace("{count}", String(layout?.cells.length ?? 0))}
      </button>
      <p className="text-xs leading-5 text-[var(--surface-text-muted)]">{reason ?? t("studio.assembly.hint")}</p>
      {status && <p role="status" className="text-xs text-[var(--surface-text-muted)]">{status}</p>}
    </div>
  );
}
