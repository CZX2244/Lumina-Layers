/**
 * Ctrl+K command palette: search every page, step and action by name.
 * Ctrl+K 命令面板：按名称搜索所有页面、步骤和操作。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/context";
import { filterCommands, type CommandGroup, type StudioCommand } from "./commands";

const GROUP_ORDER: CommandGroup[] = ["navigate", "converter", "project", "app"];

export function CommandPalette({ open, commands, onClose }: { open: boolean; commands: StudioCommand[]; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const filtered = filterCommands(commands, query, t);
    if (query.trim()) return filtered;
    return [...filtered].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [commands, query, t]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setActive(0);
      dialog.showModal();
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (command: StudioCommand | undefined) => {
    if (!command) return;
    onClose();
    // Run after the modal closes so focus and scroll land on the page.
    window.setTimeout(command.run, 0);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("studio.palette.title")}
      data-testid="studio-command-palette"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className="mx-auto mt-[12vh] w-[min(36rem,92vw)] rounded-2xl border panel-divider bg-[var(--surface-panel-strong)] p-0 text-slate-900 backdrop:bg-slate-950/40 dark:text-slate-100"
    >
      <div className="flex items-center gap-2 border-b panel-divider px-4">
        <MagnifyingGlassIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="studio-command-list"
          aria-activedescendant={results[active] ? `studio-command-${results[active].id}` : undefined}
          aria-label={t("studio.palette.placeholder")}
          placeholder={t("studio.palette.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
            else if (event.key === "Enter") { event.preventDefault(); run(results[active]); }
          }}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <kbd className="rounded border panel-divider px-1.5 py-0.5 text-[11px] text-slate-500">{t("studio.kbd.esc")}</kbd>
      </div>
      <ul id="studio-command-list" ref={listRef} role="listbox" aria-label={t("studio.palette.results")} className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-[var(--surface-text-muted)]">{t("studio.palette.empty")}</li>}
        {results.map((command, index) => {
          const showGroup = !query.trim() && (index === 0 || results[index - 1].group !== command.group);
          return (
            <li key={command.id} role="presentation">
              {showGroup && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(`studio.palette.group_${command.group}`)}</div>}
              <div
                id={`studio-command-${command.id}`}
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-[var(--nav-chip-hover)]" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {t(command.titleKey)}
                  {command.contextKey && <span className="text-[var(--surface-text-muted)]"> · {t(command.contextKey)}</span>}
                </span>
                {command.shortcut && <kbd className="shrink-0 rounded border panel-divider px-1.5 py-0.5 text-[11px] text-slate-500">{command.shortcut}</kbd>}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

export function ShortcutsDialog({ open, commands, onClose }: { open: boolean; commands: StudioCommand[]; onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  const extra = [
    { keys: "Ctrl+K", labelKey: "studio.palette.title" },
    { keys: "Ctrl+V", labelKey: "studio.shortcut.paste" },
    { keys: "Ctrl+Z / Ctrl+Y", labelKey: "studio.shortcut.undo" },
    { keys: "Space", labelKey: "studio.shortcut.pan" },
    { keys: "Shift", labelKey: "studio.shortcut.original" },
    { keys: "Esc", labelKey: "studio.shortcut.leave_color" },
  ];
  const rows = [...extra.map((row) => ({ keys: row.keys, label: t(row.labelKey) })),
    ...commands.filter((command) => command.shortcut).map((command) => ({
      keys: command.shortcut!, label: `${t(command.titleKey)}${command.contextKey ? ` · ${t(command.contextKey)}` : ""}`,
    }))];
  return (
    <dialog
      ref={dialogRef}
      aria-label={t("studio.cmd.shortcuts")}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className="m-auto w-[min(32rem,92vw)] rounded-2xl border panel-divider bg-[var(--surface-panel-strong)] p-6 text-slate-900 backdrop:bg-slate-950/40 dark:text-slate-100"
    >
      <h2 className="mb-4 text-[15px] font-semibold">{t("studio.cmd.shortcuts")}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={`${row.keys}-${row.label}`} className="contents">
            <dt><kbd className="rounded border panel-divider px-1.5 py-0.5 text-xs">{row.keys}</kbd></dt>
            <dd className="text-slate-700 dark:text-slate-300">{row.label}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="action-control rounded-lg px-4 py-1.5 text-sm">{t("common_close")}</button>
      </div>
    </dialog>
  );
}
