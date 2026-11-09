/**
 * Renderer side of the Lumina Studio Plus desktop helpers (Electron only;
 * every call is a no-op in a browser).
 * 个人增强版桌面辅助的渲染端（仅 Electron；浏览器中均为空操作）。
 */
import { useEffect, useRef, useState } from "react";
import { useConverterStore } from "../stores/converter";
import { useSettingsStore } from "../stores/settingsStore";
import { useStudioPrefsStore } from "./studioPrefsStore";

export type UpdateCheckResult =
  | { status: "available"; tag: string; url: string }
  | { status: "current" | "none" | "unknown" | "error" };

export interface PlusDesktopBridge {
  openDataFolder: (kind: "feedback" | "logs" | "data") => Promise<boolean>;
  setTitlebarPalette?: (palette: "studio" | "classic") => void;
  checkUpdate: () => Promise<UpdateCheckResult | null>;
  openRelease: (url: string) => Promise<boolean>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  setDownloadNaming: (template: string, context: { size?: string; printer?: string }) => void;
  setTaskbarProgress: (state: "none" | "indeterminate" | "attention" | number) => void;
  onDownloadDone: (listener: (payload: { path: string; name: string }) => void) => () => void;
}

export function plusDesktop(): PlusDesktopBridge | null {
  const api = (window as unknown as { electronAPI?: { plus?: PlusDesktopBridge } }).electronAPI;
  return api?.plus ?? null;
}

export const DEFAULT_DOWNLOAD_TEMPLATE = "{name}";

export interface SavedFileNotice {
  path: string;
  name: string;
}

/**
 * Keeps the desktop host in sync (naming template, taskbar progress) and
 * returns the latest completed download for the "Show in Explorer" toast.
 * 同步桌面宿主状态并返回最近完成的下载，用于“在资源管理器中显示”提示。
 */
export function useDesktopIntegration(): { notice: SavedFileNotice | null; dismiss: () => void; reveal: () => void } {
  const [notice, setNotice] = useState<SavedFileNotice | null>(null);
  const template = useStudioPrefsStore((state) => state.downloadNameTemplate);
  const width = useConverterStore((state) => Math.round(state.target_width_mm));
  const height = useConverterStore((state) => Math.round(state.target_height_mm));
  const printer = useSettingsStore((state) => state.printerModel);
  const busy = useConverterStore((state) => state.isLoading || state.isGenerating || state.batchLoading);
  const wasBusy = useRef(false);

  useEffect(() => {
    plusDesktop()?.setDownloadNaming(template, { size: `${width}x${height}mm`, printer });
  }, [template, width, height, printer]);

  useEffect(() => {
    const bridge = plusDesktop();
    if (!bridge) return;
    if (busy) bridge.setTaskbarProgress("indeterminate");
    else {
      bridge.setTaskbarProgress("none");
      if (wasBusy.current) bridge.setTaskbarProgress("attention");
    }
    wasBusy.current = busy;
  }, [busy]);

  useEffect(() => {
    const bridge = plusDesktop();
    if (!bridge) return;
    return bridge.onDownloadDone((payload) => setNotice(payload));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 12000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return {
    notice,
    dismiss: () => setNotice(null),
    reveal: () => {
      if (notice) void plusDesktop()?.showItemInFolder(notice.path);
      setNotice(null);
    },
  };
}
