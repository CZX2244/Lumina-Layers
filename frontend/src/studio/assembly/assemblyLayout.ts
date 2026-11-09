/**
 * Assembly reference layout for large-format tiles and puzzle pieces (pure).
 * 大画幅分块与拼图的装配参考布局（纯函数）。
 *
 * Large format reuses `utils/largeFormatTileLayout.ts`, which mirrors the
 * backend split: tiles start at the artwork's top-left corner, run row by
 * row and the last column/row keeps the remainder. Each tile is exported as
 * `<image name>_R{row}C{col}.3mf` inside the ZIP (core/vector_large_format.py
 * `format_large_format_tile_label`); the sheet keys tiles by that stable
 * `R{row}C{col}` suffix and marks tiles the backend reported as not generated. Puzzle labels mirror
 * `core/puzzle.py::_format_piece_label` (row letters, column number: A1, B3,
 * AA12) used for the exported `puzzle_{label}_…` objects.
 * 大画幅复用与后端一致的切分（左上角起按行切、末行末列留余量，ZIP 内 R{行}C{列}.3mf）；
 * 拼图编号与后端一致（行字母 + 列数字，导出对象 puzzle_{编号}_…）。
 */
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

/** Mirrors core/puzzle.py `_format_piece_label` (zero-based indices). */
export function formatPuzzlePieceLabel(rowIndex: number, colIndex: number): string {
  let value = rowIndex + 1;
  const letters: string[] = [];
  while (value > 0) {
    const remainder = (value - 1) % 26;
    value = Math.floor((value - 1) / 26);
    letters.push(String.fromCharCode(65 + remainder));
  }
  return `${letters.reverse().join("")}${colIndex + 1}`;
}

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

/**
 * Puzzle grid as resolved by the backend layout preview (rows/cols). Cells
 * give the nominal position used to place each label; irregular cut lines
 * come from the backend overlay image, drawn on top by the renderer.
 * 拼图网格取后端布局预览的行列；格子用于放置编号，异形切线由后端叠加图提供。
 */
export function puzzleAssembly(input: { widthMm: number; heightMm: number; rows: number; cols: number }): AssemblyLayout | null {
  const { widthMm, heightMm, rows, cols } = input;
  if (!(widthMm > 0 && heightMm > 0 && Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && cols > 0)) return null;
  const pieceW = widthMm / cols;
  const pieceH = heightMm / rows;
  const cells: AssemblyCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const label = formatPuzzlePieceLabel(row, col);
      cells.push({
        label, exportName: `puzzle_${label}`, row: row + 1, col: col + 1,
        xMm: round2(col * pieceW), yMm: round2(row * pieceH), widthMm: round2(pieceW), heightMm: round2(pieceH),
      });
    }
  }
  return { kind: "puzzle", totalWidthMm: round2(widthMm), totalHeightMm: round2(heightMm), rows, cols, cells };
}

/** File name for the saved sheet, derived from the source image name. */
export function assemblySheetFileName(sourceName: string | null | undefined): string {
  const stem = Array.from((sourceName ?? "").replace(/\.[^.]+$/, ""))
    .map((char) => (char.charCodeAt(0) < 32 || '\\/<>:"|?*'.includes(char) ? "_" : char))
    .join("").trim().slice(0, 80);
  return `${stem || "lumina"}_assembly.png`;
}
