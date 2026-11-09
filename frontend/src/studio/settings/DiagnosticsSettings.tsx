/**
 * Local diagnostics (bug reports and logs stay on this computer) and a manual
 * update check against the personal fork. Nothing here runs at start-up.
 * 本地诊断（反馈与日志只存本机）与手动检查个人版更新；启动时不自动运行。
 */
import { useState } from "react";
import { useI18n } from "../../i18n/context";
import { settingsGroupHeadingClass } from "../../components/ui/panelPrimitives";
import { plusDesktop, type UpdateCheckResult } from "../desktop";

type FolderKind = "feedback" | "logs" | "data";

export function DiagnosticsSettings() {
  const { t } = useI18n();
  const bridge = plusDesktop();
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [folderError, setFolderError] = useState(false);

  if (!bridge) {
    return (
      <div className="border-t panel-divider pt-5">
        <p className={settingsGroupHeadingClass}>{t("studio.diag.title")}</p>
        <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.diag.desktop_only")}</p>
      </div>
    );
  }

  const open = async (kind: FolderKind) => {
    setFolderError(!(await bridge.openDataFolder(kind)));
  };
  const check = async () => {
    setChecking(true);
    try { setUpdate(await bridge.checkUpdate()); } finally { setChecking(false); }
  };

  return (
    <div data-testid="studio-diagnostics" className="flex flex-col gap-4 border-t panel-divider pt-5">
      <div>
        <p className={settingsGroupHeadingClass}>{t("studio.diag.title")}</p>
        <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.diag.detail")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["feedback", "logs", "data"] as const).map((kind) => (
          <button key={kind} type="button" onClick={() => void open(kind)} className="action-control rounded-[4px] px-3 py-1.5 text-xs font-medium">
            {t(`studio.diag.open_${kind}`)}
          </button>
        ))}
        {folderError && <span role="status" className="text-xs text-[var(--dp-error)]">{t("studio.diag.open_failed")}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={checking} onClick={() => void check()} className="action-control rounded-[4px] px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {checking ? t("studio.diag.checking") : t("studio.diag.check_update")}
        </button>
        {update && (
          <span role="status" className="text-xs text-[var(--surface-text-muted)]">
            {update.status === "available" ? (
              <>
                {t("studio.diag.update_available").replace("{tag}", update.tag)}{" "}
                <button type="button" onClick={() => void bridge.openRelease(update.url)} className="font-medium text-[var(--dp-link)] hover:underline">{t("studio.diag.download")}</button>
              </>
            ) : t(`studio.diag.update_${update.status}`)}
          </span>
        )}
      </div>
    </div>
  );
}
