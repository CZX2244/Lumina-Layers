/**
 * The home "use a built-in LUT" button waits for the catalogue long enough
 * for a brand-new data folder (the first scan took about 8 s) and stops
 * waiting if the user does something else.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const clickWhenReady = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../commands", async () => ({
  ...await vi.importActual<typeof import("../commands")>("../commands"),
  clickStudioControlWhenReady: clickWhenReady,
  goToWorkbenchStep: vi.fn(),
}));
vi.mock("../../api/extractor", () => ({ listGradientCardMaterials: vi.fn(() => new Promise(() => {})) }));
vi.mock("../templates/ProductTemplates", () => ({ ProductTemplates: () => null }));
vi.mock("../../project/controller", async () => ({
  ...await vi.importActual<typeof import("../../project/controller")>("../../project/controller"),
  refreshProjects: vi.fn(async () => undefined),
}));

import { I18nProvider } from "../../i18n/context";
import { DEFAULT_STATE, useConverterStore } from "../../stores/converter";
import { useSlicerStore } from "../../stores/slicerStore";
import { useStudioPrefsStore } from "../studioPrefsStore";
import { HomeView } from "../HomeView";

beforeEach(() => {
  clickWhenReady.mockClear();
  useConverterStore.setState({ ...DEFAULT_STATE, source_version: "legacy", lut_name: "", lut_names: [], lutList: [] });
  useSlicerStore.setState({ slicers: [{ id: "bambu" }] as never, isDetecting: false });
  useStudioPrefsStore.setState({ checklistDismissed: false });
});

it("opens the built-in LUT picker once the catalogue is ready, waiting up to 60 s", () => {
  render(<I18nProvider><HomeView /></I18nProvider>);

  fireEvent.click(screen.getByTestId("studio-path-builtin"));

  expect(clickWhenReady).toHaveBeenCalledWith('[data-testid="lut-picker-trigger"]', { timeoutMs: 60000, cancelOnUserInput: true });
});
