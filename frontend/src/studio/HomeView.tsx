/**
 * Home page: start from an image or project, reopen recent work, and a
 * first-run checklist that gets an empty install printing.
 * 首页：从图片或工程开始、打开最近工程，以及让新安装能尽快打印的首启清单。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  FolderOpenIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../i18n/context";
import { useConverterStore } from "../stores/converter";
import { useSettingsStore } from "../stores/settingsStore";
import { useSlicerStore } from "../stores/slicerStore";
import { useProjectUi, refreshProjects } from "../project/controller";
import { availableRecoveries } from "../project/recentProjects";
import { listGradientCardMaterials } from "../api/extractor";
import { navigateStudio } from "./navigation";
import { requestProjectCommand } from "./projectCommands";
import { useStudioPrefsStore } from "./studioPrefsStore";
import { openImagesInConverter } from "./useStudioInput";
import { goToWorkbenchStep } from "./commands";
import { ProductTemplates } from "./templates/ProductTemplates";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/bmp,image/gif,image/heic,image/heif,image/svg+xml,.svg,.heic,.heif";

type CheckState = "done" | "todo" | "unknown";

function ChecklistRow({ state, title, detail, action }: { state: CheckState; title: string; detail: string; action?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {state === "done" ? (
        <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <span aria-hidden="true" className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${state === "todo" ? "border-amber-500" : "border-slate-300 dark:border-slate-600"}`} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          <span className="sr-only">{state === "done" ? "✓ " : ""}</span>{title}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--surface-text-muted)]">{detail}</p>
      </div>
      {action}
    </li>
  );
}

function SmallButton({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
        primary ? "bg-[var(--button-primary)] text-white hover:opacity-90" : "action-control"
      }`}
    >
      {label}
    </button>
  );
}

function FirstRunChecklist() {
  const { t } = useI18n();
  const dismiss = useStudioPrefsStore((state) => state.dismissChecklist);
  const printerModel = useSettingsStore((state) => state.printerModel);
  const { slicers, detecting, detect } = useSlicerStore(useShallow((state) => ({ slicers: state.slicers, detecting: state.isDetecting, detect: state.detectSlicers })));
  const { sourceVersion, lutCount, setSourceVersion } = useConverterStore(useShallow((state) => ({
    sourceVersion: state.source_version, lutCount: state.lutList.length, setSourceVersion: state.setSourceVersion,
  })));
  const [materialCount, setMaterialCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listGradientCardMaterials({ signal: controller.signal })
      .then((response) => setMaterialCount(response.materials.length))
      .catch(() => { if (!controller.signal.aborted) setMaterialCount(null); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (!slicers.length && !detecting) void detect(); }, [detect, detecting, slicers.length]);

  const usingMaterials = sourceVersion === "material";
  const colorState: CheckState = usingMaterials
    ? materialCount === null ? "unknown" : materialCount > 0 ? "done" : "todo"
    : lutCount > 0 ? "done" : "unknown";
  const slicerState: CheckState = detecting ? "unknown" : slicers.length > 0 ? "done" : "todo";

  return (
    <section aria-labelledby="studio-checklist-title" className="rounded-2xl border panel-divider bg-[var(--surface-panel-strong)] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="studio-checklist-title" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.home.checklist_title")}</h2>
          <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.home.checklist_detail")}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label={t("studio.home.checklist_dismiss")} className="rounded-full p-1 text-slate-400 hover:bg-[var(--nav-chip-hover)] hover:text-slate-700 focus-visible:outline focus-visible:outline-2">
          <XMarkIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-2 divide-y divide-[var(--surface-divider)]">
        <ChecklistRow
          state={printerModel ? "done" : "todo"}
          title={t("studio.home.check_device")}
          detail={t("studio.home.check_device_detail").replace("{printer}", printerModel || "—")}
          action={<SmallButton label={t("studio.home.check_device_action")} onClick={() => navigateStudio("settings")} />}
        />
        <ChecklistRow
          state={colorState}
          title={t("studio.home.check_color")}
          detail={usingMaterials
            ? materialCount === 0 ? t("studio.home.check_color_empty") : t("studio.home.check_color_materials").replace("{count}", String(materialCount ?? "…"))
            : t("studio.home.check_color_lut")}
          action={usingMaterials && materialCount === 0 ? (
            <div className="flex shrink-0 flex-col gap-1.5">
              <SmallButton primary label={t("studio.home.use_lut")} onClick={() => { setSourceVersion("legacy"); goToWorkbenchStep("color"); }} />
              <SmallButton label={t("studio.home.make_profile")} onClick={() => navigateStudio("gradient-card-generate")} />
            </div>
          ) : undefined}
        />
        <ChecklistRow
          state={slicerState}
          title={t("studio.home.check_slicer")}
          detail={slicers.length ? slicers.map((slicer) => slicer.display_name ?? slicer.id).join(" · ") : detecting ? t("studio.home.check_slicer_detecting") : t("studio.home.check_slicer_missing")}
          action={slicerState === "todo" ? <SmallButton label={t("studio.home.check_device_action")} onClick={() => navigateStudio("settings")} /> : undefined}
        />
      </ul>
    </section>
  );
}

function RecentProjects() {
  const { t } = useI18n();
  const { entries, recoveries } = useProjectUi(useShallow((state) => ({ entries: state.entries, recoveries: state.recoveries })));
  useEffect(() => { void refreshProjects().catch(() => undefined); }, []);
  const drafts = availableRecoveries(recoveries, entries);
  const recent = entries.slice(0, 6);
  return (
    <section aria-labelledby="studio-recent-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="studio-recent-title" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.home.recent")}</h2>
        <button type="button" onClick={() => requestProjectCommand({ action: "center" })} className="text-xs font-medium text-[var(--nav-tab-selected-bg)] hover:underline">
          {t("studio.home.recent_all")}
        </button>
      </div>
      {drafts.length > 0 && (
        <button type="button" onClick={() => requestProjectCommand({ action: "center" })} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          {t("studio.home.recovery").replace("{count}", String(drafts.length))}
        </button>
      )}
      {recent.length === 0 ? (
        <p className="rounded-xl border border-dashed panel-divider px-6 py-8 text-center text-sm text-[var(--surface-text-muted)]">{t("studio.home.recent_empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {recent.map((entry) => (
            <li key={entry.fileEntryId}>
              <button
                type="button"
                data-testid="studio-recent-project"
                onClick={() => requestProjectCommand({ action: "openEntry", entryId: entry.fileEntryId })}
                className="group block w-full overflow-hidden rounded-[10px] border panel-divider bg-[var(--surface-panel-strong)] text-left outline-none hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:hover:border-slate-500"
              >
                <div className="aspect-[4/3] w-full bg-[var(--surface-well)]">
                  {entry.thumbnailDataUrl && <img src={entry.thumbnailDataUrl} alt="" className="h-full w-full object-contain" />}
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{entry.pinned ? "★ " : ""}{entry.name}</p>
                  <time className="text-xs text-[var(--surface-text-muted)]">{new Date(entry.lastOpenedAt).toLocaleString()}</time>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HomeView() {
  const { t } = useI18n();
  const checklistDismissed = useStudioPrefsStore((state) => state.checklistDismissed);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasImage = useConverterStore((state) => Boolean(state.imageFile));

  return (
    <div data-testid="studio-home" className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section
          aria-labelledby="studio-home-start"
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-[var(--surface-panel-strong)] px-6 py-10 text-center dark:border-slate-700"
        >
          <ArrowUpTrayIcon aria-hidden="true" className="mx-auto h-10 w-10 text-slate-400" />
          <h1 id="studio-home-start" className="mt-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t("studio.home.start_title")}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--surface-text-muted)]">{t("studio.home.start_detail")}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="studio-home-pick-image"
              onClick={() => fileInput.current?.click()}
              className="rounded-lg bg-[var(--button-primary)] px-5 py-2.5 text-sm font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {t("studio.home.pick_image")}
            </button>
            <button
              type="button"
              onClick={() => requestProjectCommand({ action: "open" })}
              className="action-control inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
              {t("studio.home.open_project")}
            </button>
            {hasImage && (
              <button type="button" onClick={() => navigateStudio("converter")} className="action-control rounded-lg px-4 py-2.5 text-sm font-medium">
                {t("studio.home.continue")}
              </button>
            )}
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--surface-text-muted)]">
            <ClipboardDocumentIcon aria-hidden="true" className="h-4 w-4" />
            {t("studio.home.paste_hint")}
          </p>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) openImagesInConverter(files);
            }}
          />
        </section>

        {!checklistDismissed && <FirstRunChecklist />}

        <ProductTemplates />

        <RecentProjects />
      </div>
    </div>
  );
}
