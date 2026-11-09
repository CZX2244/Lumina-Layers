/**
 * Draw an assembly reference sheet (PNG) for a large-format or puzzle layout.
 * 绘制大画幅 / 拼图的装配参考图（PNG）。
 *
 * The artwork preview is drawn untouched; grid lines, labels and the legend
 * sit on top or below it. For puzzles the backend's own layout overlay is
 * drawn as well, so irregular cut lines match the generated pieces.
 */
import type { AssemblyLayout } from "./assemblyLayout";
import { ASSEMBLY_SHEET_COLORS } from "../../theme/assemblySheetTokens";

export interface AssemblySheetText {
  title: string;
  subtitle: string;
  orientation: string;
  legendTitle: string;
  footnote: string;
  /** Marker for parts the backend did not generate. */
  missing: string;
  formatSize: (widthMm: number, heightMm: number) => string;
}

const { paper: PAPER, ink: INK, muted: MUTED, rule: RULE, leaf: LEAF, labelFill: LABEL_FILL, missingShade: MISSING_SHADE } = ASSEMBLY_SHEET_COLORS;
const SANS = '"Noto Sans SC", "Source Han Sans SC", "MiSans", "Microsoft YaHei", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export async function renderAssemblySheet(
  layout: AssemblyLayout,
  sources: { artworkUrl: string; overlayUrl?: string | null },
  text: AssemblySheetText,
): Promise<Blob> {
  const artwork = await loadImage(sources.artworkUrl);
  const overlay = sources.overlayUrl ? await loadImage(sources.overlayUrl).catch(() => null) : null;

  const margin = 64;
  const artMaxW = 1600;
  const artMaxH = 1400;
  const scale = Math.min(artMaxW / layout.totalWidthMm, artMaxH / layout.totalHeightMm);
  const artW = Math.round(layout.totalWidthMm * scale);
  const artH = Math.round(layout.totalHeightMm * scale);
  const legendCols = Math.max(1, Math.min(4, Math.floor((artW + 160) / 260)));
  const legendRows = Math.ceil(layout.cells.length / legendCols);
  const headerH = 150;
  const legendH = 70 + legendRows * 30;
  const width = Math.max(artW, 900) + margin * 2;
  const height = headerH + artH + 60 + legendH + 80;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text.title, margin, 78);
  ctx.fillStyle = MUTED;
  ctx.font = `500 18px ${MONO}`;
  ctx.fillText(text.subtitle, margin, 112);

  const artX = margin;
  const artY = headerH;
  // Orientation marker above the top edge.
  ctx.fillStyle = MUTED;
  ctx.font = `500 14px ${SANS}`;
  ctx.fillText(`↑ ${text.orientation}`, artX, artY - 12);

  ctx.drawImage(artwork, artX, artY, artW, artH);
  if (overlay) ctx.drawImage(overlay, artX, artY, artW, artH);

  // Grid lines (large format: exact cuts; puzzle: overlay above holds exact cuts).
  ctx.strokeStyle = INK;
  ctx.lineWidth = layout.kind === "large-format" ? 2 : 1;
  ctx.setLineDash(layout.kind === "large-format" ? [] : [6, 6]);
  ctx.strokeRect(artX, artY, artW, artH);
  if (layout.kind === "large-format") {
    for (const cell of layout.cells) {
      ctx.strokeRect(artX + cell.xMm * scale, artY + cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale);
    }
  }
  ctx.setLineDash([]);

  // Labels at cell centres.
  const labelSize = Math.max(14, Math.min(28, Math.floor(Math.min(...layout.cells.map((c) => c.widthMm * scale)) / 4)));
  ctx.font = `500 ${labelSize}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const cell of layout.cells) {
    if (cell.missing) {
      ctx.fillStyle = MISSING_SHADE;
      ctx.fillRect(artX + cell.xMm * scale, artY + cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale);
    }
    const cx = artX + (cell.xMm + cell.widthMm / 2) * scale;
    const cy = artY + (cell.yMm + cell.heightMm / 2) * scale;
    const boxW = ctx.measureText(cell.label).width + 16;
    const boxH = labelSize + 10;
    ctx.fillStyle = LABEL_FILL;
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.fillStyle = INK;
    ctx.fillText(cell.label, cx, cy + 1);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Overall size under the artwork.
  ctx.fillStyle = INK;
  ctx.font = `500 16px ${MONO}`;
  ctx.fillText(text.formatSize(layout.totalWidthMm, layout.totalHeightMm), artX, artY + artH + 32);

  // Legend: label → exported item and size.
  const legendY = artY + artH + 80;
  ctx.fillStyle = LEAF;
  ctx.fillRect(margin, legendY - 22, 6, 26);
  ctx.fillStyle = INK;
  ctx.font = `600 20px ${SANS}`;
  ctx.fillText(text.legendTitle, margin + 16, legendY);
  ctx.font = `400 15px ${MONO}`;
  const colW = (width - margin * 2) / legendCols;
  layout.cells.forEach((cell, index) => {
    const col = Math.floor(index / legendRows);
    const row = index % legendRows;
    const x = margin + col * colW;
    const y = legendY + 36 + row * 30;
    ctx.fillStyle = INK;
    ctx.fillText(cell.exportName, x, y);
    ctx.fillStyle = MUTED;
    const size = `${fmt(cell.widthMm)}×${fmt(cell.heightMm)} mm`;
    ctx.fillText(cell.missing ? `${size} · ${text.missing}` : size, x + Math.min(150, colW * 0.55), y);
  });

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, height - 52);
  ctx.lineTo(width - margin, height - 52);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `400 14px ${SANS}`;
  ctx.fillText(text.footnote, margin, height - 26);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png_encode_failed"))), "image/png");
  });
}
