/**
 * Pre-generation checklist shown above the generate/export controls.
 * 生成前检查清单，显示在生成/导出按钮上方。
 */
import { useMemo } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../i18n/context";
import { formatPreflightMessage, runPreflight, type PreflightLevel } from "./preflight";
import { usePreflightInput } from "./usePreflightInput";

const LEVEL_STYLE: Record<PreflightLevel, { icon: typeof XCircleIcon; className: string }> = {
  error: { icon: XCircleIcon, className: "text-red-600 dark:text-red-400" },
  warning: { icon: ExclamationTriangleIcon, className: "text-amber-600 dark:text-amber-400" },
  info: { icon: InformationCircleIcon, className: "text-sky-600 dark:text-sky-400" },
};

export function PreflightPanel() {
  const { t } = useI18n();
  const input = usePreflightInput();
  const issues = useMemo(() => runPreflight(input), [input]);
  const blocking = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;

  if (!input.hasImage) {
    return (
      <p data-testid="studio-preflight" className="px-4 pb-2 text-xs leading-5 text-[var(--surface-text-muted)]">
        {t("studio.preflight.no_image")}
      </p>
    );
  }

  return (
    <section data-testid="studio-preflight" aria-label={t("studio.preflight.title")} className="mx-3 mt-2 rounded-[10px] bg-[var(--surface-well)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {blocking + warnings === 0 ? (
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : blocking ? (
          <XCircleIcon aria-hidden="true" className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <ExclamationTriangleIcon aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        <span>
          {blocking + warnings === 0
            ? t("studio.preflight.all_clear")
            : formatPreflightMessage(t("studio.preflight.summary"), { errors: blocking, warnings })}
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {issues.map((issue) => {
            const style = LEVEL_STYLE[issue.level];
            const Icon = style.icon;
            return (
              <li key={issue.id} data-testid={`studio-preflight-${issue.id}`} className="flex gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${style.className}`} />
                <span>
                  <span className="sr-only">{t(`studio.preflight.level_${issue.level}`)}: </span>
                  {formatPreflightMessage(t(issue.messageKey), issue.params)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
