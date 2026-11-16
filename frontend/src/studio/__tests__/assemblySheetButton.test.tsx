/**
 * The puzzle assembly button counts the pieces the backend actually laid out
 * and never offers a "(0 parts)" sheet before a puzzle preview exists.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n/context";
import { DEFAULT_STATE, useConverterStore } from "../../stores/converter";
import { useSettingsStore } from "../../stores/settingsStore";
import { AssemblySheetButton } from "../assembly/AssemblySheetButton";

function renderButton() {
  return render(
    <I18nProvider>
      <AssemblySheetButton />
    </I18nProvider>,
  );
}

beforeEach(() => {
  useSettingsStore.setState({ language: "zh" });
  useConverterStore.setState({
    ...DEFAULT_STATE,
    puzzleEnabled: true,
    target_width_mm: 90,
    target_height_mm: 60,
    previewImageUrl: "/api/files/preview",
  });
});

describe("puzzle assembly button", () => {
  it("asks for a puzzle preview instead of offering zero parts", () => {
    useConverterStore.setState({ puzzleResolvedRows: 2, puzzleResolvedCols: 3, puzzlePieces: null });
    renderButton();

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.textContent).toBe("保存装配参考图");
    expect(screen.getByTestId("studio-assembly").textContent).toContain("先生成拼图预览");
  });

  it("counts the reported pieces, not rows × columns", () => {
    useConverterStore.setState({
      puzzleResolvedRows: 2,
      puzzleResolvedCols: 3,
      puzzlePieces: [
        { label: "A1", bbox_mm: [0, 0, 30, 30], centroid_mm: [15, 15] },
        { label: "A2", bbox_mm: [30, 0, 60, 30], centroid_mm: [45, 15] },
        { label: "B1", bbox_mm: [0, 30, 30, 60], centroid_mm: [15, 45] },
      ],
    });
    renderButton();

    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(button.textContent).toBe("保存装配参考图（3 块）");
  });
});
