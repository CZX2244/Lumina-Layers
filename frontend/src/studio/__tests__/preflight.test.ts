import { describe, expect, it } from "vitest";
import { footprintMm, formatPreflightMessage, runPreflight, type PreflightInput } from "../preflight/preflight";
import { resolveFridgeMagnetSpacerThick } from "../../constants/fridgeMagnets";
import type { FridgeMagnetItem } from "../../api/types";

const bed = { label: "Bambu Lab H2D", width_mm: 350, height_mm: 320, is_default: true };

function input(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    hasImage: true, widthMm: 100, heightMm: 80, baseBackingMm: 1.2, backingMm: 1.2, backingInfillPercent: 100, bed,
    largeFormatEnabled: false, tileWidthMm: 200, tileHeightMm: 200, puzzleEnabled: false, modelSurfaceEnabled: false,
    outlineEnabled: false, outlineWidthMm: 2, loopEnabled: false, loopWidthMm: 8, loopLengthMm: 6, loopHoleMm: 3,
    loopPositionPreset: "top-center", reliefEnabled: false, magnetsEnabled: false, magnets: [],
    separateBackingProject: false, singleSided: true,
    ...overrides,
  };
}

const magnet = (overrides: Partial<FridgeMagnetItem> = {}): FridgeMagnetItem => ({
  id: "m1", shape: "round", preset_key: "10x2", diameter_mm: 10, width_mm: null, height_mm: null, thickness_mm: 2,
  center_x_mm: 0, center_y_mm: 0, ...overrides,
});

const ids = (value: PreflightInput) => runPreflight(value).map((issue) => issue.id);

describe("runPreflight", () => {
  it("passes an ordinary picture", () => {
    expect(runPreflight(input())).toEqual([]);
  });

  it("asks for an image first", () => {
    expect(ids(input({ hasImage: false }))).toEqual(["no-image"]);
  });

  it("flags pieces larger than the plate, allowing rotation", () => {
    expect(ids(input({ widthMm: 400, heightMm: 100 }))).toContain("exceeds-bed");
    expect(ids(input({ widthMm: 300, heightMm: 340 }))).not.toContain("exceeds-bed");
  });

  it("warns when the piece leaves no room for a wipe tower", () => {
    expect(ids(input({ widthMm: 345, heightMm: 100 }))).toEqual(["tight-bed"]);
  });

  it("counts the outline and a top loop in the footprint", () => {
    expect(footprintMm(input({ outlineEnabled: true, outlineWidthMm: 2, loopEnabled: true }))).toEqual({ width: 104, height: 90 });
    expect(footprintMm(input({ loopEnabled: true, loopPositionPreset: "left-center" }))).toEqual({ width: 106, height: 80 });
  });

  it("checks tiles instead of the whole piece in large format", () => {
    expect(ids(input({ widthMm: 900, heightMm: 600, largeFormatEnabled: true }))).toEqual([]);
    expect(ids(input({ widthMm: 900, heightMm: 600, largeFormatEnabled: true, tileWidthMm: 400, tileHeightMm: 400 }))).toContain("tile-exceeds-bed");
  });

  it("mirrors combinations the backend rejects", () => {
    expect(ids(input({ modelSurfaceEnabled: true, largeFormatEnabled: true }))).toContain("surface-large-format");
    expect(ids(input({ reliefEnabled: true, backingInfillPercent: 40 }))).toContain("relief-infill");
    expect(ids(input({ separateBackingProject: true, singleSided: false }))).toContain("separate-backing");
  });

  it("warns about thin keychain loops", () => {
    expect(ids(input({ loopEnabled: true, loopWidthMm: 5, loopHoleMm: 3.5 }))).toContain("ring-wall");
    expect(ids(input({ loopEnabled: true, loopWidthMm: 8, loopHoleMm: 3 }))).not.toContain("ring-wall");
  });

  it("explains the automatic magnet backing and flags pockets near the edge", () => {
    const magnets = [magnet({ thickness_mm: 3 }), magnet({ id: "m2", center_x_mm: 46 })];
    const backingMm = resolveFridgeMagnetSpacerThick(1.2, true, magnets);
    const issues = runPreflight(input({ magnetsEnabled: true, magnets, baseBackingMm: 1.2, backingMm }));
    expect(issues.map((issue) => issue.id)).toEqual(["magnet-backing", "magnet-edge"]);
    expect(issues[0].params).toEqual({ from: 1.2, to: 3.44 });
    expect(issues[1].params?.count).toBe(1);
  });

  it("says nothing about the backing when it is already thick enough", () => {
    const magnets = [magnet({ thickness_mm: 2 })];
    expect(ids(input({ magnetsEnabled: true, magnets, baseBackingMm: 3, backingMm: resolveFridgeMagnetSpacerThick(3, true, magnets) }))).toEqual([]);
  });
});

describe("magnet backing rule", () => {
  it("matches the generation validator: ceil((deepest + 0.4) / 0.08) * 0.08", () => {
    // Values computed with api/schemas/converter.py's formula.
    const cases: Array<[number, number]> = [[2, 2.4], [2.02, 2.48], [2.1, 2.56], [3, 3.44], [0.1, 0.56]];
    for (const [thickness, expected] of cases) {
      expect(resolveFridgeMagnetSpacerThick(0.2, true, [magnet({ thickness_mm: thickness })])).toBeCloseTo(expected, 9);
    }
    expect(resolveFridgeMagnetSpacerThick(1.2, false, [magnet({ thickness_mm: 3 })])).toBe(1.2);
  });
});

describe("formatPreflightMessage", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(formatPreflightMessage("{size} on {bed} {x}", { size: "10×10", bed: "A1" })).toBe("10×10 on A1 {x}");
  });
});
