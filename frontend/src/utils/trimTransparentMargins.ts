/**
 * Remove fully transparent margins from a newly imported raster image so the
 * requested width/height describe the printed content, not empty canvas.
 * Pixels with alpha below 10 are treated as empty — the same threshold the
 * backend uses to skip pixels (core/image_processing.py).
 * 去掉新导入光栅图四周完全透明的边，让设定的宽高对应实际打印内容；
 * 阈值与后端判定“不打印”一致（alpha < 10）。
 */

export const PRINTED_ALPHA_THRESHOLD = 10;

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrimInfo {
  fromWidth: number;
  fromHeight: number;
  toWidth: number;
  toHeight: number;
}

export interface TrimResult {
  file: File;
  trim: TrimInfo | null;
}

/** Bounds of pixels with alpha >= threshold in RGBA data, or null when nothing is printed. */
export function findPrintedBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number = PRINTED_ALPHA_THRESHOLD,
): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Formats that can carry transparency and that the browser can decode. */
function mayHaveTransparency(file: File): boolean {
  const name = file.name.toLowerCase();
  if (/\.svg$/.test(name) || file.type === "image/svg+xml") return false;
  return /\.(png|webp|gif|tiff?|avif)$/.test(name) || ["image/png", "image/webp", "image/gif", "image/tiff", "image/avif"].includes(file.type);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
  });
}

/**
 * Trim transparent margins. Returns the original file (trim: null) when the
 * format cannot be transparent, the browser cannot decode it, nothing is
 * printed, or there is no margin to remove.
 */
export async function trimTransparentMargins(file: File): Promise<TrimResult> {
  if (!mayHaveTransparency(file) || typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { file, trim: null };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, trim: null };
  }
  try {
    const { width, height } = bitmap;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { file, trim: null };
    context.drawImage(bitmap, 0, 0);
    const bounds = findPrintedBounds(context.getImageData(0, 0, width, height).data, width, height);
    if (!bounds || (bounds.width === width && bounds.height === height)) return { file, trim: null };

    const output = document.createElement("canvas");
    output.width = bounds.width;
    output.height = bounds.height;
    const outputContext = output.getContext("2d");
    if (!outputContext) return { file, trim: null };
    outputContext.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    const blob = await canvasToPng(output);
    const stem = file.name.replace(/\.[^.]+$/, "") || "image";
    const trimmed = new File([blob], `${stem}.png`, { type: "image/png", lastModified: file.lastModified });
    return { file: trimmed, trim: { fromWidth: width, fromHeight: height, toWidth: bounds.width, toHeight: bounds.height } };
  } catch {
    return { file, trim: null };
  } finally {
    bitmap.close();
  }
}
