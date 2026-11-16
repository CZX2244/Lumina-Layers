import { describe, expect, it } from "vitest";
import { mergeImportedPresets, serializePresets, PRESET_FILE_FORMAT } from "../templates/templateRegistry";
import { captureConversionParameters, type ConversionPreset } from "../../stores/conversionPreferences";
import { useConverterStore } from "../../stores/converter";

function preset(name: string, id = name): ConversionPreset {
  return { id, name, parameters: captureConversionParameters(useConverterStore.getState()) };
}

describe("preset files", () => {
  it("round-trips through export and import", () => {
    const text = serializePresets([preset("钥匙扣 50mm")]);
    expect(JSON.parse(text).format).toBe(PRESET_FILE_FORMAT);
    let n = 0;
    const result = mergeImportedPresets([], text, () => `new-${++n}`);
    expect(result).toMatchObject({ added: 1, skipped: 0 });
    expect(result.merged[0]).toMatchObject({ id: "new-1", name: "钥匙扣 50mm" });
  });

  it("renames clashing names and gives fresh ids", () => {
    const current = [preset("A", "keep")];
    const result = mergeImportedPresets(current, serializePresets([preset("A", "keep")]), () => "fresh");
    expect(result.merged.map((entry) => [entry.id, entry.name])).toEqual([["keep", "A"], ["fresh", "A (2)"]]);
  });

  it("skips invalid entries and rejects non-preset files", () => {
    const bad = JSON.stringify({ presets: [{ name: "broken", parameters: { size_mm: 1 } }, preset("ok")] });
    expect(mergeImportedPresets([], bad, () => "x")).toMatchObject({ added: 1, skipped: 1 });
    expect(() => mergeImportedPresets([], "not json")).toThrow("invalid-json");
    expect(() => mergeImportedPresets([], JSON.stringify({ hello: 1 }))).toThrow("no-presets");
  });
});

describe("product templates", () => {
  it("large format really gets the 400 mm long edge, with tiles 20 mm inside the bed", async () => {
    const { applyProductTemplate, PRODUCT_TEMPLATES } = await import("../templates/templateRegistry");
    const template = PRODUCT_TEMPLATES.find((item) => item.id === "large-format")!;
    useConverterStore.setState({
      aspectRatio: 1,
      largeFormatEnabled: false,
      puzzleEnabled: false,
      enable_fridge_magnet: false,
      bedSizes: [{ label: "Test bed", width_mm: 350, height_mm: 320 } as never],
      bed_label: "Test bed",
    });

    applyProductTemplate(template);

    const state = useConverterStore.getState();
    expect(state.largeFormatEnabled).toBe(true);
    expect(Math.max(state.target_width_mm, state.target_height_mm ?? 0)).toBe(400);
    expect(state.tileWidthMm).toBe(330);
    expect(state.tileHeightMm).toBe(300);
  });
});
