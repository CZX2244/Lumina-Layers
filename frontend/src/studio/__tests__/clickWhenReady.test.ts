/**
 * The home "use a built-in LUT" button opens the picker once the catalogue
 * has loaded, even when that takes longer than 8 s on a brand-new data
 * folder, and does not pop it up later if the user has moved on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clickStudioControlWhenReady } from "../commands";

let trigger: HTMLButtonElement;
let clicks: number;

beforeEach(() => {
  vi.useFakeTimers();
  clicks = 0;
  trigger = document.createElement("button");
  trigger.dataset.testid = "lut-picker-trigger";
  trigger.disabled = true;
  trigger.addEventListener("click", () => { clicks += 1; });
  document.body.appendChild(trigger);
});

afterEach(() => {
  trigger.remove();
  vi.useRealTimers();
});

const selector = '[data-testid="lut-picker-trigger"]';

describe("clickStudioControlWhenReady", () => {
  it("still clicks a picker whose catalogue takes more than 8 s to load", async () => {
    const result = clickStudioControlWhenReady(selector, { timeoutMs: 60000, cancelOnUserInput: true });
    await vi.advanceTimersByTimeAsync(8500);
    expect(clicks).toBe(0);
    trigger.disabled = false;
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toBe(true);
    expect(clicks).toBe(1);
  });

  it("gives up when the user presses a key or clicks elsewhere first", async () => {
    for (const event of [new KeyboardEvent("keydown", { key: "a" }), new Event("pointerdown")]) {
      const result = clickStudioControlWhenReady(selector, { timeoutMs: 60000, cancelOnUserInput: true });
      await vi.advanceTimersByTimeAsync(1000);
      window.dispatchEvent(event);
      trigger.disabled = false;
      await vi.advanceTimersByTimeAsync(200);
      await expect(result).resolves.toBe(false);
      trigger.disabled = true;
    }
    expect(clicks).toBe(0);
  });

  it("gives up quietly when the picker never becomes available", async () => {
    const result = clickStudioControlWhenReady(selector, { timeoutMs: 60000, cancelOnUserInput: true });
    await vi.advanceTimersByTimeAsync(61000);
    await expect(result).resolves.toBe(false);
    trigger.disabled = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(clicks).toBe(0);
  });

  it("keeps the short default for other callers", async () => {
    const result = clickStudioControlWhenReady(selector);
    await vi.advanceTimersByTimeAsync(8500);
    await expect(result).resolves.toBe(false);
  });
});
