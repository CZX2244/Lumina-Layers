import { describe, expect, it } from "vitest";
import { findPrintedBounds, PRINTED_ALPHA_THRESHOLD, trimTransparentMargins } from "../trimTransparentMargins";

/** RGBA buffer with the given alpha per pixel (row-major). */
function rgba(width: number, height: number, alphaAt: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = alphaAt(x, y);
  }
  return data;
}

describe("findPrintedBounds", () => {
  it("uses the backend threshold: alpha below 10 is not printed", () => {
    expect(PRINTED_ALPHA_THRESHOLD).toBe(10);
    const data = rgba(6, 4, (x, y) => (x === 2 && y === 1 ? 10 : x === 4 && y === 2 ? 9 : 0));
    expect(findPrintedBounds(data, 6, 4)).toEqual({ x: 2, y: 1, width: 1, height: 1 });
  });

  it("covers every printed pixel including soft edges", () => {
    const data = rgba(10, 8, (x, y) => (x >= 3 && x <= 6 && y >= 2 && y <= 5 ? 255 : x === 2 && y === 3 ? 40 : 0));
    expect(findPrintedBounds(data, 10, 8)).toEqual({ x: 2, y: 2, width: 5, height: 4 });
  });

  it("returns the full image when nothing is transparent", () => {
    expect(findPrintedBounds(rgba(5, 3, () => 255), 5, 3)).toEqual({ x: 0, y: 0, width: 5, height: 3 });
  });

  it("returns null for a fully transparent image", () => {
    expect(findPrintedBounds(rgba(4, 4, () => 0), 4, 4)).toBeNull();
  });
});

describe("trimTransparentMargins", () => {
  it("leaves formats that cannot be transparent untouched without decoding them", async () => {
    const jpeg = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await expect(trimTransparentMargins(jpeg)).resolves.toEqual({ file: jpeg, trim: null });
    await expect(trimTransparentMargins(svg)).resolves.toEqual({ file: svg, trim: null });
  });
});
