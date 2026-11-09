/**
 * Personal-build settings shown above the standard settings page.
 * 个人增强版设置，显示在标准设置页上方。
 */
import { useState } from "react";
import { useI18n } from "../../i18n/context";
import { cardPadClass, settingsGroupHeadingClass, workstationInputClass } from "../../components/ui/panelPrimitives";
import { useStudioPrefsStore } from "../studioPrefsStore";
import { plusDesktop } from "../desktop";
import { StorageSettings } from "./StorageSettings";
import { OnlineSettings } from "./OnlineSettings";

export function PlusSettings() {
  const { t } = useI18n();
  const shell = useStudioPrefsStore((state) => state.shell);
  const setShell = useStudioPrefsStore((state) => state.setShell);
  const template = useStudioPrefsStore((state) => state.downloadNameTemplate);
  const setTemplate = useStudioPrefsStore((state) => state.setDownloadNameTemplate);
  const [draft, setDraft] = useState(template);
  const draftValid = draft.includes("{name}") && draft.length <= 120;
  const desktop = Boolean(plusDesktop());

  return (
    <section data-testid="studio-plus-settings" aria-labelledby="studio-plus-settings-title" className="mx-auto w-full max-w-5xl px-6 pt-6">
      <div className={`${cardPadClass} flex flex-col gap-5`}>
        <div>
          <h2 id="studio-plus-settings-title" className="text-[15px] font-semibold">{t("studio.settings.title")}</h2>
          <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.settings.detail")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={settingsGroupHeadingClass}>{t("studio.settings.shell")}</p>
            <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.settings.shell_detail")}</p>
          </div>
          <div role="radiogroup" aria-label={t("studio.settings.shell")} className="flex rounded-lg bg-slate-200 p-0.5 dark:bg-slate-800">
            {(["studio", "classic"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={shell === value}
                onClick={() => setShell(value)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${shell === value ? "bg-[var(--surface-panel-strong)] text-slate-900 shadow-sm dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
              >
                {t(`studio.settings.shell_${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t panel-divider pt-5">
          <label htmlFor="studio-download-template" className={settingsGroupHeadingClass}>{t("studio.settings.naming")}</label>
          <p className="mt-1 text-xs text-[var(--surface-text-muted)]">
            {t(desktop ? "studio.settings.naming_detail" : "studio.settings.naming_desktop_only")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="studio-download-template"
              value={draft}
              disabled={!desktop}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => { if (draftValid) setTemplate(draft); }}
              aria-invalid={!draftValid}
              className={`${workstationInputClass} min-w-[16rem] flex-1 font-mono text-sm`}
            />
            {["{name}_{size}", "{name}_{date}", "{printer}_{name}_{date}-{time}"].map((preset) => (
              <button key={preset} type="button" disabled={!desktop} onClick={() => { setDraft(preset); setTemplate(preset); }} className="action-control rounded-md px-2 py-1 font-mono text-[11px] disabled:opacity-40">
                {preset}
              </button>
            ))}
          </div>
          {!draftValid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t("studio.settings.naming_invalid")}</p>}
          <p className="mt-1 text-[11px] text-[var(--surface-text-muted)]">{t("studio.settings.naming_tokens")}</p>
        </div>

        <StorageSettings />
        <OnlineSettings />
      </div>
    </section>
  );
}
