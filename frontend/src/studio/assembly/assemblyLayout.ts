/**
 * Assembly reference layout for large-format tiles and puzzle pieces (pure).
 * 大画幅分块与拼图的装配参考布局（纯函数）。
 *
 * Large format reuses `utils/largeFormatTileLayout.ts`, which mirrors the
 * backend split: tiles start at the artwork's top-left corner, run row by
 * row and the last column/row keeps the remainder. Each tile is exported as
 * `<image name>_R{row}C{col}.3mf` inside the ZIP (core/vector_large_format.py
 * `format_large_format_tile_label`); the sheet keys tiles by that stable
 * `R{row}C{col}` suffix and marks tiles the backend reported as not generated. Puzzle pieces
 * come straight from the backend layout (`pieces` in the preview/generate
 * responses), whose labels name the exported `puzzle_{label}_…` objects.
 * 大画幅复用与后端一致的切分（左上角起按行切、末行末列留余量，ZIP 内 R{行}C{列}.3mf）；
 * 拼图块直接用后端返回的布局（编号即导出对象 puzzle_{编号}_…）。
 */
import type { PuzzlePieceSummary } from "../../api/types";
import { formatLargeFormatTileLabel, resolveLargeFormatTileGrid } from "../../utils/largeFormatTileLayout";

export interface AssemblyCell {
  label: string;
  /** Name of the exported item this cell corresponds to. */
  exportName: string;
  row: number;
  col: number;
  /** Offset from the artwork's top-left corner, mm. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** The backend reported this part as not generated (e.g. an empty tile). */
  missing?: boolean;
  /** Where to draw the label (piece centroid); defaults to the cell centre. */
  labelXMm?: number;
  labelYMm?: number;
}

export interface AssemblyLayout {
  kind: "large-format" | "puzzle";
  totalWidthMm: number;
  totalHeightMm: number;
  rows: number;
  cols: number;
  cells: AssemblyCell[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function largeFormatAssembly(input: {
  widthMm: number;
  heightMm: number;
  tileWidthMm: number;
  tileHeightMm: number;
  /** Tile ids (`R2C1`) the last generation reported as failed. */
  failedTiles?: readonly string[];
}): AssemblyLayout | null {
  const grid = resolveLargeFormatTileGrid(input.widthMm, input.heightMm, input.tileWidthMm, input.tileHeightMm);
  if (!grid) return null;
  const cells: AssemblyCell[] = [];
  for (let row = 1; row <= grid.rows; row += 1) {
    for (let col = 1; col <= grid.cols; col += 1) {
      const label = formatLargeFormatTileLabel(row, col);
      cells.push({
        label,
        exportName: `…_${label}.3mf`,
        row,
        col,
        missing: input.failedTiles?.includes(label) || undefined,
        xMm: round2((col - 1) * input.tileWidthMm),
        yMm: round2((row - 1) * input.tileHeightMm),
        widthMm: round2(col === grid.cols ? grid.lastColumnWidthMm : input.tileWidthMm),
        heightMm: round2(row === grid.rows ? grid.lastRowHeightMm : input.tileHeightMm),
      });
    }
  }
  return { kind: "large-format", totalWidthMm: round2(input.widthMm), totalHeightMm: round2(input.heightMm), rows: grid.rows, cols: grid.cols, cells };
}

/** Row/column of a backend label such as `B3` or `AA12` (1-based); null when malformed. */
export function parsePuzzlePieceLabel(label: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(label);
  if (!match) return null;
  const row = Array.from(match[1]).reduce((value, char) => value * 26 + (char.charCodeAt(0) - 64), 0);
  return { row, col: Number(match[2]) };
}

/**
 * Puzzle pieces exactly as the backend laid them out (preview, then the
 * generated result). Transparent cells drop out of the layout, so the sheet
 * must not assume a full rows × cols grid: numbering, positions and the list
 * all come from the reported pieces. Irregular cut lines come from the backend
 * overlay image, drawn on top by the renderer.
 * 拼图块直接取后端布局（预览结果，导出后用导出结果）；透明格子不成块，
 * 所以编号、位置和清单都按实际块，不按满格网格。
 */
export function puzzleAssembly(input: {
  widthMm: number;
  heightMm: number;
  rows: number;
  cols: number;
  pieces: readonly PuzzlePieceSummary[] | null | undefined;
}): AssemblyLayout | null {
  const { widthMm, heightMm, rows, cols, pieces } = input;
  if (!(widthMm > 0 && heightMm > 0) || !pieces?.length) return null;
  const cells: AssemblyCell[] = pieces.map((piece) => {
    const [x0, y0, x1, y1] = piece.bbox_mm;
    const position = parsePuzzlePieceLabel(piece.label);
    return {
      label: piece.label,
      exportName: `puzzle_${piece.label}`,
      row: position?.row ?? 0,
      col: position?.col ?? 0,
      xMm: round2(x0),
      yMm: round2(y0),
      widthMm: round2(x1 - x0),
      heightMm: round2(y1 - y0),
      labelXMm: round2(piece.centroid_mm[0]),
      labelYMm: round2(piece.centroid_mm[1]),
    };
  });
  cells.sort((a, b) => a.row - b.row || a.col - b.col || a.label.localeCompare(b.label));
  return { kind: "puzzle", totalWidthMm: round2(widthMm), totalHeightMm: round2(heightMm), rows, cols, cells };
}

/** File name for the saved sheet, derived from the source image name. */
export function assemblySheetFileName(sourceName: string | null | undefined): string {
  const stem = Array.from((sourceName ?? "").replace(/\.[^.]+$/, ""))
    .map((char) => (char.charCodeAt(0) < 32 || '\\/<>:"|?*'.includes(char) ? "_" : char))
    .join("").trim().slice(0, 80);
  return `${stem || "lumina"}_assembly.png`;
}
