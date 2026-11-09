import { describe, expect, it } from "vitest";
import { isEditableTarget, isProjectFile, namePastedImage } from "../useStudioInput";

describe("studio input helpers", () => {
  it("treats text fields as editable but not checkboxes or buttons", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableTarget(text)).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
  });

  it("recognises project files", () => {
    expect(isProjectFile(new File([], "Cat.LUM"))).toBe(true);
    expect(isProjectFile(new File([], "cat.png"))).toBe(false);
  });

  it("names pasted images with a timestamp", () => {
    const pasted = namePastedImage(new File(["x"], "image.png", { type: "image/png" }), new Date(2026, 10, 9, 8, 5, 3));
    expect(pasted.name).toBe("pasted-20261109-080503.png");
    expect(pasted.type).toBe("image/png");
    expect(namePastedImage(new File(["x"], "a", { type: "image/jpeg" }), new Date(2026, 0, 1)).name.endsWith(".jpg")).toBe(true);
  });
});

import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useStudioInput } from "../useStudioInput";

describe("studio keyboard shortcuts", () => {
  it("opens the palette with Ctrl+K but not during IME composition", () => {
    const openPalette = vi.fn();
    const { unmount } = renderHook(() => useStudioInput({ openPalette, openShortcuts: vi.fn() }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, isComposing: true }));
    expect(openPalette).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(openPalette).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(openPalette).toHaveBeenCalledTimes(1);
  });

  it("leaves the shortcuts sheet to text fields", () => {
    const openShortcuts = vi.fn();
    const { unmount } = renderHook(() => useStudioInput({ openPalette: vi.fn(), openShortcuts }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    expect(openShortcuts).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    expect(openShortcuts).toHaveBeenCalledTimes(1);
    input.remove();
    unmount();
  });
});
