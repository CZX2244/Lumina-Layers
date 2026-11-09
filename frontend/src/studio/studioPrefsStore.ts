/**
 * Studio shell preferences (personal build).
 * 新版工作台外壳偏好（个人增强版）。
 *
 * Kept in its own small persisted store so the upstream settings contract,
 * backend settings sync and share-card format stay untouched.
 * 独立持久化，不改动上游设置契约、后端同步和分享卡格式。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useWidgetStore } from "../stores/widgetStore";
import type { TabId } from "../types/widget";

/** Cloud library pages are disabled in the personal build; mirrors navigation.ts. */
export const CLOUD_TAB_FALLBACK: Partial<Record<TabId, TabId>> = {
  "material-cloud-sync": "material-library",
  "lut-cloud-sync": "lut-library",
};

export type UiShell = "studio" | "classic";
export type StudioView = "home" | "app";

/** Tests keep the classic shell so upstream DOM-level suites stay valid. */
const DEFAULT_SHELL: UiShell = import.meta.env.MODE === "test" ? "classic" : "studio";

interface StudioPrefsState {
  shell: UiShell;
  view: StudioView;
  sidebarCollapsed: boolean;
  /** First-run checklist on the home page was dismissed. 首页首启清单已关闭。 */
  checklistDismissed: boolean;
  /** Desktop download file-name template; must contain {name}. 下载文件名模板。 */
  downloadNameTemplate: string;
  setShell: (shell: UiShell) => void;
  showHome: () => void;
  showApp: () => void;
  toggleSidebar: () => void;
  dismissChecklist: () => void;
  restoreChecklist: () => void;
  setDownloadNameTemplate: (template: string) => void;
}

export const useStudioPrefsStore = create<StudioPrefsState>()(
  persist(
    (set) => ({
      shell: DEFAULT_SHELL,
      view: "home",
      sidebarCollapsed: false,
      checklistDismissed: false,
      downloadNameTemplate: "{name}",
      setShell: (shell) => set({ shell }),
      showHome: () => set({ view: "home" }),
      showApp: () => set({ view: "app" }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      dismissChecklist: () => set({ checklistDismissed: true }),
      restoreChecklist: () => set({ checklistDismissed: false }),
      setDownloadNameTemplate: (template) => set({ downloadNameTemplate: template.includes("{name}") ? template.slice(0, 120) : "{name}" }),
    }),
    {
      name: "lumina-plus-studio",
      version: 1,
      // The app always starts on the home page; only durable choices persist.
      partialize: (state) => ({
        shell: state.shell,
        sidebarCollapsed: state.sidebarCollapsed,
        checklistDismissed: state.checklistDismissed,
        downloadNameTemplate: state.downloadNameTemplate,
      }),
    },
  ),
);

// Any navigation through the shared widget store (projects, share cards,
// tutorial, Workshop hand-off, in-page links) leaves the home page.
// 任何经由 widgetStore 的跳转（工程、分享卡、教程、工坊回传、页面内链接）都会离开首页。
useWidgetStore.subscribe(
  (state) => state.activeTab,
  (tab) => {
    const local = CLOUD_TAB_FALLBACK[tab];
    if (local) {
      useWidgetStore.getState().setActiveTab(local);
      return;
    }
    if (useStudioPrefsStore.getState().view !== "app") useStudioPrefsStore.getState().showApp();
  },
);

// A layout saved before the cloud pages were disabled may still point at one.
{
  const restored = CLOUD_TAB_FALLBACK[useWidgetStore.getState().activeTab];
  if (restored) useWidgetStore.getState().setActiveTab(restored);
}
