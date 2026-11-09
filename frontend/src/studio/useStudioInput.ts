/**
 * Keyboard shortcuts, clipboard paste and file drops for the studio shell.
 * 新版工作台的快捷键、剪贴板粘贴和文件拖放。
 */
import { useEffect } from "react";
import { isValidImageType, useConverterStore } from "../stores/converter";
import { useWidgetStore } from "../stores/widgetStore";
import { goToWorkbenchStep, openConverterMode, runGenerateExport, runPreview } from "./commands";
import { navigateStudio } from "./navigation";
import { requestProjectCommand } from "./projectCommands";
import { useStudioPrefsStore } from "./studioPrefsStore";
import { WORKBENCH_STEPS } from "./workbenchSteps";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(type);
}

export function isProjectFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".lum");
}

/** Give clipboard images a meaningful, unique name (used for output files). */
export function namePastedImage(file: File, now: Date = new Date()): File {
  const extension = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return new File([file], `pasted-${stamp}.${extension}`, { type: file.type, lastModified: now.getTime() });
}

function openImagesInConverter(files: File[]): void {
  navigateStudio("converter");
  if (useWidgetStore.getState().activeConverterSubTab === "color") useWidgetStore.getState().setActiveConverterSubTab("core");
  useConverterStore.getState().handleFilesSelect(files);
}

/** Whether a modal dialog (other than the browser's own) currently has focus. */
function modalOpen(): boolean {
  return Boolean(document.querySelector("dialog[open]"));
}

export function useStudioInput({ openPalette, openShortcuts }: { openPalette: () => void; openShortcuts: () => void }): void {
  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal keys from an IME composition (Chinese/Japanese input).
      if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (ctrl && !event.shiftKey && !event.altKey && key === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (modalOpen() || isEditableTarget(event.target)) return;
      if (!ctrl && !event.altKey && event.key === "?") { event.preventDefault(); openShortcuts(); return; }
      if (ctrl && !event.shiftKey && !event.altKey && key === "b") { event.preventDefault(); useStudioPrefsStore.getState().toggleSidebar(); return; }
      if (ctrl && !event.shiftKey && !event.altKey && event.key === "Enter") {
        if (useWidgetStore.getState().activeTab !== "converter") return;
        event.preventDefault();
        runPreview();
        return;
      }
      if (ctrl && event.shiftKey && !event.altKey && key === "e") {
        if (useWidgetStore.getState().activeTab !== "converter") return;
        event.preventDefault();
        runGenerateExport();
        return;
      }
      if (ctrl && event.shiftKey && !event.altKey && key === "c") {
        event.preventDefault();
        const widgets = useWidgetStore.getState();
        openConverterMode(widgets.activeTab === "converter" && widgets.activeConverterSubTab === "color" ? "core" : "color");
        return;
      }
      if (event.altKey && !ctrl && !event.shiftKey && /^[1-9]$/.test(event.key)) {
        const step = WORKBENCH_STEPS[Number(event.key) - 1];
        if (!step) return;
        event.preventDefault();
        goToWorkbenchStep(step.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette, openShortcuts]);

  // ── Clipboard paste: images open in the converter ──
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || modalOpen()) return;
      const view = useStudioPrefsStore.getState().view;
      const tab = useWidgetStore.getState().activeTab;
      if (view !== "home" && tab !== "converter") return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => isValidImageType(file.type, file.name));
      if (!files.length) return;
      event.preventDefault();
      openImagesInConverter([namePastedImage(files[0])]);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // ── File drops: .lum anywhere, images on the home page ──
  useEffect(() => {
    const draggingFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onDragOver = (event: DragEvent) => {
      // Never let a dropped file navigate the desktop window away from the app.
      if (draggingFiles(event) && !event.defaultPrevented) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented) return;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      const project = files.find(isProjectFile);
      if (project) {
        requestProjectCommand({ action: "openFile", file: project });
        return;
      }
      if (useStudioPrefsStore.getState().view !== "home") return;
      const images = files.filter((file) => isValidImageType(file.type, file.name));
      if (images.length) openImagesInConverter(images);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}

export { openImagesInConverter };
