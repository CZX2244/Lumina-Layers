/**
 * Lumina Studio Plus shell: title bar, task-grouped sidebar, page header with
 * project actions, page content and a status bar.
 * 个人增强版外壳：标题栏、按任务分组的侧栏、带工程操作的页头、页面内容和状态栏。
 */
import { Suspense, useCallback, useMemo, useState, type CSSProperties } from "react";
import { Bars3Icon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/context";
import { useWidgetStore } from "../stores/widgetStore";
import { useConverterStore } from "../stores/converter";
import { useSettingsStore } from "../stores/settingsStore";
import { electronAPI } from "../integrations/electron";
import { HeaderMenu } from "../components/HeaderMenu";
import ProjectWorkspace from "../components/projects/ProjectWorkspace";
import LoadingSpinner from "../components/LoadingSpinner";
import ExtractorCanvas from "../components/ExtractorCanvas";
import CalibrationPanel from "../components/CalibrationPanel";
import ExtractorPanel from "../components/ExtractorPanel";
import GradientCardGeneratePanel from "../components/GradientCardGeneratePanel";
import GradientCardExtractPanel from "../components/GradientCardExtractPanel";
import MaterialCloudSyncPanel from "../components/MaterialCloudSyncPanel";
import MaterialLibraryPanel from "../components/MaterialLibraryPanel";
import MaterialRecipeQueryPanel from "../components/MaterialRecipeQueryPanel";
import LutCloudSyncPanel from "../components/LutCloudSyncPanel";
import LutLibraryPanel from "../components/LutLibraryPanel";
import LutComparePanel from "../components/LutComparePanel";
import LutManagerPanel from "../components/LutManagerPanel";
import LutDetailsPanel from "../components/LutDetailsPanel";
import FiveColorQueryPanel from "../components/FiveColorQueryPanel";
import SettingsPanel from "../components/SettingsPanel";
import VectorizerPanel from "../components/VectorizerPanel";
import WorkshopPanel from "../workshop/WorkshopPanel";
import { useWorkshopProjectRuntime } from "../project/workshopRuntime";
import { StudioSidebar } from "./StudioSidebar";
import { HomeView } from "./HomeView";
import { ConverterWorkbench } from "./ConverterWorkbench";
import { CommandPalette, ShortcutsDialog } from "./CommandPalette";
import { buildStudioCommands } from "./commands";
import { findNavItem, navigateStudio, sectionTabsOf } from "./navigation";
import { useStudioPrefsStore } from "./studioPrefsStore";
import { useStudioInput } from "./useStudioInput";
import { useDesktopIntegration } from "./desktop";
import { PlusSettings } from "./settings/PlusSettings";

export interface StudioShellProps {
  backendStatus: "checking" | "ok" | "fail";
  reproTicketId: string | null;
  onReportBug: () => void;
  onOpenAbout: () => void;
  /** An app-level overlay (About) covers the shell; pause the 3D scene. */
  suspended: boolean;
  inert: boolean;
}

function titleBarStyle(): CSSProperties | undefined {
  if (electronAPI?.platform === "darwin") return { paddingLeft: "calc(env(titlebar-area-x, 80px) + 12px)" };
  if (electronAPI?.platform === "win32") {
    return {
      paddingRight: "calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, calc(100% - 180px)) + 12px)",
      minHeight: "max(2.5rem, env(titlebar-area-height, 40px))",
    };
  }
  return undefined;
}

function SegmentedTabs({ items, active, onSelect, testIdPrefix }: {
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div role="tablist" className="flex shrink-0 rounded-lg bg-slate-300/60 p-0.5 dark:bg-slate-800">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          data-testid={`${testIdPrefix}-${item.id}`}
          onClick={() => onSelect(item.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
            item.id === active
              ? "bg-[var(--surface-panel-strong)] text-slate-900 shadow-sm dark:text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PageHeader() {
  const { t } = useI18n();
  const view = useStudioPrefsStore((state) => state.view);
  const activeTab = useWidgetStore((state) => state.activeTab);
  const subTab = useWidgetStore((state) => state.activeConverterSubTab);
  const setSubTab = useWidgetStore((state) => state.setActiveConverterSubTab);
  if (view === "home") {
    return <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t("studio.nav.home")}</h1>;
  }
  const found = findNavItem(activeTab);
  const sections = sectionTabsOf(activeTab);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        {found?.group && <span className="font-normal text-[var(--surface-text-muted)]">{t(found.group.labelKey)} / </span>}
        {found ? t(found.item.labelKey) : t(`tab.${activeTab}`)}
      </h1>
      {activeTab === "converter" && (
        <SegmentedTabs
          testIdPrefix="studio-mode"
          active={subTab === "color" ? "color" : "core"}
          onSelect={(id) => setSubTab(id === "color" ? "color" : "core")}
          items={[{ id: "core", label: t("studio.mode.preview") }, { id: "color", label: t("studio.mode.color") }]}
        />
      )}
      {sections && (
        <SegmentedTabs
          testIdPrefix="studio-section"
          active={activeTab}
          onSelect={(id) => navigateStudio(id as typeof activeTab)}
          items={sections.map((section) => ({ id: section.tab, label: t(section.labelKey) }))}
        />
      )}
    </div>
  );
}

function StatusBar({ backendStatus }: { backendStatus: StudioShellProps["backendStatus"] }) {
  const { t } = useI18n();
  const busy = useConverterStore((state) => state.isLoading || state.isGenerating || state.batchLoading);
  const bed = useConverterStore((state) => state.bed_label);
  const printer = useSettingsStore((state) => state.printerModel);
  const dot = backendStatus === "ok" ? "bg-emerald-500" : backendStatus === "checking" ? "bg-amber-400" : "bg-red-500";
  return (
    <footer data-testid="studio-statusbar" className="flex h-7 shrink-0 items-center gap-4 border-t panel-divider bg-slate-200 px-3 text-[11px] text-slate-600 dark:bg-slate-950 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
        {t(`studio.status.backend_${backendStatus}`)}
      </span>
      {busy && <span className="inline-flex items-center gap-1.5" role="status"><span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />{t("studio.status.working")}</span>}
      <span className="ml-auto truncate">{[printer, bed].filter(Boolean).join(" · ")}</span>
      <span className="hidden sm:inline">{t("studio.status.palette_hint")}</span>
    </footer>
  );
}

function SavedFileToast() {
  const { t } = useI18n();
  const { notice, dismiss, reveal } = useDesktopIntegration();
  if (!notice) return null;
  return (
    <div role="status" data-testid="studio-saved-toast" className="fixed bottom-10 right-4 z-[120] flex max-w-sm items-center gap-3 rounded-xl border panel-divider bg-[var(--surface-panel-strong)] px-4 py-3 text-sm shadow-lg">
      <span className="min-w-0 flex-1 truncate">{t("studio.saved.title").replace("{name}", notice.name)}</span>
      <button type="button" onClick={reveal} className="shrink-0 font-medium text-[var(--nav-tab-selected-bg)] hover:underline">{t("studio.saved.reveal")}</button>
      <button type="button" onClick={dismiss} aria-label={t("common_close")} className="shrink-0 text-slate-400 hover:text-slate-700"><XMarkIcon aria-hidden="true" className="h-4 w-4" /></button>
    </div>
  );
}

function PageContent({ suspended }: { suspended: boolean }) {
  const view = useStudioPrefsStore((state) => state.view);
  const activeTab = useWidgetStore((state) => state.activeTab);
  const workshopMounted = useWorkshopProjectRuntime((state) => state.mounted);
  if (view === "home") return <HomeView />;
  return (
    <>
      {activeTab === "converter" && <ConverterWorkbench suspended={suspended} />}
      {activeTab === "calibration" && <CalibrationPanel />}
      {activeTab === "gradient-card-generate" && <GradientCardGeneratePanel />}
      {activeTab === "gradient-card-extract" && <GradientCardExtractPanel />}
      {activeTab === "material-library" && <MaterialLibraryPanel />}
      {activeTab === "material-cloud-sync" && <MaterialCloudSyncPanel />}
      {activeTab === "material-recipe" && <MaterialRecipeQueryPanel />}
      {activeTab === "extractor" && (
        <div className="flex h-full min-h-0 flex-col xl:flex-row">
          <ExtractorPanel />
          <div className="relative min-h-[min(54vh,40rem)] flex-1 overflow-hidden border-t border-slate-200/70 dark:border-slate-800/80 xl:min-h-0 xl:border-l xl:border-t-0">
            <ExtractorCanvas />
          </div>
        </div>
      )}
      {activeTab === "lut-library" && <LutLibraryPanel />}
      {activeTab === "lut-manager" && <LutManagerPanel />}
      {activeTab === "lut-cloud-sync" && <LutCloudSyncPanel />}
      {activeTab === "lut-details" && <LutDetailsPanel />}
      {activeTab === "lut-compare" && <LutComparePanel />}
      {activeTab === "five-color" && <div className="flex h-full min-h-0"><FiveColorQueryPanel /></div>}
      {activeTab === "vectorizer" && <VectorizerPanel />}
      {(workshopMounted || activeTab === "workshop") && (
        <div className={activeTab === "workshop" ? "h-full min-h-0" : "hidden"}><WorkshopPanel /></div>
      )}
      {activeTab === "settings" && (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto">
          <PlusSettings />
          <div className="min-h-[70vh] flex-1"><SettingsPanel /></div>
        </div>
      )}
    </>
  );
}

export function StudioShell({ backendStatus, reproTicketId, onReportBug, onOpenAbout, suspended, inert }: StudioShellProps) {
  const { t } = useI18n();
  const toggleSidebar = useStudioPrefsStore((state) => state.toggleSidebar);
  const showHome = useStudioPrefsStore((state) => state.showHome);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const openPalette = useCallback(() => { setShortcutsOpen(false); setPaletteOpen(true); }, []);
  const openShortcuts = useCallback(() => { setPaletteOpen(false); setShortcutsOpen(true); }, []);
  const commands = useMemo(
    () => buildStudioCommands({ openBugReport: onReportBug, openAbout: () => onOpenAbout(), openShortcuts }),
    [onOpenAbout, onReportBug, openShortcuts],
  );
  useStudioInput({ openPalette, openShortcuts });
  const mergedTitlebar = electronAPI?.platform === "darwin" || electronAPI?.platform === "win32";

  return (
    <div data-testid="studio-shell" className="flex h-screen flex-col overflow-hidden bg-slate-200 text-slate-900 dark:bg-slate-950 dark:text-white" inert={inert} aria-hidden={inert || undefined}>
      <header
        style={titleBarStyle()}
        className={`${mergedTitlebar ? "desktop-titlebar" : ""} relative z-50 flex min-h-10 shrink-0 items-center gap-3 border-b panel-divider px-3`}
      >
        <div className="desktop-titlebar-controls flex items-center gap-1">
          <button type="button" onClick={toggleSidebar} aria-label={t("studio.cmd.toggle_sidebar")} className="rounded-md p-1.5 text-slate-600 hover:bg-[var(--nav-chip-hover)] dark:text-slate-300">
            <Bars3Icon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button type="button" onClick={showHome} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-[var(--nav-chip-hover)]">
            <img src="/favicon.ico" alt="" draggable={false} className="h-6 w-6 rounded" />
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight">{t("studio.app_title")}</span>
          </button>
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          <button
            type="button"
            data-testid="studio-palette-button"
            onClick={openPalette}
            className="desktop-titlebar-controls flex w-full max-w-md items-center gap-2 rounded-lg border panel-divider bg-[var(--surface-panel-strong)] px-3 py-1 text-left text-xs text-slate-500 hover:border-slate-400 dark:text-slate-400"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("studio.palette.placeholder")}</span>
            <kbd className="rounded border panel-divider px-1.5 text-[10px]">{t("studio.kbd.palette")}</kbd>
          </button>
        </div>
        <div className="desktop-titlebar-controls flex items-center">
          <HeaderMenu backendStatus={backendStatus} reproTicketId={reproTicketId} onReportBug={onReportBug} onOpenAbout={onOpenAbout} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <StudioSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <ProjectWorkspace className="px-4">
            <div className="flex min-w-0 flex-1"><PageHeader /></div>
          </ProjectWorkspace>
          <main className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950" aria-busy={undefined}>
            <Suspense fallback={<LoadingSpinner />}>
              <PageContent suspended={suspended} />
            </Suspense>
          </main>
          <StatusBar backendStatus={backendStatus} />
        </div>
      </div>
      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} commands={commands} onClose={() => setShortcutsOpen(false)} />
      <SavedFileToast />
    </div>
  );
}
