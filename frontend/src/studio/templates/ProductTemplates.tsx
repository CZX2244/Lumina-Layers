/**
 * Home-page product templates plus import/export of the user's named presets.
 * 首页成品模板，以及用户命名预设的导入导出。
 */
import { useRef, useState } from "react";
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../i18n/context";
import { useSettingsStore } from "../../stores/settingsStore";
import { saveGeneratedFile } from "../../utils/saveGeneratedFile";
import { applyProductTemplate, mergeImportedPresets, PRODUCT_TEMPLATES, serializePresets } from "./templateRegistry";

export function ProductTemplates() {
  const { t } = useI18n();
  const presets = useSettingsStore((state) => state.conversionPreferences.presets);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportPresets = async () => {
    try {
      const outcome = await saveGeneratedFile(new Blob([serializePresets(presets)], { type: "application/json" }), "lumina-presets.json", "preset");
      if (outcome !== "canceled") setNotice(t("studio.presets.exported").replace("{count}", String(presets.length)));
    } catch {
      setNotice(t("studio.presets.export_failed"));
    }
  };

  const importPresets = async (file: File) => {
    try {
      const settings = useSettingsStore.getState();
      const result = mergeImportedPresets(settings.conversionPreferences.presets, await file.text());
      settings.setConversionPreferences({ ...settings.conversionPreferences, presets: result.merged });
      setNotice(t("studio.presets.imported").replace("{added}", String(result.added)).replace("{skipped}", String(result.skipped)));
    } catch {
      setNotice(t("studio.presets.import_failed"));
    }
  };

  return (
    <section aria-labelledby="studio-templates-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="studio-templates-title" className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{t("studio.template.title")}</h2>
          <p className="mt-0.5 text-xs text-[var(--surface-text-muted)]">{t("studio.template.detail")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className="action-control inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium">
            <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />{t("studio.presets.import")}
          </button>
          <button type="button" disabled={!presets.length} onClick={() => void exportPresets()} className="action-control inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40">
            <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />{t("studio.presets.export").replace("{count}", String(presets.length))}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importPresets(file);
            }}
          />
        </div>
      </div>
      {notice && <p role="status" className="mb-3 text-xs text-[var(--surface-text-muted)]">{notice}</p>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {PRODUCT_TEMPLATES.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              data-testid={`studio-template-${template.id}`}
              onClick={() => applyProductTemplate(template)}
              className="flex h-full w-full flex-col items-start gap-1 rounded-[10px] border panel-divider bg-[var(--surface-panel-strong)] px-4 py-3 text-left outline-none hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:hover:border-slate-500"
            >
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(template.titleKey)}</span>
              <span className="text-xs leading-5 text-[var(--surface-text-muted)]">{t(template.detailKey)}</span>
              <span className="mt-auto pt-1 text-[11px] text-slate-500">{t("studio.template.long_edge").replace("{size}", String(template.sizeMm))}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
