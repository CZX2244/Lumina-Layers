import { describe, expect, it } from "vitest";
import { assemblySheetFileName, formatPuzzlePieceLabel, largeFormatAssembly, puzzleAssembly } from "../assembly/assemblyLayout";

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
  it("labels pieces exactly like core/puzzle.py", () => {
    // Expected values printed by core.puzzle._format_piece_label.
    const pairs: Array<[number, number, string]> = [[0, 0, "A1"], [1, 2, "B3"], [25, 0, "Z1"], [26, 0, "AA1"], [27, 11, "AB12"], [701, 0, "ZZ1"], [702, 3, "AAA4"]];
    for (const [row, col, label] of pairs) expect(formatPuzzlePieceLabel(row, col)).toBe(label);
  });

  it("covers the resolved grid with export names", () => {
    const layout = puzzleAssembly({ widthMm: 180, heightMm: 120, rows: 2, cols: 3 })!;
    expect(layout.cells.map((cell) => cell.exportName)).toEqual(["puzzle_A1", "puzzle_A2", "puzzle_A3", "puzzle_B1", "puzzle_B2", "puzzle_B3"]);
    expect(layout.cells[4]).toMatchObject({ xMm: 60, yMm: 60, widthMm: 60, heightMm: 60 });
  });
});

describe("assembly sheet file name", () => {
  it("derives a safe name from the source image", () => {
    expect(assemblySheetFileName("cat photo.jpg")).toBe("cat photo_assembly.png");
    expect(assemblySheetFileName('a<b>:c?.png')).toBe("a_b__c__assembly.png");
    expect(assemblySheetFileName(null)).toBe("lumina_assembly.png");
  });
});
