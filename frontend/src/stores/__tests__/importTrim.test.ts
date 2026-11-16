/**
 * Transparent-margin trimming applies to normal image conversion only.
 * Model texturing keeps the original canvas; the original upload stays
 * available and project restore never trims.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trimMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/trimTransparentMargins", () => ({ trimTransparentMargins: trimMock }));
vi.mock("../../api/system", () => ({
  uploadImagePreview: vi.fn(),
}));
const cropMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/converter", async () => ({
  ...await vi.importActual<typeof import("../../api/converter")>("../../api/converter"),
  cropImage: cropMock,
}));
vi.mock("../../api/client", async () => ({
  ...await vi.importActual<typeof import("../../api/client")>("../../api/client"),
  downloadResourceBlob: vi.fn(async () => new Blob(["cropped"], { type: "image/png" })),
}));

import { DEFAULT_STATE, useConverterStore } from "../converter";
import { resolveSourceFile } from "../../utils/sourceFileOrigins";

const original = new File(["original"], "logo.png", { type: "image/png" });
const trimmed = new File(["trimmed"], "logo.png", { type: "image/png" });
const trimInfo = { fromWidth: 400, fromHeight: 400, toWidth: 201, toHeight: 201 };

beforeEach(() => {
  useConverterStore.setState({ ...DEFAULT_STATE, enableCrop: false });
  trimMock.mockReset();
  trimMock.mockImplementation(async (file: File) => (file === original ? { file: trimmed, trim: trimInfo } : { file, trim: null }));
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("normal image import", () => {
  it("uses the trimmed image, records the trim and keeps the original behind it", async () => {
    await useConverterStore.getState().importImageFiles([original]);

    const state = useConverterStore.getState();
    expect(trimMock).toHaveBeenCalledWith(original);
    expect(state.imageFile).toBe(trimmed);
    expect(state.importTrim).toMatchObject({ kind: "trimmed", file: trimmed, original, ...trimInfo });
    expect(resolveSourceFile(trimmed)).toBe(original);
  });

  it("restores the untrimmed original on request", async () => {
    await useConverterStore.getState().importImageFiles([original]);

    useConverterStore.getState().restoreUntrimmedImage();

    expect(useConverterStore.getState().imageFile).toBe(original);
    expect(useConverterStore.getState().importTrim).toBeNull();
    expect(useConverterStore.getState().cropModalOpen).toBe(false);
  });

  it("replacing the current image goes through the same trim", async () => {
    await useConverterStore.getState().replaceImageFile(original);
    expect(useConverterStore.getState().imageFile).toBe(trimmed);
  });

  it("records nothing when the image has no margin to remove", async () => {
    const opaque = new File(["opaque"], "opaque.png", { type: "image/png" });
    await useConverterStore.getState().importImageFiles([opaque]);
    expect(useConverterStore.getState().imageFile).toBe(opaque);
    expect(useConverterStore.getState().importTrim).toBeNull();
  });
});

describe("model texturing keeps the original canvas", () => {
  it("does not trim while model texturing is on", async () => {
    useConverterStore.setState({ modelSurfaceEnabled: true });

    await useConverterStore.getState().importImageFiles([original]);
    await useConverterStore.getState().replaceImageFile(original);

    expect(trimMock).not.toHaveBeenCalled();
    expect(useConverterStore.getState().imageFile).toBe(original);
  });

  it("switches back to the original when texturing is turned on, without touching the placement", async () => {
    await useConverterStore.getState().importImageFiles([original]);
    const placement = { mode: "fit", offset_x_mm: 3, offset_y_mm: -2, scale: 1.4, rotation_deg: 15, inset_mm: 0.5 };
    useConverterStore.setState({ modelSurfacePlacement: placement as never });

    useConverterStore.getState().setModelSurfaceEnabled(true);

    const state = useConverterStore.getState();
    expect(state.modelSurfaceEnabled).toBe(true);
    expect(state.imageFile).toBe(original);
    expect(state.modelSurfacePlacement).toEqual(placement);
    expect(state.importTrim).toMatchObject({ kind: "restored-for-surface", file: original });
  });

  it("keeps a trimmed image that was edited afterwards", async () => {
    await useConverterStore.getState().importImageFiles([original]);
    const cropped = new File(["cropped"], "logo_cropped.png", { type: "image/png" });
    useConverterStore.getState().setImageFile(cropped);

    useConverterStore.getState().setModelSurfaceEnabled(true);

    expect(useConverterStore.getState().imageFile).toBe(cropped);
  });
});

describe("crop after upload", () => {
  beforeEach(() => {
    cropMock.mockReset();
    cropMock.mockImplementation(async (_file: File, _x: number, _y: number, width: number, height: number) => ({ cropped_url: "/api/files/c", width, height }));
  });

  it("keeps the trim when the crop dialog is applied unchanged", async () => {
    await useConverterStore.getState().importImageFiles([original]);
    await useConverterStore.getState().submitCrop(0, 0, trimInfo.toWidth, trimInfo.toHeight, 0);

    const state = useConverterStore.getState();
    expect(state.imageFile).not.toBe(trimmed);
    expect(state.importTrim).toMatchObject({ kind: "trimmed", file: state.imageFile, original });

    state.setModelSurfaceEnabled(true);
    expect(useConverterStore.getState().imageFile).toBe(original);
  });

  it("ends the trim record after a real crop, and texturing keeps the cropped image", async () => {
    await useConverterStore.getState().importImageFiles([original]);
    await useConverterStore.getState().submitCrop(10, 0, 120, trimInfo.toHeight, 0);

    const cropped = useConverterStore.getState().imageFile;
    expect(useConverterStore.getState().importTrim).toBeNull();
    useConverterStore.getState().setModelSurfaceEnabled(true);
    expect(useConverterStore.getState().imageFile).toBe(cropped);
  });

  it("ends the trim record after a rotation", async () => {
    await useConverterStore.getState().importImageFiles([original]);
    useConverterStore.setState({ imagePreviewUrl: null });
    await useConverterStore.getState().submitCrop(0, 0, trimInfo.toWidth, trimInfo.toHeight, 90);
    expect(useConverterStore.getState().importTrim).toBeNull();
  });
});

describe("project restore", () => {
  it("never trims a restored image", () => {
    useConverterStore.getState().importRecipeState({}, original);
    expect(trimMock).not.toHaveBeenCalled();
    expect(useConverterStore.getState().imageFile).toBe(original);
  });
});
