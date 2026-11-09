/**
 * Disk use per data category with selective cleanup.
 * 各类数据的磁盘占用与分项清理。
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n/context";
import { settingsGroupHeadingClass } from "../../components/ui/panelPrimitives";
import { useConverterStore } from "../../stores/converter";
import { cleanStorage, formatBytes, getStorageOverview, type StorageCategoryId, type StorageEntry } from "../storageApi";

export function StorageSettings() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<StorageEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<StorageCategoryId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const jobRunning = useConverterStore((state) => state.isLoading || state.isGenerating || state.batchLoading);

  const refresh = useCallback(async () => {
    try {
      setEntries((await getStorageOverview()).categories);
    } catch {
      setEntries([]);
      setMessage(t("studio.storage.load_failed"));
    }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = (id: StorageCategoryId) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const clean = async () => {
    if (!selected.size) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await cleanStorage([...selected]);
      setMessage(t("studio.storage.cleaned").replace("{size}", formatBytes(result.freed_bytes)).replace("{files}", String(result.deleted_files)));
      setSelected(new Set());
      await refresh();
    } catch {
      setMessage(t("studio.storage.clean_failed"));
    } finally {
      setBusy(false);
    }
  };

  const total = entries?.reduce((sum, entry) => sum + entry.bytes, 0) ?? 0;
  return (
    <div data-testid="studio-storage" className="border-t panel-divider pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={settingsGroupHeadingClass}>{t("studio.storage.title")}</p>
        <span className="text-xs text-[var(--surface-text-muted)]">{entries ? t("studio.storage.total").replace("{size}", formatBytes(total)) : t("studio.storage.loading")}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--surface-text-muted)]">{t("studio.storage.detail")}</p>
      {entries && entries.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--surface-divider)] rounded-[10px] bg-[var(--surface-well)]">
          {entries.map((entry) => (
            <li key={entry.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} disabled={busy || entry.files === 0} className="h-4 w-4" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`studio.storage.cat_${entry.id}`)}</span>
                  <span className="block truncate text-[11px] text-[var(--surface-text-muted)]" title={entry.path}>{t(`studio.storage.cat_${entry.id}_detail`)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-slate-600 dark:text-slate-300">
                  {formatBytes(entry.bytes)} · {t("studio.storage.files").replace("{count}", String(entry.files))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!selected.size || busy || jobRunning} onClick={() => void clean()} className="action-control rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {busy ? t("studio.storage.cleaning") : t("studio.storage.clean_selected")}
        </button>
        <button type="button" disabled={busy} onClick={() => void refresh()} className="text-xs text-[var(--nav-tab-selected-bg)] hover:underline disabled:opacity-40">{t("studio.storage.refresh")}</button>
        {jobRunning && <span className="text-xs text-[var(--surface-text-muted)]">{t("studio.storage.job_running")}</span>}
        {message && <span role="status" className="text-xs text-[var(--surface-text-muted)]">{message}</span>}
      </div>
    </div>
  );
}
