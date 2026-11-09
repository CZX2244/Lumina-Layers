/**
 * Left navigation for the studio shell: grouped by task, always visible.
 * 新版工作台左侧导航：按任务分组，常驻可见。
 */
import { useI18n } from "../i18n/context";
import { useWidgetStore } from "../stores/widgetStore";
import { StudioIcon } from "./StudioIcon";
import { navigateStudio, navOwnerOf, STUDIO_NAV_GROUPS, STUDIO_SETTINGS_ITEM, type StudioNavItem } from "./navigation";
import { useStudioPrefsStore } from "./studioPrefsStore";

function NavButton({
  label,
  icon,
  active,
  collapsed,
  onClick,
  testId,
}: {
  label: string;
  icon: StudioNavItem["icon"];
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
        active
          ? "bg-[var(--nav-tab-selected-bg)] text-[var(--nav-tab-selected-text)]"
          : "text-slate-600 hover:bg-[var(--nav-chip-hover)] hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <StudioIcon name={icon} className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="min-w-0 truncate">{label}</span>}
    </button>
  );
}

export function StudioSidebar() {
  const { t } = useI18n();
  const activeTab = useWidgetStore((state) => state.activeTab);
  const view = useStudioPrefsStore((state) => state.view);
  const collapsed = useStudioPrefsStore((state) => state.sidebarCollapsed);
  const showHome = useStudioPrefsStore((state) => state.showHome);
  const owner = navOwnerOf(activeTab);
  const isActive = (tab: StudioNavItem["tab"]) => view === "app" && owner === tab;

  return (
    <nav
      aria-label={t("studio.nav.label")}
      data-testid="studio-sidebar"
      className={`flex shrink-0 flex-col border-r panel-divider bg-slate-200 py-3 dark:bg-slate-950 ${collapsed ? "w-14 px-1.5" : "w-56 px-3"}`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
        <NavButton
          label={t("studio.nav.home")}
          icon="home"
          active={view === "home"}
          collapsed={collapsed}
          onClick={showHome}
          testId="studio-nav-home"
        />
        {STUDIO_NAV_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`studio-nav-${group.id}`} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div className="mx-2 my-1 h-px bg-[var(--surface-divider)]" aria-hidden="true" />
            ) : (
              <h2 id={`studio-nav-${group.id}`} className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t(group.labelKey)}
              </h2>
            )}
            {collapsed && <h2 id={`studio-nav-${group.id}`} className="sr-only">{t(group.labelKey)}</h2>}
            {group.items.map((item) => (
              <NavButton
                key={item.tab}
                label={t(item.labelKey)}
                icon={item.icon}
                active={isActive(item.tab)}
                collapsed={collapsed}
                onClick={() => navigateStudio(item.tab)}
                testId={`studio-nav-${item.tab}`}
              />
            ))}
          </section>
        ))}
      </div>
      <div className="mt-3 border-t panel-divider pt-3">
        <NavButton
          label={t(STUDIO_SETTINGS_ITEM.labelKey)}
          icon={STUDIO_SETTINGS_ITEM.icon}
          active={isActive("settings")}
          collapsed={collapsed}
          onClick={() => navigateStudio("settings")}
          testId="studio-nav-settings"
        />
      </div>
    </nav>
  );
}
