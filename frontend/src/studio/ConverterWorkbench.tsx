/**
 * Converter workbench: fixed three-column layout replacing the floating docks.
 * 图像转换工作台：固定三栏布局，替代浮动停靠面板。
 *
 *  ┌ settings (steps) ┐┌──── 3D preview ────┐┌ generate & export ┐
 *  │ 1 Source         ││                    ││ preflight checks  │
 *  │ 2 Colour source  ││      Scene3D       ││ preview / layers  │
 *  │ 3 Size & plate   ││                    ││ slicer / download │
 *  │ 4 Product type   ││                    ││                   │
 *  │ 5 Advanced       ││                    ││                   │
 *  └──────────────────┘└────────────────────┘└───────────────────┘
 * The colour-editing overlay (converter sub-tab "color") covers all three.
 * 颜色编辑覆盖层（子页 color）覆盖整个工作台。
 */
import { Component, Suspense, lazy, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/context";
import { useWidgetStore } from "../stores/widgetStore";
import { useConverterStore } from "../stores/converter";
import { useConverterDataInit } from "../hooks/useConverterDataInit";
import { ConverterDropIntentBanner, useConverterDropRouting } from "../hooks/useConverterDropRouting";
import LoadingSpinner from "../components/LoadingSpinner";
import Color2DOverlay from "../components/widget/Color2DOverlay";
import BasicSettings from "../components/sections/BasicSettings";
import ActionBar from "../components/sections/ActionBar";
import AdvancedSettingsWidgetContent from "../components/widget/AdvancedSettingsWidgetContent";
import KeychainLoopWidgetContent from "../components/widget/KeychainLoopWidgetContent";
import FridgeMagnetSettingsWidgetContent from "../components/widget/FridgeMagnetSettingsWidgetContent";
import OutlineSettingsWidgetContent from "../components/widget/OutlineSettingsWidgetContent";
import CoatingSettingsWidgetContent from "../components/widget/CoatingSettingsWidgetContent";
import ReliefSettingsWidgetContent from "../components/widget/ReliefSettingsWidgetContent";
import PuzzleSettingsWidgetContent from "../components/widget/PuzzleSettingsWidgetContent";
import ModelSurfaceSettingsWidgetContent from "../components/widget/ModelSurfaceSettingsWidgetContent";
import { PreflightPanel } from "./preflight/PreflightPanel";
import { AssemblySheetButton } from "./assembly/AssemblySheetButton";
import { OPEN_PRODUCT_EVENT, WORKBENCH_STEPS, scrollWorkbenchStep } from "./workbenchSteps";

const Scene3D = lazy(() => import("../components/Scene3D"));

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type ConverterSnapshot = ReturnType<typeof useConverterStore.getState>;

interface ProductCard {
  id: string;
  titleKey: string;
  Content: ComponentType;
  enabled: (state: ConverterSnapshot) => boolean;
}

/** Product types are all listed; each card's own switch turns it on. */
const PRODUCT_CARDS: ProductCard[] = [
  { id: "keychain", titleKey: "widget.keychainLoop", Content: KeychainLoopWidgetContent, enabled: (s) => s.add_loop },
  { id: "fridge-magnet", titleKey: "widget.fridgeMagnetSettings", Content: FridgeMagnetSettingsWidgetContent, enabled: (s) => Boolean(s.enable_fridge_magnet) },
  { id: "relief", titleKey: "widget.reliefSettings", Content: ReliefSettingsWidgetContent, enabled: (s) => s.enable_relief },
  { id: "outline", titleKey: "widget.outlineSettings", Content: OutlineSettingsWidgetContent, enabled: (s) => s.enable_outline },
  { id: "coating", titleKey: "widget.coatingSettings", Content: CoatingSettingsWidgetContent, enabled: (s) => s.enable_coating },
  { id: "puzzle", titleKey: "widget.puzzleSettings", Content: PuzzleSettingsWidgetContent, enabled: (s) => s.puzzleEnabled },
  { id: "model-surface", titleKey: "widget.modelSurfaceSettings", Content: ModelSurfaceSettingsWidgetContent, enabled: (s) => s.modelSurfaceEnabled },
];

function CollapsibleCard({
  title,
  badge,
  defaultOpen,
  children,
  testId,
  productId,
}: {
  title: string;
  badge?: string | null;
  defaultOpen: boolean;
  children: ReactNode;
  testId: string;
  productId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!productId) return;
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== productId) return;
      setOpen(true);
      window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    window.addEventListener(OPEN_PRODUCT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PRODUCT_EVENT, onOpen);
  }, [productId]);
  return (
    <section ref={ref} data-testid={testId} className="scroll-mt-12 border-b panel-divider last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 outline-none hover:bg-[var(--nav-chip-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] dark:text-slate-100"
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge && (
          <span className="rounded-full bg-[var(--dp-status-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--dp-on-status)]">
            {badge}
          </span>
        )}
        <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </section>
  );
}

function ProductTypes() {
  const { t } = useI18n();
  const enabledIds = useConverterStore((state) => PRODUCT_CARDS.filter((card) => card.enabled(state)).map((card) => card.id).join(","));
  const enabled = new Set(enabledIds ? enabledIds.split(",") : []);
  return (
    <div data-studio-step="product">
      <h2 className="px-4 pb-1 pt-5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.step.product")}</h2>
      <p className="px-4 pb-2 text-xs leading-5 text-[var(--surface-text-muted)]">{t("studio.workbench.product_hint")}</p>
      <div className="border-y panel-divider">
        {PRODUCT_CARDS.map(({ id, titleKey, Content }) => (
          <CollapsibleCard
            key={id}
            testId={`studio-product-${id}`}
            productId={id}
            title={t(titleKey)}
            badge={enabled.has(id) ? t("studio.workbench.enabled") : null}
            defaultOpen={enabled.has(id)}
          >
            <Content />
          </CollapsibleCard>
        ))}
      </div>
    </div>
  );
}

export function WorkbenchStepNav() {
  const { t } = useI18n();
  return (
    <div role="toolbar" aria-label={t("studio.workbench.steps")} className="sticky top-0 z-10 flex flex-wrap gap-1 border-b panel-divider bg-[var(--surface-panel-strong)] px-2 py-2">
      {WORKBENCH_STEPS.map((step, index) => (
        <button
          key={step.id}
          type="button"
          data-testid={`studio-step-${step.id}`}
          onClick={() => scrollWorkbenchStep(step.id)}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 outline-none hover:bg-[var(--nav-chip-hover)] hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:text-slate-300 dark:hover:text-white"
        >
          <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{index + 1}</span>
          {t(step.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function ConverterWorkbench({ suspended }: { suspended: boolean }) {
  const { t } = useI18n();
  const color2DOverlayOpen = useWidgetStore((state) => state.color2DOverlayOpen);
  useConverterDataInit();
  const { dropImportIntent } = useConverterDropRouting();

  return (
    <div data-testid="studio-workbench" className="relative flex h-full min-h-0 flex-col">
      <ConverterDropIntentBanner intent={dropImportIntent} />
      <div className="flex min-h-0 flex-1">
        <aside
          data-testid="studio-workbench-settings"
          aria-label={t("studio.workbench.settings")}
          className="dock-scrollbar w-[clamp(17rem,24vw,22.5rem)] shrink-0 overflow-y-auto overscroll-contain border-r panel-divider bg-[var(--surface-panel-strong)]"
        >
          <WorkbenchStepNav />
          <div className="p-3">
            <BasicSettings />
          </div>
          <ProductTypes />
          <div data-studio-step="advanced" className="pb-6">
            <h2 className="px-4 pb-1 pt-5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.step.advanced")}</h2>
            <div className="border-y panel-divider">
              <CollapsibleCard testId="studio-advanced" title={t("widget.advancedSettings")} defaultOpen={false}>
                <AdvancedSettingsWidgetContent />
              </CollapsibleCard>
            </div>
          </div>
        </aside>

        <section
          aria-label={t("studio.workbench.preview")}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ ["--lumina-left-dock-width" as string]: "0px", ["--lumina-right-dock-width" as string]: "0px" }}
        >
          <SceneBoundary
            fallback={
              <div className="absolute inset-0 grid place-items-center">
                <p className="text-sm text-red-500">{t("app_3d_scene_error")}</p>
              </div>
            }
          >
            <Suspense fallback={<LoadingSpinner />}>
              <Scene3D suspended={suspended || color2DOverlayOpen} />
            </Suspense>
          </SceneBoundary>
        </section>

        <aside
          data-testid="studio-workbench-export"
          aria-label={t("studio.workbench.export")}
          className="dock-scrollbar w-[clamp(15rem,20vw,21rem)] shrink-0 overflow-y-auto overscroll-contain border-l panel-divider bg-[var(--surface-panel-strong)]"
        >
          <h2 className="px-4 pb-1 pt-4 text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.workbench.export")}</h2>
          <PreflightPanel />
          <div className="p-3">
            <ActionBar />
          </div>
          <AssemblySheetButton />
        </aside>
      </div>

      <AnimatePresence>{color2DOverlayOpen && <Color2DOverlay />}</AnimatePresence>
    </div>
  );
}
