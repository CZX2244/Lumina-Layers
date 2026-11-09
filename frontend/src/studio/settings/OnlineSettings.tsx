/**
 * Online services: bug-report upload opt-in, user-authorised Registry
 * connections, and the update check for this personal build.
 * 在线服务：反馈上传开关、用户已获授权的 Registry 连接，以及个人版更新检查。
 */
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/context";
import { settingsGroupHeadingClass, workstationInputClass } from "../../components/ui/panelPrimitives";
import { plusDesktop, type PlusConfigUpdate, type PlusConfigView, type UpdateCheckResult } from "../desktop";

function RegistryFields({ label, url, tokenSet, onSave }: {
  label: string;
  url: string;
  tokenSet: boolean;
  onSave: (url: string, token: string | undefined) => void;
}) {
  const { t } = useI18n();
  const [draftUrl, setDraftUrl] = useState(url);
  const [draftToken, setDraftToken] = useState("");
  useEffect(() => setDraftUrl(url), [url]);
  return (
    <fieldset className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-center">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm font-medium">{label}</span>
      <input aria-label={`${label} URL`} placeholder={t("studio.online.url_placeholder")} value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} className={`${workstationInputClass} text-sm`} />
      <input aria-label={`${label} token`} type="password" autoComplete="off" placeholder={tokenSet ? t("studio.online.token_saved") : t("studio.online.token")} value={draftToken} onChange={(event) => setDraftToken(event.target.value)} className={`${workstationInputClass} text-sm`} />
      <button type="button" onClick={() => { onSave(draftUrl.trim(), draftToken ? draftToken : undefined); setDraftToken(""); }} className="action-control rounded-lg px-3 py-1.5 text-xs font-medium">
        {t("studio.online.save")}
      </button>
    </fieldset>
  );
}

export function OnlineSettings() {
  const { t } = useI18n();
  const bridge = plusDesktop();
  const [config, setConfig] = useState<PlusConfigView | null>(null);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getConfig().then((result) => setConfig(result?.config ?? null));
  }, [bridge]);

  if (!bridge) {
    return (
      <div className="border-t panel-divider pt-5">
        <p className={settingsGroupHeadingClass}>{t("studio.online.title")}</p>
        <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.online.desktop_only")}</p>
      </div>
    );
  }

  const save = async (patch: PlusConfigUpdate) => {
    const result = await bridge.setConfig(patch);
    if (result) { setConfig(result.config); setRestartNeeded(true); }
  };

  const check = async () => {
    setChecking(true);
    try { setUpdate(await bridge.checkUpdate()); } finally { setChecking(false); }
  };

  return (
    <div data-testid="studio-online" className="flex flex-col gap-4 border-t panel-divider pt-5">
      <div>
        <p className={settingsGroupHeadingClass}>{t("studio.online.title")}</p>
        <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.online.detail")}</p>
      </div>

      {config && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={config.feedbackUpload} onChange={(event) => void save({ feedbackUpload: event.target.checked })} />
          <span>
            <span className="block font-medium">{t("studio.online.feedback")}</span>
            <span className="block text-xs text-[var(--surface-text-muted)]">{t("studio.online.feedback_detail")}</span>
          </span>
        </label>
      )}

      {config && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--surface-text-muted)]">{t("studio.online.registry_detail")}</p>
          <RegistryFields label={t("studio.online.material_registry")} url={config.materialRegistryUrl} tokenSet={config.materialRegistryTokenSet}
            onSave={(url, token) => void save({ materialRegistryUrl: url, ...(token !== undefined ? { materialRegistryToken: token } : {}) })} />
          <RegistryFields label={t("studio.online.lut_registry")} url={config.lutRegistryUrl} tokenSet={config.lutRegistryTokenSet}
            onSave={(url, token) => void save({ lutRegistryUrl: url, ...(token !== undefined ? { lutRegistryToken: token } : {}) })} />
        </div>
      )}

      {restartNeeded && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <span className="flex-1">{t("studio.online.restart_needed")}</span>
          <button type="button" onClick={() => void bridge.relaunch()} className="action-control rounded-md px-3 py-1 font-medium">{t("studio.online.restart")}</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={checking} onClick={() => void check()} className="action-control rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {checking ? t("studio.online.checking") : t("studio.online.check_update")}
        </button>
        {update && (
          <span role="status" className="text-xs text-[var(--surface-text-muted)]">
            {update.status === "available" ? (
              <>
                {t("studio.online.update_available").replace("{tag}", update.tag)}{" "}
                <button type="button" onClick={() => void bridge.openRelease(update.url)} className="font-medium text-[var(--nav-tab-selected-bg)] hover:underline">{t("studio.online.download")}</button>
              </>
            ) : t(`studio.online.update_${update.status}`)}
          </span>
        )}
      </div>
    </div>
  );
}
