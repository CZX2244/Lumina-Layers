/**
 * When the toolbar may say "unsaved changes".
 *
 * A fresh start with no user action is not unsaved, even though loading
 * settings invalidates generated files on every workflow. Real edits are.
 * After saving, only a save that really wrote the file clears the mark; edits
 * made while the file was being written keep it, and a cancelled or failed
 * save, or a browser download the app cannot confirm, never clears it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../project/files", async () => ({
  ...await vi.importActual<typeof import("../project/files")>("../project/files"),
  prepareProjectSave: vi.fn().mockResolvedValue(undefined),
  saveProjectFile: vi.fn(), listProjectFiles: vi.fn().mockResolvedValue([]),
}));
vi.mock("../project/thumbnail", () => ({ attachProjectThumbnail: vi.fn() }));
vi.mock("../project/recoveryStore", () => ({
  saveRecoverySnapshot: vi.fn().mockResolvedValue(undefined),
  listRecoverySnapshots: vi.fn().mockResolvedValue([]), removeRecoverySnapshot: vi.fn(),
}));
import { converterDocumentHistory as history, DEFAULT_STATE, useConverterStore as converter } from "../stores/converter";
import { useCalibrationStore as calibration } from "../stores/calibrationStore";
import { invalidateGeneratedArtifacts } from "../stores/generatedArtifactInvalidation";
import { useProjectSessionStore as session } from "../stores/projectSessionStore";
import { newProject, saveCurrentProject, startProjectTracking, useProjectUi } from "../project/controller";
import { projectAdapterRegistry } from "../project/adapters/registry";
import { prepareProjectSave, saveProjectFile, type ProjectFileEntry } from "../project/files";
import type { ProjectSnapshot } from "../project/types";

const savedEntry = (snapshot: ProjectSnapshot): ProjectFileEntry => ({
  fileEntryId: "file", name: snapshot.manifest.name, projectId: snapshot.manifest.projectId,
  revisionId: snapshot.manifest.revisionId, workflowKinds: ["converter"], modifiedAt: snapshot.manifest.modifiedAt,
  lastOpenedAt: snapshot.manifest.modifiedAt, pinned: false,
});

let stop: () => void = () => {};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(projectAdapterRegistry, "capture").mockImplementation(async kind => ({ document: {
    documentId: `${kind}.main`, kind, schemaVersion: 2, payload: { width: converter.getState().target_width_mm },
    inputRevisionIds: [], resourceRefs: [], requiredCapabilities: [],
  }, assets: [] }));
});
afterEach(() => { stop(); vi.restoreAllMocks(); });

// These run first and in order: a fresh start has touched no workflow yet.
describe("a fresh start", () => {
  beforeEach(() => {
    converter.setState({ ...DEFAULT_STATE });
    calibration.setState(calibration.getInitialState());
    session.getState().reset();
    stop = startProjectTracking();
  });

  it("is not unsaved when loading settings invalidates generated files", () => {
    invalidateGeneratedArtifacts({ source: "defaults" });
    invalidateGeneratedArtifacts({ preservePreviews: true, source: "defaults" });
    invalidateGeneratedArtifacts({ preservePreviews: true });

    expect(session.getState().dirty).toBe(false);
  });

  it("is unsaved once a real calibration result is cleared by a printer change", () => {
    stop();
    calibration.setState({ downloadUrl: "/api/files/card", warnings: ["check the plate"] });
    stop = startProjectTracking();

    invalidateGeneratedArtifacts({ preservePreviews: true });

    expect(calibration.getState().downloadUrl).toBeNull();
    expect(session.getState().dirty).toBe(true);
  });

  it("is unsaved after importing an image", () => {
    converter.getState().setImageFile(new File(["art"], "art.png", { type: "image/png" }));
    expect(session.getState().dirty).toBe(true);
  });

  it("is unsaved after changing a setting in another workflow", () => {
    calibration.setState({ block_size: calibration.getState().block_size + 1 });
    expect(session.getState().dirty).toBe(true);
  });
});

describe("saving", () => {
  beforeEach(() => {
    converter.setState({ ...DEFAULT_STATE });
    newProject("converter", "Saved");
    converter.setState({ imageFile: new File(["art"], "art.png"), target_width_mm: 100, target_height_mm: 100 });
    history.reset();
    vi.mocked(prepareProjectSave).mockResolvedValue(undefined);
    vi.mocked(saveProjectFile).mockImplementation(async snapshot => ({ persisted: true, entry: savedEntry(snapshot) }));
    stop = startProjectTracking();
    converter.getState().setTargetWidthMm(120);
    expect(session.getState().dirty).toBe(true);
  });

  it("clears the mark after a save that wrote the file, with no later edit", async () => {
    expect(await saveCurrentProject()).toBe(true);
    expect(session.getState().dirty).toBe(false);
    expect(useProjectUi.getState().notice).toBe("project_saved");
  });

  it("keeps the mark for an edit made while the file was being written", async () => {
    vi.mocked(saveProjectFile).mockImplementationOnce(async snapshot => {
      converter.getState().setTargetWidthMm(140);
      return { persisted: true, entry: savedEntry(snapshot) };
    });

    expect(await saveCurrentProject()).toBe(false);
    expect(session.getState().dirty).toBe(true);
    expect(useProjectUi.getState().notice).toBe("project_saved_earlier");
  });

  it("keeps the mark when the save dialog is cancelled", async () => {
    vi.mocked(prepareProjectSave).mockResolvedValueOnce(null);
    expect(await saveCurrentProject()).toBe(false);
    expect(saveProjectFile).not.toHaveBeenCalled();
    expect(session.getState().dirty).toBe(true);
  });

  it("keeps the mark when the native save is cancelled", async () => {
    vi.mocked(saveProjectFile).mockResolvedValueOnce(null);
    expect(await saveCurrentProject()).toBe(false);
    expect(session.getState().dirty).toBe(true);
  });

  it("keeps the mark when writing fails", async () => {
    vi.mocked(saveProjectFile).mockRejectedValueOnce(new Error("disk full"));
    await expect(saveCurrentProject()).rejects.toThrow("disk full");
    expect(session.getState().dirty).toBe(true);
  });

  it("keeps the mark when the browser only downloaded a copy", async () => {
    vi.mocked(saveProjectFile).mockImplementationOnce(async snapshot => ({ persisted: false, entry: savedEntry(snapshot) }));
    expect(await saveCurrentProject()).toBe(false);
    expect(session.getState().dirty).toBe(true);
    expect(useProjectUi.getState().notice).toBe("project_downloaded");
  });
});
