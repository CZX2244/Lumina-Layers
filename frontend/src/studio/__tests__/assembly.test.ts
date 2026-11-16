import { describe, expect, it } from "vitest";
import type { PuzzlePieceSummary } from "../../api/types";
import { assemblySheetFileName, largeFormatAssembly, parsePuzzlePieceLabel, puzzleAssembly } from "../assembly/assemblyLayout";

describe("large-format assembly layout", () => {
  it("numbers tiles row by row from the top-left like the exported ZIP", () => {
    const layout = largeFormatAssembly({ widthMm: 500, heightMm: 300, tileWidthMm: 200, tileHeightMm: 200 })!;
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(3);
    expect(layout.cells.map((cell) => cell.label)).toEqual(["R1C1", "R1C2", "R1C3", "R2C1", "R2C2", "R2C3"]);
    // ZIP entries are "<image name>_R1C1.3mf" (core/vector_large_format.py).
    expect(layout.cells[0].exportName).toBe("…_R1C1.3mf");
  });

  it("keeps the remainder on the last column and row", () => {
    const layout = largeFormatAssembly({ widthMm: 500, heightMm: 300, tileWidthMm: 200, tileHeightMm: 200 })!;
    const byLabel = Object.fromEntries(layout.cells.map((cell) => [cell.label, cell]));
    expect(byLabel.R1C1).toMatchObject({ xMm: 0, yMm: 0, widthMm: 200, heightMm: 200 });
    expect(byLabel.R1C3).toMatchObject({ xMm: 400, widthMm: 100 });
    expect(byLabel.R2C3).toMatchObject({ yMm: 200, widthMm: 100, heightMm: 100 });
    const area = layout.cells.reduce((sum, cell) => sum + cell.widthMm * cell.heightMm, 0);
    expect(area).toBeCloseTo(500 * 300);
  });

  it("marks tiles the backend reported as not generated", () => {
    const layout = largeFormatAssembly({ widthMm: 300, heightMm: 400, tileWidthMm: 330, tileHeightMm: 300, failedTiles: ["R2C1"] })!;
    expect(layout.cells.map((cell) => [cell.label, Boolean(cell.missing)])).toEqual([["R1C1", false], ["R2C1", true]]);
  });

  it("does not add an empty column when the size divides exactly", () => {
    expect(largeFormatAssembly({ widthMm: 400, heightMm: 200, tileWidthMm: 200, tileHeightMm: 200 })!.cells).toHaveLength(2);
  });

  it("rejects invalid sizes", () => {
    expect(largeFormatAssembly({ widthMm: 0, heightMm: 200, tileWidthMm: 200, tileHeightMm: 200 })).toBeNull();
  });
});

describe("puzzle assembly layout", () => {
  it("reads row and column from backend labels (core/puzzle.py _format_piece_label)", () => {
    // Labels printed by core.puzzle._format_piece_label for zero-based (row, col).
    const pairs: Array<[string, number, number]> = [["A1", 1, 1], ["B3", 2, 3], ["Z1", 26, 1], ["AA1", 27, 1], ["AB12", 28, 12], ["ZZ1", 702, 1], ["AAA4", 703, 4]];
    for (const [label, row, col] of pairs) expect(parsePuzzlePieceLabel(label)).toEqual({ row, col });
    expect(parsePuzzlePieceLabel("puzzle")).toBeNull();
  });

  // A 2 × 3 grid over an image whose right part is transparent: the backend
  // returns only the cells that hold something, with jigsaw tabs widening the boxes.
  const pieces: PuzzlePieceSummary[] = [
    { label: "B1", bbox_mm: [0, 30, 24.5, 60], centroid_mm: [11.8, 45.2] },
    { label: "A1", bbox_mm: [0, 0, 24.5, 34.1], centroid_mm: [11.9, 15.1] },
    { label: "A2", bbox_mm: [17.2, 0, 40, 30], centroid_mm: [29.4, 14.6] },
  ];

  it("numbers, places and lists exactly the pieces the backend reported", () => {
    const layout = puzzleAssembly({ widthMm: 90, heightMm: 60, rows: 2, cols: 3, pieces })!;
    expect(layout.cells.map((cell) => cell.exportName)).toEqual(["puzzle_A1", "puzzle_A2", "puzzle_B1"]);
    expect(layout.cells[1]).toMatchObject({ label: "A2", row: 1, col: 2, xMm: 17.2, yMm: 0, widthMm: 22.8, heightMm: 30, labelXMm: 29.4, labelYMm: 14.6 });
    expect(layout).toMatchObject({ totalWidthMm: 90, totalHeightMm: 60, rows: 2, cols: 3 });
  });

  it("has no layout until the backend has reported pieces", () => {
    expect(puzzleAssembly({ widthMm: 90, heightMm: 60, rows: 2, cols: 3, pieces: null })).toBeNull();
    expect(puzzleAssembly({ widthMm: 90, heightMm: 60, rows: 2, cols: 3, pieces: [] })).toBeNull();
  });
});

describe("assembly sheet file name", () => {
  it("derives a safe name from the source image", () => {
    expect(assemblySheetFileName("cat photo.jpg")).toBe("cat photo_assembly.png");
    expect(assemblySheetFileName('a<b>:c?.png')).toBe("a_b__c__assembly.png");
    expect(assemblySheetFileName(null)).toBe("lumina_assembly.png");
  });
});
